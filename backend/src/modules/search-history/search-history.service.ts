import { Types } from 'mongoose';
import {
  SEARCH_HISTORY_TYPES,
  SearchHistory,
  getSearchHistoryMaxResultProducts,
  type SearchHistoryType,
} from '../../database/models';
import type {
  ListSearchHistoryInput,
  RecordSearchHistoryInput,
  SearchHistoryResultProductInput,
  TopSearchKeywordsInput,
} from './search-history.types';

export class SearchHistoryServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'SearchHistoryServiceError';
  }
}

const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 100;
const DEFAULT_TOP_KEYWORD_LIMIT = 20;

export const isSearchHistoryEnabled = () =>
  process.env.SEARCH_HISTORY_ENABLED !== 'false';

const isSearchHistoryType = (value: string): value is SearchHistoryType =>
  SEARCH_HISTORY_TYPES.includes(value as SearchHistoryType);

const toObjectId = (value: string, fieldName: string) => {
  if (!Types.ObjectId.isValid(value)) {
    throw new SearchHistoryServiceError(`Invalid ${fieldName}`, 400);
  }

  return new Types.ObjectId(value);
};

const normalizeSessionId = (value?: string | null) => {
  const sessionId = value?.trim();

  if (sessionId && sessionId.length > 128) {
    throw new SearchHistoryServiceError('Invalid sessionId', 400);
  }

  return sessionId || null;
};

const normalizeOptionalText = (
  value: string | null | undefined,
  fieldName: string,
  maxLength: number,
) => {
  const normalized = value?.trim().replace(/\s+/g, ' ');

  if (normalized && normalized.length > maxLength) {
    throw new SearchHistoryServiceError(`Invalid ${fieldName}`, 400);
  }

  return normalized || null;
};

const normalizeScore = (value: number) => {
  if (!Number.isFinite(value)) {
    throw new SearchHistoryServiceError('Invalid result product score', 400);
  }

  return Math.min(1, Math.max(0, value));
};

const normalizeResultProduct = (
  item: SearchHistoryResultProductInput,
) => ({
  productId: toObjectId(item.productId, 'resultProducts.productId'),
  variantId: item.variantId
    ? toObjectId(item.variantId, 'resultProducts.variantId')
    : null,
  colorVariantId: item.colorVariantId
    ? toObjectId(item.colorVariantId, 'resultProducts.colorVariantId')
    : null,
  score: normalizeScore(item.score),
});

const clampLimit = (value: number | undefined, fallback: number) => {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < 1) {
    throw new SearchHistoryServiceError('Invalid limit', 400);
  }
  return Math.min(value, MAX_LIST_LIMIT);
};

const recordSearch = async (input: RecordSearchHistoryInput) => {
  if (!isSearchHistoryEnabled()) {
    return { recorded: false, skippedReason: 'tracking_disabled' as const };
  }

  if (!isSearchHistoryType(input.searchType)) {
    throw new SearchHistoryServiceError('Invalid searchType', 400);
  }

  const userId = input.userId ? toObjectId(input.userId, 'userId') : null;
  const sessionId = normalizeSessionId(input.sessionId);

  if (!userId && !sessionId) {
    throw new SearchHistoryServiceError('userId or sessionId is required', 400);
  }

  const keyword = normalizeOptionalText(input.keyword, 'keyword', 100);
  const imageUrl = normalizeOptionalText(input.imageUrl, 'imageUrl', 500);

  if (input.searchType === 'keyword' && !keyword) {
    throw new SearchHistoryServiceError('keyword is required for keyword search', 400);
  }

  if (input.searchType === 'image' && !imageUrl) {
    throw new SearchHistoryServiceError('imageUrl is required for image search', 400);
  }

  const resultProducts = (input.resultProducts ?? [])
    .slice(0, getSearchHistoryMaxResultProducts())
    .map(normalizeResultProduct);
  const resultCount = input.resultCount ?? resultProducts.length;

  if (!Number.isInteger(resultCount) || resultCount < 0) {
    throw new SearchHistoryServiceError('Invalid resultCount', 400);
  }

  const history = await SearchHistory.create({
    userId,
    sessionId,
    searchType: input.searchType,
    keyword,
    imageUrl,
    resultProducts,
    resultCount,
  });

  return {
    recorded: true,
    searchHistoryId: history._id.toString(),
  };
};

const recordSearchBestEffort = async (
  input: RecordSearchHistoryInput,
  context = 'Failed to record search history',
) => {
  try {
    return await recordSearch(input);
  } catch (error) {
    console.warn(`${context}:`, error);
    return null;
  }
};

const listSearchHistory = async (input: ListSearchHistoryInput) => {
  const userId = toObjectId(input.userId, 'userId');
  const limit = clampLimit(input.limit, DEFAULT_LIST_LIMIT);
  const filter: Record<string, unknown> = { userId };

  if (input.searchType) {
    if (!isSearchHistoryType(input.searchType)) {
      throw new SearchHistoryServiceError('Invalid searchType', 400);
    }
    filter.searchType = input.searchType;
  }

  return SearchHistory.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
};

const getTopKeywords = async (input: TopSearchKeywordsInput = {}) => {
  const limit = clampLimit(input.limit, DEFAULT_TOP_KEYWORD_LIMIT);
  const createdAt = input.since ? { $gte: input.since } : undefined;

  return SearchHistory.aggregate<{
    keyword: string;
    count: number;
    lastSearchedAt: Date;
  }>([
    {
      $match: {
        searchType: 'keyword',
        keyword: { $type: 'string', $ne: '' },
        ...(createdAt ? { createdAt } : {}),
      },
    },
    {
      $group: {
        _id: { $toLower: '$keyword' },
        keyword: { $first: '$keyword' },
        count: { $sum: 1 },
        lastSearchedAt: { $max: '$createdAt' },
      },
    },
    { $sort: { count: -1, lastSearchedAt: -1 } },
    { $limit: limit },
    { $project: { _id: 0, keyword: 1, count: 1, lastSearchedAt: 1 } },
  ]);
};

export const searchHistoryService = {
  recordSearch,
  recordSearchBestEffort,
  listSearchHistory,
  getTopKeywords,
};
