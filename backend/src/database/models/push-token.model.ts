import { Schema, model, models, type Document, type Types } from 'mongoose';
import type { CustomerNotificationCategory } from './customer-notification.model';

export type PushNotificationPreferences = Partial<Record<CustomerNotificationCategory, boolean>>;

export interface IPushToken extends Document {
  userId: Types.ObjectId;
  token: string;
  platform: 'ios' | 'android';
  preferences: PushNotificationPreferences;
  isActive: boolean;
  lastUsedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const pushNotificationPreferencesSchema = new Schema(
  {
    order: { type: Boolean, default: true },
    promotion: { type: Boolean, default: true },
    support: { type: Boolean, default: true },
    account: { type: Boolean, default: true },
    virtual_try_on: { type: Boolean, default: true },
    system: { type: Boolean, default: true },
  },
  { _id: false },
);

const pushTokenSchema = new Schema<IPushToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    token: { type: String, required: true, trim: true, unique: true, maxlength: 255 },
    platform: { type: String, enum: ['ios', 'android'], required: true },
    preferences: { type: pushNotificationPreferencesSchema, default: () => ({}) },
    isActive: { type: Boolean, default: true },
    lastUsedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

pushTokenSchema.index({ userId: 1, isActive: 1 });

export const PushToken = models.PushToken || model<IPushToken>('PushToken', pushTokenSchema);
