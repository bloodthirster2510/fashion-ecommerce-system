import { Schema, model, models, type Document, type Types } from 'mongoose';

export type CouponDiscountType = 'percent' | 'fixed' | 'free_shipping';
export type CouponEligibleUserType = 'all' | 'new_user' | 'member';

export interface ICoupon extends Document {
  code: string;
  name: string;
  description?: string | null;
  discountType: CouponDiscountType;
  discountValue: number;
  maxDiscountAmount?: number | null;
  minOrderAmount: number;
  usageLimit?: number | null;
  usedCount: number;
  perUserLimit: number;
  isPublic: boolean;
  eligibleUserTypes: CouponEligibleUserType[];
  eligibleMembershipRanks: Types.ObjectId[];
  applicableProducts: Types.ObjectId[];
  applicableCategories: Types.ObjectId[];
  startAt: Date;
  endAt: Date;
  isActive: boolean;
  createdBy?: Types.ObjectId | null;
  updatedBy?: Types.ObjectId | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICouponUsage extends Document {
  couponId: Types.ObjectId;
  userId: Types.ObjectId;
  orderId: Types.ObjectId;
  codeSnapshot: string;
  discountTypeSnapshot: CouponDiscountType;
  discountAmount: number;
  shippingDiscountAmount: number;
  usedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const numberMinValidator = (min: number) => ({
  validator: (value: number) => Number.isFinite(value) && value >= min,
  message: `Value must be greater than or equal to ${min}`,
});

const couponSchema = new Schema<ICoupon>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      minlength: 2,
      maxlength: 40,
      match: /^[A-Z0-9_-]+$/,
    },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    description: { type: String, trim: true, default: null, maxlength: 500 },
    discountType: {
      type: String,
      enum: ['percent', 'fixed', 'free_shipping'],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
      validate: numberMinValidator(0),
    },
    maxDiscountAmount: {
      type: Number,
      default: null,
      min: 0,
    },
    minOrderAmount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: numberMinValidator(0),
    },
    usageLimit: {
      type: Number,
      default: null,
      min: 1,
    },
    usedCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: {
        validator: (value: number) => Number.isInteger(value) && value >= 0,
        message: 'usedCount must be an integer greater than or equal to 0',
      },
    },
    perUserLimit: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
      validate: {
        validator: (value: number) => Number.isInteger(value) && value >= 1,
        message: 'perUserLimit must be a positive integer',
      },
    },
    isPublic: { type: Boolean, default: true },
    eligibleUserTypes: {
      type: [String],
      enum: ['all', 'new_user', 'member'],
      default: ['all'],
      validate: {
        validator: (value: CouponEligibleUserType[]) => value.length > 0,
        message: 'eligibleUserTypes must include at least one value',
      },
    },
    eligibleMembershipRanks: {
      type: [{ type: Schema.Types.ObjectId, ref: 'MembershipRanking' }],
      default: [],
    },
    applicableProducts: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
      default: [],
    },
    applicableCategories: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
      default: [],
    },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

couponSchema.path('discountValue').validate(function validateDiscountValue(this: ICoupon, value: number) {
  if (this.discountType === 'free_shipping') {
    return value === 0;
  }

  if (this.discountType === 'percent') {
    return value > 0 && value <= 100;
  }

  return value > 0;
}, 'Invalid discountValue for discountType');

couponSchema.path('endAt').validate(function validateDateRange(this: ICoupon, value: Date) {
  return value > this.startAt;
}, 'endAt must be after startAt');

couponSchema.path('usedCount').validate(function validateUsageLimit(this: ICoupon, value: number) {
  return this.usageLimit == null || value <= this.usageLimit;
}, 'usedCount cannot be greater than usageLimit');

couponSchema.index({ code: 1 }, { unique: true });
couponSchema.index({ isActive: 1, startAt: 1, endAt: 1 });
couponSchema.index({ isPublic: 1, isActive: 1, endAt: 1 });
couponSchema.index({ applicableProducts: 1 });
couponSchema.index({ applicableCategories: 1 });

const couponUsageSchema = new Schema<ICouponUsage>(
  {
    couponId: { type: Schema.Types.ObjectId, ref: 'Coupon', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    codeSnapshot: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
    discountTypeSnapshot: {
      type: String,
      enum: ['percent', 'fixed', 'free_shipping'],
      required: true,
    },
    discountAmount: {
      type: Number,
      required: true,
      min: 0,
      validate: numberMinValidator(0),
    },
    shippingDiscountAmount: {
      type: Number,
      required: true,
      min: 0,
      validate: numberMinValidator(0),
    },
    usedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true, collection: 'coupon_usages' },
);

couponUsageSchema.index({ couponId: 1, orderId: 1 }, { unique: true });
couponUsageSchema.index({ couponId: 1, userId: 1 });
couponUsageSchema.index({ userId: 1, usedAt: -1 });

export const Coupon = models.Coupon || model<ICoupon>('Coupon', couponSchema);
export const CouponUsage =
  models.CouponUsage || model<ICouponUsage>('CouponUsage', couponUsageSchema);
