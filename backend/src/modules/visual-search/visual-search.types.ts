import type { Types } from 'mongoose';
import type { ProductVisualGender, ProductVisualImageSource } from '../../database/models';
import type { ProductListItem } from '../catalog/products/product.types';

export type VisualEmbeddingProvider = 'http';

export type VisualEmbeddingInput = {
  text?: string;
  imageUrl?: string;
  imageBuffer?: Buffer;
  fileName?: string;
  mimeType?: string;
  imageHash?: string;
};

export type VisualEmbeddingResult = {
  embedding: number[];
  embeddingDimension: number;
  embeddingModel: string;
  embeddingVersion: string;
  provider: VisualEmbeddingProvider;
};

export type VisualGalleryItem = {
  galleryImageId: string;
  productId: Types.ObjectId;
  variantId?: Types.ObjectId | null;
  colorVariantId?: Types.ObjectId | null;
  imageUrl: string;
  imageHash: string;
  categoryId?: Types.ObjectId | null;
  brandId?: Types.ObjectId | null;
  gender?: ProductVisualGender | null;
  color?: string | null;
  price?: number | null;
  discount?: number | null;
  finalPrice?: number | null;
  isActive: boolean;
  availableQuantity: number;
  source: ProductVisualImageSource;
};

export type VisualIndexBackfillOptions = {
  activeOnly?: boolean;
  dryRun?: boolean;
  limit?: number;
};

export type VisualIndexBackfillResult = {
  dryRun: boolean;
  activeOnly: boolean;
  productCount: number;
  imageCount: number;
  indexed: number;
  staleDeactivated: number;
  failed: number;
  model: string;
  modelVersion: string;
  provider: VisualEmbeddingProvider;
  failures: Array<{
    galleryImageId: string;
    imageUrl: string;
    message: string;
  }>;
};

export type VisualIndexStatusItem = {
  galleryImageId: string;
  productId: string;
  imageUrl: string;
  source: ProductVisualImageSource;
  isActive?: boolean;
  lastSyncedAt?: string;
};

export type VisualIndexModelBreakdown = {
  model: string;
  modelVersion: string;
  activeCount: number;
  inactiveCount: number;
  lastSyncedAt?: string;
};

export type VisualIndexStatus = {
  generatedAt: string;
  provider: VisualEmbeddingProvider;
  model: string;
  modelVersion: string;
  productCount: number;
  activeProductCount: number;
  imageCount: number;
  activeImageCount: number;
  indexedImageCount: number;
  missingImageCount: number;
  staleActiveIndexCount: number;
  inactiveIndexCount: number;
  coverageRate: number;
  lastIndexedAt?: string;
  lastSyncedAt?: string;
  sourceBreakdown: Array<{
    source: ProductVisualImageSource;
    currentImageCount: number;
    indexedImageCount: number;
  }>;
  modelBreakdown: VisualIndexModelBreakdown[];
  samples: {
    missing: VisualIndexStatusItem[];
    stale: VisualIndexStatusItem[];
  };
};

export type VisualSearchImageInput = {
  buffer: Buffer;
  originalName?: string;
  mimeType?: string;
};

export type VisualSearchTextInput = {
  text: string;
};

export type VisualSearchQueryOptions = {
  limit?: number;
  categoryId?: string[];
  brandId?: string[];
  gender?: ProductVisualGender;
  color?: string[];
  size?: string[];
  minPrice?: number;
  maxPrice?: number;
  scoreThreshold?: number;
};

export type VisualSearchResultItem = ProductListItem & {
  visualScore: number;
  finalVisualScore: number;
  matchedImage: string;
  matchedGalleryImageId: string;
  matchedVariantId?: string;
  matchedColorVariantId?: string;
  matchedColor?: string | null;
  matchedSource: ProductVisualImageSource;
};

export type VisualSearchResponse = {
  items: VisualSearchResultItem[];
  pagination: {
    page: 1;
    limit: number;
    totalItems: number;
    totalPages: 1;
  };
  query: {
    searchType: 'image' | 'text';
    model: string;
    modelVersion: string;
    provider: VisualEmbeddingProvider;
    processingTimeMs: number;
    embeddingTimeMs: number;
    searchTimeMs: number;
    hydrateTimeMs: number;
    scoreThreshold: number;
    candidateCount: number;
  };
};
