import { Schema, model, models, type Document, type Types } from 'mongoose';

export type LoyaltyPointHistoryType = 'earn' | 'redeem' | 'adjust';
export type LoyaltyPointHistoryActorRole = 'user' | 'admin' | 'staff' | 'system';

export interface ILoyaltyPointHistory extends Document {
  userId: Types.ObjectId;
  orderId?: Types.ObjectId | null;
  type: LoyaltyPointHistoryType;
  delta: number;
  balanceAfter: number;
  reason: string;
  actorId?: Types.ObjectId | null;
  actorRole: LoyaltyPointHistoryActorRole;
  createdAt: Date;
  updatedAt: Date;
}

const loyaltyPointHistorySchema = new Schema<ILoyaltyPointHistory>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', default: null },
    type: {
      type: String,
      enum: ['earn', 'redeem', 'adjust'],
      required: true,
    },
    delta: {
      type: Number,
      required: true,
      validate: {
        validator: (value: number) => Number.isInteger(value) && value !== 0,
        message: 'delta must be a non-zero integer',
      },
    },
    balanceAfter: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: (value: number) => Number.isInteger(value) && value >= 0,
        message: 'balanceAfter must be an integer greater than or equal to 0',
      },
    },
    reason: { type: String, required: true, trim: true, minlength: 2, maxlength: 200 },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    actorRole: {
      type: String,
      enum: ['user', 'admin', 'staff', 'system'],
      required: true,
      default: 'system',
    },
  },
  { timestamps: true, collection: 'loyalty_point_histories' },
);

loyaltyPointHistorySchema.index({ userId: 1, createdAt: -1 });
loyaltyPointHistorySchema.index({ orderId: 1, type: 1 });

export const LoyaltyPointHistory =
  models.LoyaltyPointHistory || model<ILoyaltyPointHistory>('LoyaltyPointHistory', loyaltyPointHistorySchema);
