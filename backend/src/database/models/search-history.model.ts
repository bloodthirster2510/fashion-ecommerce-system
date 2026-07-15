import { Schema, model, models, type Document, type Types } from 'mongoose';

export const SEARCH_HISTORY_TYPES = ['keyword', 'image'] as const;

export type SearchHistoryType = (typeof SEARCH_HISTORY_TYPES)[number];

export const DEFAULT_SEARCH_HISTORY_TTL_SECONDS = 90 * 24 * 60 * 60;
export const DEFAULT_SEARCH_HISTORY_MAX_RESULT_PRODUCTS = 100;

const getPositiveInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const getSearchHistoryTtlSeconds = () =>
  getPositiveInteger(process.env.SEARCH_HISTORY_TTL_SECONDS, DEFAULT_SEARCH_HISTORY_TTL_SECONDS);

export const getSearchHistoryMaxResultProducts = () =>
  getPositiveInteger(
    process.env.SEARCH_HISTORY_MAX_RESULT_PRODUCTS,
    DEFAULT_SEARCH_HISTORY_MAX_RESULT_PRODUCTS,
  );

export interface ISearchHistoryResultProduct {
  productId: Types.ObjectId;
  variantId?: Types.ObjectId | null;
  colorVariantId?: Types.ObjectId | null;
  score: number;
}

export interface ISearchHistory extends Document {
  userId?: Types.ObjectId | null;
  sessionId?: string | null;
  searchType: SearchHistoryType;
  keyword?: string | null;
  imageUrl?: string | null;
  resultProducts: ISearchHistoryResultProduct[];
  resultCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const searchHistoryResultProductSchema = new Schema<ISearchHistoryResultProduct>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: Schema.Types.ObjectId, default: null },
    colorVariantId: { type: Schema.Types.ObjectId, default: null },
    score: { type: Number, required: true, min: 0, max: 1 },
  },
  { _id: false },
);

const searchHistorySchema = new Schema<ISearchHistory>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    sessionId: { type: String, trim: true, maxlength: 128, default: null },
    searchType: { type: String, enum: SEARCH_HISTORY_TYPES, required: true },
    keyword: { type: String, trim: true, maxlength: 100, default: null },
    imageUrl: { type: String, trim: true, maxlength: 500, default: null },
    resultProducts: {
      type: [searchHistoryResultProductSchema],
      default: [],
      validate: {
        validator: (value: ISearchHistoryResultProduct[]) =>
          value.length <= getSearchHistoryMaxResultProducts(),
        message: 'Search history resultProducts exceeds the configured limit',
      },
    },
    resultCount: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true },
);

searchHistorySchema.pre('validate', function validateSearchPayload() {
  if (this.searchType === 'keyword' && !this.keyword?.trim()) {
    this.invalidate('keyword', 'keyword is required for keyword search');
  }

  if (this.searchType === 'image' && !this.imageUrl?.trim()) {
    this.invalidate('imageUrl', 'imageUrl is required for image search');
  }
});

searchHistorySchema.index({ userId: 1, createdAt: -1 });
searchHistorySchema.index({ sessionId: 1, createdAt: -1 });
searchHistorySchema.index({ userId: 1, keyword: 1, createdAt: -1 });
searchHistorySchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: getSearchHistoryTtlSeconds() },
);

export const SearchHistory =
  models.SearchHistory || model<ISearchHistory>('SearchHistory', searchHistorySchema);
