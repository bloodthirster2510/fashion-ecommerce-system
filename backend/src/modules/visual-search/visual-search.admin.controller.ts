import type { Request, Response } from 'express';
import { error as errorResponse, ok } from '../../utils/response';
import {
  VisualSearchServiceError,
  visualSearchService,
} from './visual-search.service';

const parseBoolean = (value: unknown) => {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return undefined;

  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return undefined;
};

const parsePositiveInteger = (value: unknown, fieldName: string) => {
  if (value === undefined || value === null || value === '') return undefined;
  const numericValue = Number(value);

  if (!Number.isInteger(numericValue) || numericValue < 1) {
    throw new VisualSearchServiceError(`Invalid ${fieldName}`, 400, 'VISUAL_SEARCH_INVALID_INPUT');
  }

  return numericValue;
};

const handleAdminVisualSearchError = (res: Response, error: unknown) => {
  if (error instanceof VisualSearchServiceError) {
    if (error.statusCode >= 500) {
      console.error('Visual search admin controller error:', error);
    }

    return errorResponse(res, error.message, error.statusCode, {
      ...(error.errorCode ? { errorCode: error.errorCode } : {}),
    });
  }

  console.error('Visual search admin controller error:', error);
  return errorResponse(res, 'Internal Server Error', 500);
};

export const getAdminVisualIndexStatus = async (_req: Request, res: Response) => {
  try {
    return ok(res, await visualSearchService.getVisualIndexStatus());
  } catch (error) {
    return handleAdminVisualSearchError(res, error);
  }
};

export const backfillAdminVisualIndex = async (req: Request, res: Response) => {
  try {
    const result = await visualSearchService.backfillVisualIndex({
      activeOnly: parseBoolean(req.body.activeOnly),
      dryRun: parseBoolean(req.body.dryRun),
      limit: parsePositiveInteger(req.body.limit, 'limit'),
    });

    return ok(res, result);
  } catch (error) {
    return handleAdminVisualSearchError(res, error);
  }
};
