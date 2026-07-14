import { Schema, model, models, type Document, type Types } from 'mongoose';

export type VirtualTryOnJobStatus =
  | 'queued'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'canceled';

export type VirtualTryOnOutfitMode = 'single' | 'top_bottom' | 'full_set';
export type VirtualTryOnOutputMode = 'image' | 'image_and_video';
export type VirtualTryOnProcessingStage =
  | 'queued'
  | 'image_generation'
  | 'image_persisting'
  | 'video_generation'
  | 'video_persisting'
  | 'completed';
export type VirtualTryOnVideoStatus =
  | 'not_requested'
  | 'queued'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'canceled';
export type VirtualTryOnContextPreset =
  | 'none'
  | 'work'
  | 'casual'
  | 'party'
  | 'travel'
  | 'sport'
  | 'date'
  | 'custom';

export type VirtualTryOnItemRole =
  | 'top'
  | 'bottom'
  | 'dress'
  | 'shoes'
  | 'accessory'
  | 'outerwear';

export interface IVirtualTryOnSelectedItem {
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  colorVariantId: Types.ObjectId;
  size?: string;
  role: VirtualTryOnItemRole;
  nameSnapshot: string;
  colorSnapshot?: string;
  imageSnapshot: string;
  priceSnapshot: number;
  finalPriceSnapshot: number;
}

