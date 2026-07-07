import { Schema, model, models, type Document, type Types } from 'mongoose';

export type VirtualTryOnAssetType =
  | 'source_upload'
  | 'source_camera'
  | 'generated_image'
  | 'generated_video';

export type VirtualTryOnAssetStatus = 'active' | 'deleted';

export interface IVirtualTryOnAsset extends Document {
  userId: Types.ObjectId;
  type: VirtualTryOnAssetType;
  url: string;
  thumbnailUrl?: string;
  publicId: string;
  mimeType?: string;
  width?: number;
  height?: number;
  bytes?: number;
  source: 'upload' | 'camera' | 'ai_provider';
  status: VirtualTryOnAssetStatus;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const virtualTryOnAssetSchema = new Schema<IVirtualTryOnAsset>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: ['source_upload', 'source_camera', 'generated_image', 'generated_video'],
      required: true,
    },
    url: { type: String, required: true, trim: true, maxlength: 800 },
    thumbnailUrl: { type: String, trim: true, maxlength: 800 },
    publicId: { type: String, required: true, trim: true, maxlength: 300 },
    mimeType: { type: String, trim: true, maxlength: 80 },
    width: { type: Number, min: 0 },
    height: { type: Number, min: 0 },
    bytes: { type: Number, min: 0 },
    source: {
      type: String,
      enum: ['upload', 'camera', 'ai_provider'],
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'deleted'],
      default: 'active',
      index: true,
    },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

virtualTryOnAssetSchema.index({ userId: 1, createdAt: -1 });
virtualTryOnAssetSchema.index({ userId: 1, type: 1, createdAt: -1 });

export const VirtualTryOnAsset =
  models.VirtualTryOnAsset || model<IVirtualTryOnAsset>('VirtualTryOnAsset', virtualTryOnAssetSchema);

