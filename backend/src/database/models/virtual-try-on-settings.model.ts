import { Schema, model, models, type Document, type Types } from 'mongoose';

export interface IVirtualTryOnRuntimeConfiguration {
  enabled: boolean;
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
