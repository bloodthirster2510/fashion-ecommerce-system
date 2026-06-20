import { Schema, model, models, type Document, type Types } from 'mongoose';

export interface IPromotionCampaign extends Document {
  code: string;
  name: string;
  description?: string | null;
  couponIds: Types.ObjectId[];
  allowCouponStacking: boolean;
  maxCouponsPerOrder: number;
  startAt: Date;
  endAt: Date;
  isActive: boolean;
  createdBy?: Types.ObjectId | null;
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const promotionCampaignSchema = new Schema<IPromotionCampaign>(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      minlength: 2,
      maxlength: 40,
      match: /^[A-Z0-9_-]+$/,
    },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    description: { type: String, trim: true, default: null, maxlength: 500 },
    couponIds: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Coupon' }],
      required: true,
      validate: {
        validator: (value: Types.ObjectId[]) => value.length > 0 && value.length <= 100,
        message: 'Campaign must include from 1 to 100 coupons',
      },
    },
    allowCouponStacking: { type: Boolean, required: true, default: false },
    maxCouponsPerOrder: { type: Number, required: true, default: 1, min: 1, max: 3 },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    isActive: { type: Boolean, required: true, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, collection: 'promotion_campaigns' },
);

promotionCampaignSchema.path('endAt').validate(function validateDateRange(this: IPromotionCampaign, value: Date) {
  return value > this.startAt;
}, 'endAt must be after startAt');

promotionCampaignSchema.path('maxCouponsPerOrder').validate(
  function validateStackingLimit(this: IPromotionCampaign, value: number) {
    return this.allowCouponStacking ? value >= 2 : value === 1;
  },
  'maxCouponsPerOrder must be 1 when stacking is disabled and at least 2 when enabled',
);

promotionCampaignSchema.index({ code: 1 }, { unique: true });
promotionCampaignSchema.index({ couponIds: 1, isActive: 1, startAt: 1, endAt: 1 });

export const PromotionCampaign = models.PromotionCampaign ||
  model<IPromotionCampaign>('PromotionCampaign', promotionCampaignSchema);
