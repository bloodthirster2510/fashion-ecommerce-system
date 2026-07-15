import type { Request, Response } from 'express';
import { created, error as errorResponse, ok } from '../../utils/response';
import {
  RecommendationServiceError,
  recommendationService,
} from './recommendation.service';
import { recommendationAnalyticsService } from './recommendation-analytics.service';
import type { RecommendationEventInput } from './recommendation.types';

const hasStatusCode = (value: unknown): value is { statusCode: number } =>
  typeof value === 'object' &&
  value !== null &&
  'statusCode' in value &&
  typeof value.statusCode === 'number';

const getErrorResponse = (e: unknown) => {
  if (e instanceof RecommendationServiceError || hasStatusCode(e)) {
    return {
      statusCode: e.statusCode,
      message: e instanceof Error ? e.message : 'An error occurred',
    };
  }

  console.error('Recommendation controller error:', e);
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

const parsePositiveInteger = (value: unknown, fieldName: string) => {
  const stringValue = parseString(value);

  if (!stringValue) {
    return undefined;
  }

  const numericValue = Number(stringValue);
  if (!Number.isInteger(numericValue) || numericValue < 1) {
    throw new RecommendationServiceError(`Invalid ${fieldName}`, 400);
  }

  return numericValue;
};

const parseNumber = (value: unknown) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseStringList = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }

  return [];
};

const getSessionId = (req: Request, body?: Record<string, unknown>) =>
  parseString(req.headers['x-session-id']) ??
  parseString(req.query.sessionId) ??
  parseString(body?.sessionId);

const getMyRecommendations = async (req: Request, res: Response) => {
  try {
    const sessionId = getSessionId(req);
    const result = await recommendationService.getPersonalRecommendations({
      userId: req.user?.userId,
      sessionId,
      limit: parsePositiveInteger(req.query.limit, 'limit'),
    });
    await recommendationService.registerRecommendationRequestBestEffort({
      response: result,
      context: 'home',
      userId: req.user?.userId,
      sessionId,
    });

    return ok(res, result);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const getSimilarProducts = async (req: Request, res: Response) => {
  try {
    const productId = parseString(req.params.productId);

    if (!productId) {
      return errorResponse(res, 'productId is required', 400);
    }

    const sessionId = getSessionId(req);
    const result = await recommendationService.getSimilarRecommendations({
      productId,
      limit: parsePositiveInteger(req.query.limit, 'limit'),
    });
    await recommendationService.registerRecommendationRequestBestEffort({
      response: result,
      context: 'product_detail_similar',
      sourceProductId: productId,
      userId: req.user?.userId,
      sessionId,
    });

    return ok(res, result);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const getCartRecommendations = async (req: Request, res: Response) => {
  try {
    if (!req.user?.userId) {
      return errorResponse(res, 'Authentication required', 401);
    }

    const sessionId = getSessionId(req);
    const result = await recommendationService.getCartRecommendations({
      userId: req.user.userId,
      limit: parsePositiveInteger(req.query.limit, 'limit'),
    });
    await recommendationService.registerRecommendationRequestBestEffort({
      response: result,
      context: 'cart',
      userId: req.user.userId,
      sessionId,
    });

    return ok(res, result);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const previewRecommendations = async (req: Request, res: Response) => {
  try {
    const mode = parseString(req.query.mode);
    const userId = parseString(req.query.userId);
    const productId = parseString(req.query.productId);
    const limit = parsePositiveInteger(req.query.limit, 'limit');

    if (mode === 'similar' || (!mode && productId)) {
      if (!productId) {
        return errorResponse(res, 'productId is required for similar preview', 400);
      }

      return ok(res, await recommendationService.getSimilarRecommendations({ productId, limit }));
    }

    if (mode === 'cart') {
      if (!userId) {
        return errorResponse(res, 'userId is required for cart preview', 400);
      }

      return ok(res, await recommendationService.getCartRecommendations({ userId, limit }));
    }

    if (!userId) {
      return errorResponse(res, 'userId or productId is required', 400);
    }

    return ok(res, await recommendationService.getPersonalRecommendations({ userId, limit }));
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const getRecommendationAnalytics = async (req: Request, res: Response) => {
  try {
    return ok(res, await recommendationAnalyticsService.getRecommendationAnalytics(req.query));
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const createRecommendationEvent = async (req: Request, res: Response) => {
  try {
    const body = isRecord(req.body) ? req.body : {};
    const input: RecommendationEventInput = {
      userId: req.user?.userId,
      sessionId: getSessionId(req, body),
      context: parseString(body.context) as RecommendationEventInput['context'],
      sourceProductId: parseString(body.sourceProductId),
      recommendedProductId: parseString(body.recommendedProductId) ?? '',
      algorithmVersion: parseString(body.algorithmVersion),
      score: parseNumber(body.score),
      rank: parsePositiveInteger(body.rank, 'rank'),
      reasonCodes: parseStringList(body.reasonCodes),
      eventType: parseString(body.eventType) as RecommendationEventInput['eventType'],
      requestId: parseString(body.requestId) ?? '',
    };

    if (!input.context || !input.eventType || !input.recommendedProductId || !input.requestId) {
      return errorResponse(res, 'context, eventType, recommendedProductId, and requestId are required', 400);
    }

    const result = await recommendationService.recordRecommendationEvent(input);
    return created(res, result);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

export {
  createRecommendationEvent,
  getCartRecommendations,
  getMyRecommendations,
  getRecommendationAnalytics,
  getSimilarProducts,
  previewRecommendations,
};
