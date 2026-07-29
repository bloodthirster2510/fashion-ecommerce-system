import type { SearchHistorySource, SearchHistoryType } from '../../database/models';

export interface SearchHistoryResultProductInput {
  productId: string;
  variantId?: string | null;
  colorVariantId?: string | null;
  score: number;
}

export interface RecordSearchHistoryInput {
  userId?: string | null;
  sessionId?: string | null;
  eventId?: string | null;
  source?: SearchHistorySource | null;
  searchType: SearchHistoryType;
  keyword?: string | null;
  imageUrl?: string | null;
  resultProducts?: SearchHistoryResultProductInput[];
  resultCount?: number;
}

export interface ListSearchHistoryInput {
  userId: string;
  limit?: number;
  searchType?: SearchHistoryType;
}

export interface TopSearchKeywordsInput {
  since?: Date;
  limit?: number;
}

export interface SyncSearchHistoryInput {
  userId: string;
  sessionId?: string | null;
  limit?: number;
}

export interface DeleteSearchHistoryInput {
  userId: string;
  keyword?: string | null;
}
