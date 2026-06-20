import { Schema, model, models, type Document, type Types } from 'mongoose';

export type LoyaltyRuleRoundMode = 'floor' | 'round' | 'ceil';

export interface ILoyaltyRule extends Document {
  name: string;
  spendAmount: number;
  pointsEarned: number;
  minOrderAmount: number;
  roundMode: LoyaltyRuleRoundMode;
  startAt?: Date | null;
  endAt?: Date | null;
  isActive: boolean;
  createdBy?: Types.ObjectId | null;
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const loyaltyRuleSchema = new Schema<ILoyaltyRule>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    spendAmount: { type: Number, required: true, min: 1, max: 100000000 },
    pointsEarned: { type: Number, required: true, min: 1, max: 1000000 },
    minOrderAmount: { type: Number, required: true, default: 0, min: 0, max: 1000000000 },
    roundMode: { type: String, enum: ['floor', 'round', 'ceil'], required: true, default: 'floor' },
    startAt: { type: Date, default: null },
    endAt: { type: Date, default: null },
    isActive: { type: Boolean, required: true, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, collection: 'loyalty_rules' },
);

loyaltyRuleSchema.path('endAt').validate(function validateDateRange(this: ILoyaltyRule, value?: Date | null) {
  return !value || !this.startAt || value > this.startAt;
}, 'endAt must be after startAt');

loyaltyRuleSchema.index({ isActive: 1, startAt: 1, endAt: 1 });
loyaltyRuleSchema.index(
  { isActive: 1 },
  { unique: true, partialFilterExpression: { isActive: true }, name: 'single_active_loyalty_rule' },
);

export const LoyaltyRule = models.LoyaltyRule || model<ILoyaltyRule>('LoyaltyRule', loyaltyRuleSchema);
