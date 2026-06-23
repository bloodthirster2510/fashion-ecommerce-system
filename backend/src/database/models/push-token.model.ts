import { Schema, model, models, type Document, type Types } from 'mongoose';

export interface IPushToken extends Document {
  userId: Types.ObjectId;
  token: string;
  platform: 'ios' | 'android';
  isActive: boolean;
  lastUsedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const pushTokenSchema = new Schema<IPushToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    token: { type: String, required: true, trim: true, unique: true, maxlength: 255 },
    platform: { type: String, enum: ['ios', 'android'], required: true },
    isActive: { type: Boolean, default: true },
    lastUsedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

pushTokenSchema.index({ userId: 1, isActive: 1 });

export const PushToken = models.PushToken || model<IPushToken>('PushToken', pushTokenSchema);
