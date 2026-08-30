import { Schema, model, models, type Document, type Types } from 'mongoose';

export interface IVirtualTryOnRuntimeConfiguration {
  enabled: boolean;
  imageProvider: 'mock' | 'comfy' | 'disabled';
  imageModel: string;
  imageAspectRatio: string;
  imageResolution: string;
  videoProvider: 'mock' | 'comfy_kling' | 'disabled';
  videoWorkflowProfile: 'budget' | 'fast' | 'balanced' | 'quality';
  videoModel: string;
  videoDurationSeconds: number;
  videoResolution: string;
  videoAspectRatio: string;
  videoGenerateAudio: boolean;
  maxConcurrentJobsPerUser: number;
  maxVideoJobsPerUserPerDay: number;
  maxConcurrentVideoJobsPerUser: number;
  promptMaxLength: number;
  promptViolationLimitPerDay: number;
}

export interface IVirtualTryOnSettingsHistory {
  version: number;
  configuration: IVirtualTryOnRuntimeConfiguration;
  changedBy?: Types.ObjectId | null;
  changedAt: Date;
}

export interface IVirtualTryOnSettings extends Document, IVirtualTryOnRuntimeConfiguration {
  key: 'virtual_try_on';
  version: number;
  history: IVirtualTryOnSettingsHistory[];
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const runtimeConfigurationFields = {
  enabled: { type: Boolean, required: true, default: true },
  imageProvider: {
    type: String,
    enum: ['mock', 'comfy', 'disabled'],
    required: true,
    default: 'mock',
  },
  imageModel: { type: String, required: true, trim: true, maxlength: 120, default: 'mock' },
  imageAspectRatio: {
    type: String,
    enum: ['1:1', '3:4', '4:3', '9:16', '16:9'],
    required: true,
    default: '3:4',
  },
  imageResolution: {
    type: String,
    enum: ['1K', '2K'],
    required: true,
    default: '2K',
  },
  videoProvider: {
    type: String,
    enum: ['mock', 'comfy_kling', 'disabled'],
    required: true,
    default: 'comfy_kling',
  },
  videoWorkflowProfile: {
    type: String,
    enum: ['budget', 'fast', 'balanced', 'quality'],
    required: true,
    default: 'quality',
  },
  videoModel: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120,
    default: 'kling-v3-omni',
  },
  videoDurationSeconds: { type: Number, required: true, min: 5, max: 12, default: 5 },
  videoResolution: {
    type: String,
    enum: ['720p', '1080p'],
    required: true,
    default: '720p',
  },
  videoAspectRatio: {
    type: String,
    enum: ['1:1', '9:16', '16:9'],
    required: true,
    default: '9:16',
  },
  videoGenerateAudio: { type: Boolean, required: true, default: false },
  maxConcurrentJobsPerUser: { type: Number, required: true, min: 1, max: 10 },
  maxVideoJobsPerUserPerDay: { type: Number, required: true, min: 1, max: 50 },
  maxConcurrentVideoJobsPerUser: { type: Number, required: true, min: 1, max: 5 },
  promptMaxLength: { type: Number, required: true, min: 50, max: 500 },
  promptViolationLimitPerDay: { type: Number, required: true, min: 1, max: 20 },
} as const;

const runtimeConfigurationSchema = new Schema<IVirtualTryOnRuntimeConfiguration>(
  runtimeConfigurationFields,
  { _id: false },
);

const settingsHistorySchema = new Schema<IVirtualTryOnSettingsHistory>(
  {
    version: { type: Number, required: true, min: 1 },
    configuration: { type: runtimeConfigurationSchema, required: true },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    changedAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false },
);

const virtualTryOnSettingsSchema = new Schema<IVirtualTryOnSettings>(
  {
    key: {
      type: String,
      enum: ['virtual_try_on'],
      required: true,
      default: 'virtual_try_on',
      unique: true,
      immutable: true,
    },
    ...runtimeConfigurationFields,
    version: { type: Number, required: true, default: 1, min: 1 },
    history: {
      type: [settingsHistorySchema],
      default: [],
      validate: {
        validator: (value: IVirtualTryOnSettingsHistory[]) => value.length <= 20,
        message: 'Virtual try-on settings history exceeds 20 snapshots',
      },
    },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false },
);

export const VirtualTryOnSettings =
  models.VirtualTryOnSettings ||
  model<IVirtualTryOnSettings>('VirtualTryOnSettings', virtualTryOnSettingsSchema);