export interface IVirtualTryOnJob extends Document {
  userId: Types.ObjectId;
  sourceAssetId: Types.ObjectId;
  sourceImageUrlSnapshot: string;
  selectedItems: IVirtualTryOnSelectedItem[];
  outfitMode: VirtualTryOnOutfitMode;
  contextPreset: VirtualTryOnContextPreset;
  contextPrompt?: string;
  outputMode: VirtualTryOnOutputMode;
  status: VirtualTryOnJobStatus;
  progress: number;
  processingStage: VirtualTryOnProcessingStage;
  generatedImageAssetId?: Types.ObjectId | null;
  generatedImageUrl?: string | null;
  generatedImageAssetIds?: Types.ObjectId[];
  generatedImageUrls?: string[];
  generatedVideoAssetId?: Types.ObjectId | null;
  generatedVideoUrl?: string | null;
  videoStatus: VirtualTryOnVideoStatus;
  videoProgress: number;
  videoSourceImageAssetId?: Types.ObjectId | null;
  videoSourceImageUrlSnapshot?: string | null;
  videoProvider?: string | null;
  videoProviderJobId?: string | null;
  videoProviderMetadata?: Record<string, unknown>;
  videoErrorCode?: string | null;
  videoErrorMessage?: string | null;
  videoStartedAt?: Date | null;
  videoCompletedAt?: Date | null;
  provider: string;
  providerJobId?: string | null;
  providerMetadata?: Record<string, unknown>;
  errorCode?: string | null;
  errorMessage?: string | null;
  idempotencyKey?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const selectedItemSchema = new Schema<IVirtualTryOnSelectedItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: Schema.Types.ObjectId, required: true },
    colorVariantId: { type: Schema.Types.ObjectId, required: true },
    size: { type: String, trim: true, maxlength: 20 },
    role: {
      type: String,
      enum: ['top', 'bottom', 'dress', 'shoes', 'accessory', 'outerwear'],
      required: true,
    },
    nameSnapshot: { type: String, required: true, trim: true, maxlength: 180 },
    colorSnapshot: { type: String, trim: true, maxlength: 80 },
    imageSnapshot: { type: String, required: true, trim: true, maxlength: 800 },
    priceSnapshot: { type: Number, required: true, min: 0 },
    finalPriceSnapshot: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const virtualTryOnJobSchema = new Schema<IVirtualTryOnJob>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sourceAssetId: { type: Schema.Types.ObjectId, ref: 'VirtualTryOnAsset', required: true },
    sourceImageUrlSnapshot: { type: String, required: true, trim: true, maxlength: 800 },
    selectedItems: {
      type: [selectedItemSchema],
      required: true,
      validate: {
        validator: (value: IVirtualTryOnSelectedItem[]) => value.length > 0 && value.length <= 4,
        message: 'Virtual try-on job must include 1 to 4 selected items',
      },
    },
    outfitMode: {
      type: String,
      enum: ['single', 'top_bottom', 'full_set'],
      required: true,
    },
    contextPreset: {
      type: String,
      enum: ['none', 'work', 'casual', 'party', 'travel', 'sport', 'date', 'custom'],
      default: 'none',
    },
    contextPrompt: { type: String, trim: true, maxlength: 200 },
    outputMode: {
      type: String,
      enum: ['image', 'image_and_video'],
      default: 'image',
    },
    status: {
      type: String,
      enum: ['queued', 'processing', 'succeeded', 'failed', 'canceled'],
      default: 'queued',
      index: true,
    },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    processingStage: {
      type: String,
      enum: ['queued', 'image_generation', 'image_persisting', 'video_generation', 'video_persisting', 'completed'],
      default: 'queued',
    },
    generatedImageAssetId: { type: Schema.Types.ObjectId, ref: 'VirtualTryOnAsset', default: null },
    generatedImageUrl: { type: String, trim: true, maxlength: 800, default: null },
    generatedImageAssetIds: [{ type: Schema.Types.ObjectId, ref: 'VirtualTryOnAsset' }],
    generatedImageUrls: [{ type: String, trim: true, maxlength: 800 }],
    generatedVideoAssetId: { type: Schema.Types.ObjectId, ref: 'VirtualTryOnAsset', default: null },
    generatedVideoUrl: { type: String, trim: true, maxlength: 800, default: null },
    videoStatus: {
      type: String,
      enum: ['not_requested', 'queued', 'processing', 'succeeded', 'failed', 'canceled'],
      default: 'not_requested',
      index: true,
    },
    videoProgress: { type: Number, default: 0, min: 0, max: 100 },
    videoSourceImageAssetId: { type: Schema.Types.ObjectId, ref: 'VirtualTryOnAsset', default: null },
    videoSourceImageUrlSnapshot: { type: String, trim: true, maxlength: 800, default: null },
    videoProvider: { type: String, trim: true, maxlength: 80, default: null },
    videoProviderJobId: { type: String, trim: true, maxlength: 160, default: null },
    videoProviderMetadata: { type: Schema.Types.Mixed, default: {} },
    videoErrorCode: { type: String, trim: true, maxlength: 80, default: null },
    videoErrorMessage: { type: String, trim: true, maxlength: 300, default: null },
    videoStartedAt: { type: Date, default: null },
    videoCompletedAt: { type: Date, default: null },
    provider: { type: String, required: true, trim: true, maxlength: 80 },
    providerJobId: { type: String, trim: true, maxlength: 160, default: null },
    providerMetadata: { type: Schema.Types.Mixed, default: {} },
    errorCode: { type: String, trim: true, maxlength: 80, default: null },
    errorMessage: { type: String, trim: true, maxlength: 300, default: null },
    idempotencyKey: { type: String, trim: true, maxlength: 160, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

virtualTryOnJobSchema.index({ userId: 1, createdAt: -1 });
virtualTryOnJobSchema.index({ userId: 1, status: 1, createdAt: -1 });
virtualTryOnJobSchema.index({ status: 1, createdAt: 1 });
virtualTryOnJobSchema.index({ videoStatus: 1, updatedAt: 1 });
virtualTryOnJobSchema.index(
  { userId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      idempotencyKey: { $type: 'string' },
      deletedAt: null,
    },
  },
);

export const VirtualTryOnJob =
  models.VirtualTryOnJob || model<IVirtualTryOnJob>('VirtualTryOnJob', virtualTryOnJobSchema);

