import { Types } from 'mongoose';
import {
  SEARCH_HISTORY_SOURCES,
  SEARCH_HISTORY_TYPES,
  SearchHistory,
  getSearchHistoryMaxResultProducts,
  type SearchHistorySource,
  type SearchHistoryType,
} from '../../database/models';
import type {
  DeleteSearchHistoryInput,
  ListSearchHistoryInput,
  RecordSearchHistoryInput,
  SearchHistoryResultProductInput,
  SyncSearchHistoryInput,
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
const DEFAULT_DEDUPE_WINDOW_MS = 30_000;

export const isSearchHistoryEnabled = () =>
  process.env.SEARCH_HISTORY_ENABLED !== 'false';

const isSearchHistoryType = (value: string): value is SearchHistoryType =>
  SEARCH_HISTORY_TYPES.includes(value as SearchHistoryType);

const isSearchHistorySource = (value: string): value is SearchHistorySource =>
  SEARCH_HISTORY_SOURCES.includes(value as SearchHistorySource);

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

const normalizeEventId = (value?: string | null) => {
  const eventId = value?.trim();

  if (eventId && eventId.length > 128) {
    throw new SearchHistoryServiceError('Invalid eventId', 400);
  }

  return eventId || null;
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

const getDedupeWindowMs = () => {
  const configuredValue = Number(process.env.SEARCH_HISTORY_DEDUPE_WINDOW_MS);
  return Number.isInteger(configuredValue) && configuredValue >= 0
    ? configuredValue
    : DEFAULT_DEDUPE_WINDOW_MS;
};

const normalizeKeywordKey = (value: string) =>
  value.toLocaleLowerCase('vi-VN').trim().replace(/\s+/g, ' ');

const isDuplicateKeyError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  error.code === 11000;

const recordSearch = async (input: RecordSearchHistoryInput) => {
  if (!isSearchHistoryEnabled()) {
    return { recorded: false, skippedReason: 'tracking_disabled' as const };
  }

  if (!isSearchHistoryType(input.searchType)) {
    throw new SearchHistoryServiceError('Invalid searchType', 400);
  }

  const userId = input.userId ? toObjectId(input.userId, 'userId') : null;
  const sessionId = normalizeSessionId(input.sessionId);
  const eventId = normalizeEventId(input.eventId);
  const source = input.source ?? 'catalog';

  if (!userId && !sessionId) {
    throw new SearchHistoryServiceError('userId or sessionId is required', 400);
  }

  if (!isSearchHistorySource(source)) {
    throw new SearchHistoryServiceError('Invalid source', 400);
  }

  const keyword = normalizeOptionalText(input.keyword, 'keyword', 100);
  const keywordKey = keyword ? normalizeKeywordKey(keyword) : null;
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

  const duplicateFilter = eventId
    ? { eventId }
    : {
        ...(userId ? { userId } : { userId: null, sessionId }),
        searchType: input.searchType,
        source,
        ...(keywordKey ? { keywordKey } : { imageUrl }),
        createdAt: { $gte: new Date(Date.now() - getDedupeWindowMs()) },
      };
  const duplicate = await SearchHistory.findOne(duplicateFilter);

  if (duplicate) {
    return {
      recorded: false,
      skippedReason: 'duplicate' as const,
      searchHistoryId: duplicate._id.toString(),
    };
  }

  let history;
  try {
    history = await SearchHistory.create({
      userId,
      sessionId,
      ...(eventId ? { eventId } : {}),
      source,
      searchType: input.searchType,
      keyword,
      keywordKey,
      imageUrl,
      resultProducts,
      resultCount,
    });
  } catch (error) {
    if (eventId && isDuplicateKeyError(error)) {
      const racedDuplicate = await SearchHistory.findOne({ eventId });
      return {
        recorded: false,
        skippedReason: 'duplicate' as const,
        ...(racedDuplicate ? { searchHistoryId: racedDuplicate._id.toString() } : {}),
      };
    }

    throw error;
  }

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

const syncSearchHistory = async (input: SyncSearchHistoryInput) => {
  const userId = toObjectId(input.userId, 'userId');
  const sessionId = normalizeSessionId(input.sessionId);
  const limit = clampLimit(input.limit, DEFAULT_LIST_LIMIT);
  const migrationResult = sessionId
    ? await SearchHistory.updateMany(
        { userId: null, sessionId },
        { $set: { userId } },
      )
    : { modifiedCount: 0 };
  const keywords = await SearchHistory.aggregate<{
    keyword: string;
    lastSearchedAt: Date;
  }>([
    {
      $match: {
        userId,
        searchType: 'keyword',
        keyword: { $type: 'string', $ne: '' },
      },
    },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: { $ifNull: ['$keywordKey', { $toLower: '$keyword' }] },
        keyword: { $first: '$keyword' },
        lastSearchedAt: { $first: '$createdAt' },
      },
    },
    { $sort: { lastSearchedAt: -1 } },
    { $limit: limit },
    { $project: { _id: 0, keyword: 1, lastSearchedAt: 1 } },
  ]);

  return {
    migratedCount: migrationResult.modifiedCount ?? 0,
    keywords,
  };
};

const deleteSearchHistory = async (input: DeleteSearchHistoryInput) => {
  const userId = toObjectId(input.userId, 'userId');
  const keyword = normalizeOptionalText(input.keyword, 'keyword', 100);
  const keywordKey = keyword ? normalizeKeywordKey(keyword) : null;
  const filter: Record<string, unknown> = { userId, searchType: 'keyword' };

  if (keywordKey) {
    filter.$expr = {
      $eq: [
        {
          $toLower: {
            $trim: { input: '$keyword' },
          },
        },
        keywordKey,
      ],
    };
  }

  const result = await SearchHistory.deleteMany(filter);
  return { deletedCount: result.deletedCount ?? 0 };
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
  syncSearchHistory,
  deleteSearchHistory,
  getTopKeywords,
};
