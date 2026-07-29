import type { Request, Response } from 'express';
import { created, error as errorResponse, ok } from '../../utils/response';
import type { SearchHistorySource, SearchHistoryType } from '../../database/models';
import {
  SearchHistoryServiceError,
  searchHistoryService,
} from './search-history.service';
import type {
  RecordSearchHistoryInput,
  SearchHistoryResultProductInput,
} from './search-history.types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseString = (value: unknown) => {
  if (Array.isArray(value)) return parseString(value[0]);
  if (typeof value !== 'string') return undefined;
  return value.trim() || undefined;
};

const parseNumber = (value: unknown) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim()) return Number(value);
  return undefined;
};

const getSessionId = (req: Request, body: Record<string, unknown>) =>
  parseString(req.headers['x-session-id']) ??
  parseString(req.query.sessionId) ??
  parseString(body.sessionId);

const parseResultProducts = (value: unknown): SearchHistoryResultProductInput[] => {
  if (!Array.isArray(value)) return [];

  return value.filter(isRecord).map((item) => ({
    productId: parseString(item.productId) ?? '',
    variantId: parseString(item.variantId),
    colorVariantId: parseString(item.colorVariantId),
    score: parseNumber(item.score) ?? Number.NaN,
  }));
};

const getErrorResponse = (error: unknown) => {
  if (error instanceof SearchHistoryServiceError) {
    return { statusCode: error.statusCode, message: error.message };
  }

  console.error('Search history controller error:', error);
  return { statusCode: 500, message: 'Internal Server Error' };
};

const createSearchHistory = async (req: Request, res: Response) => {
  try {
    const body = isRecord(req.body) ? req.body : {};
    const searchType = parseString(body.searchType) as SearchHistoryType | undefined;

    if (!searchType) {
      return errorResponse(res, 'searchType is required', 400);
    }

    const input: RecordSearchHistoryInput = {
      userId: req.user?.userId,
      sessionId: getSessionId(req, body),
      eventId: parseString(body.eventId),
      source: parseString(body.source) as SearchHistorySource | undefined,
      searchType,
      keyword: parseString(body.keyword),
      imageUrl: parseString(body.imageUrl),
      resultProducts: parseResultProducts(body.resultProducts),
      resultCount: parseNumber(body.resultCount),
    };

    return created(res, await searchHistoryService.recordSearch(input));
  } catch (error) {
    const { statusCode, message } = getErrorResponse(error);
    return errorResponse(res, message, statusCode);
  }
};

const getMySearchHistory = async (req: Request, res: Response) => {
  try {
    if (!req.user?.userId) {
      return errorResponse(res, 'Authentication required', 401);
    }

    const limit = parseNumber(req.query.limit);
    const searchType = parseString(req.query.searchType) as SearchHistoryType | undefined;
    const history = await searchHistoryService.listSearchHistory({
      userId: req.user.userId,
      limit,
      searchType,
    });

    return ok(res, history);
  } catch (error) {
    const { statusCode, message } = getErrorResponse(error);
    return errorResponse(res, message, statusCode);
  }
};

const syncMySearchHistory = async (req: Request, res: Response) => {
  try {
    if (!req.user?.userId) {
      return errorResponse(res, 'Authentication required', 401);
    }

    const body = isRecord(req.body) ? req.body : {};
    return ok(
      res,
      await searchHistoryService.syncSearchHistory({
        userId: req.user.userId,
        sessionId: getSessionId(req, body),
        limit: parseNumber(req.query.limit),
      }),
    );
  } catch (error) {
    const { statusCode, message } = getErrorResponse(error);
    return errorResponse(res, message, statusCode);
  }
};

const deleteMySearchHistory = async (req: Request, res: Response) => {
  try {
    if (!req.user?.userId) {
      return errorResponse(res, 'Authentication required', 401);
    }

    return ok(
      res,
      await searchHistoryService.deleteSearchHistory({
        userId: req.user.userId,
        keyword: parseString(req.query.keyword),
      }),
    );
  } catch (error) {
    const { statusCode, message } = getErrorResponse(error);
    return errorResponse(res, message, statusCode);
  }
};

export {
  createSearchHistory,
  deleteMySearchHistory,
  getMySearchHistory,
  syncMySearchHistory,
};
