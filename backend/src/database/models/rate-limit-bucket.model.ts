import { Schema, model, models, type Document } from 'mongoose';

export interface IRateLimitBucket extends Document {
  key: string;
  count: number;
  resetAt: Date;
}

const rateLimitBucketSchema = new Schema<IRateLimitBucket>(
  {
    key: { type: String, required: true, unique: true, maxlength: 200 },
    count: { type: Number, required: true, min: 1 },
    resetAt: { type: Date, required: true },
  },
  { collection: 'rate_limit_buckets', versionKey: false },
);

rateLimitBucketSchema.index({ resetAt: 1 }, { expireAfterSeconds: 0 });

export const RateLimitBucket =
  models.RateLimitBucket || model<IRateLimitBucket>('RateLimitBucket', rateLimitBucketSchema);
