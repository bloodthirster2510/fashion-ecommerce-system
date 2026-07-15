import type { Request, Response } from 'express';
import { created, error as errorResponse } from '../../utils/response';
import {
  InteractionServiceError,
  interactionService,
} from './interaction.service';
import type { RecordInteractionInput } from './interaction.types';

const hasStatusCode = (value: unknown): value is { statusCode: number } =>
  typeof value === 'object' &&
  value !== null &&
  'statusCode' in value &&
  typeof value.statusCode === 'number';

const getErrorResponse = (e: unknown) => {
  if (e instanceof InteractionServiceError || hasStatusCode(e)) {
    return {
      statusCode: e.statusCode,
      message: e instanceof Error ? e.message : 'An error occurred',
    };
  }

  console.error('Interaction controller error:', e);
  return {
    statusCode: 500,
    message: 'Internal Server Error',
  };
};

const parseString = (value: unknown) => {
  if (Array.isArray(value)) {
    return parseString(value[0]);
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue || undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getSessionId = (req: Request, body: Record<string, unknown>) =>
  parseString(req.headers['x-session-id']) ??
  parseString(req.query.sessionId) ??
  parseString(body.sessionId);

const createInteraction = async (req: Request, res: Response) => {
  try {
    const body = isRecord(req.body) ? req.body : {};
    const input: RecordInteractionInput = {
      userId: req.user?.userId,
      sessionId: getSessionId(req, body),
      productId: parseString(body.productId),
      variantId: parseString(body.variantId),
      colorVariantId: parseString(body.colorVariantId),
      size: parseString(body.size),
      actionType: parseString(body.actionType) as RecordInteractionInput['actionType'],
      source: parseString(body.source) as RecordInteractionInput['source'],
      metadata: isRecord(body.metadata) ? body.metadata : {},
    };

    if (!input.actionType) {
      return errorResponse(res, 'actionType is required', 400);
    }

    const result = await interactionService.recordInteraction(input);
    return created(res, result);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

export { createInteraction };
