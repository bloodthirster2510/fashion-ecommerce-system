import { Schema, model, models, type Document } from 'mongoose';

export interface IDistributedLock extends Document {
  name: string;
  ownerId: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const distributedLockSchema = new Schema<IDistributedLock>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120, unique: true },
    ownerId: { type: String, required: true, trim: true, maxlength: 160 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, collection: 'distributed_locks' },
);

distributedLockSchema.index({ expiresAt: 1 });

export const DistributedLock =
  models.DistributedLock || model<IDistributedLock>('DistributedLock', distributedLockSchema);
