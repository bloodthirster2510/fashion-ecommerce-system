import { Schema, model, models, type Document, type Types } from 'mongoose';

export interface IVirtualTryOnAccountLock extends Document {
  userId: Types.ObjectId;
  isLocked: boolean;
  reason?: string | null;
  lockedBy?: Types.ObjectId | null;
  unlockedBy?: Types.ObjectId | null;
  lockedAt?: Date | null;
  unlockedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const virtualTryOnAccountLockSchema = new Schema<IVirtualTryOnAccountLock>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    isLocked: { type: Boolean, default: true, index: true },
    reason: { type: String, trim: true, maxlength: 240, default: null },
    lockedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    unlockedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    lockedAt: { type: Date, default: null },
    unlockedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

virtualTryOnAccountLockSchema.index({ isLocked: 1, updatedAt: -1 });

export const VirtualTryOnAccountLock =
  models.VirtualTryOnAccountLock ||
  model<IVirtualTryOnAccountLock>('VirtualTryOnAccountLock', virtualTryOnAccountLockSchema);
