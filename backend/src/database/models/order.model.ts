import { Schema, model, models, type Document, type Types } from 'mongoose';
import {
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  type OrderPaymentMethod,
  type OrderPaymentStatus,
  type OrderStatus,
} from '../../modules/orders/order.constants';

export type { OrderPaymentMethod, OrderPaymentStatus, OrderStatus } from '../../modules/orders/order.constants';
export type OrderReturnRequestStatus = 'requested' | 'approved' | 'rejected';

export interface IOrderItem {
  _id: Types.ObjectId;
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  colorVariantId: Types.ObjectId;
  size: string;
  sku: string;
  name: string;
  fitType: string;
  color: string;
  image: string;
  quantity: number;
  priceAtPurchased: number;
  recommendationRequestId?: string | null;
}

export interface IOrderShippingAddress {
  customerName: string;
  province: string;
  provinceCode?: string | null;
  provinceId?: number | null;
  district?: string | null;
  districtId?: number | null;
  ward: string;
  wardCode: string;
  streetName: string;
  phoneNumber: string;
  ghnProvinceId?: number | null;
  ghnDistrictId?: number | null;
  ghnWardCode?: string | null;
  ghnMappingStatus?: 'mapped' | 'missing' | 'manual';
  ghnMappingConfidence?: 'exact' | 'manual' | 'legacy' | null;
  ghnMappingVerifiedAt?: Date | null;
}

export interface IOrderShipping {
  provider?: string | null;
  serviceId?: number | null;
  serviceTypeId?: number | null;
  customerFee?: number | null;
  quotedProviderCost?: number | null;
  actualProviderCost?: number | null;
  comparisonStatus?: 'live' | 'partial' | 'fallback' | null;
  pricingMode?: 'CHEAPEST' | 'RECOMMENDED' | 'FIXED_FALLBACK' | null;
  recommendedOptionKey?: string | null;
  selectedOptionKey?: string | null;
  quoteVersion?: string | null;
  options?: Array<Record<string, unknown>>;
  status?: string | null;
  trackingCode?: string | null;
  labelUrl?: string | null;
  estimatedDeliveryDate?: Date | null;
  rawQuote?: Record<string, unknown> | null;
  rawShipment?: Record<string, unknown> | null;
  lastWebhookEventId?: string | null;
}

export interface IOrderReturnRequest {
  reason: string;
  imageUrls?: string[];
  status: OrderReturnRequestStatus;
  previousOrderStatus?: Extract<OrderStatus, 'delivered' | 'completed'> | null;
  requestedAt: Date;
  reviewedAt?: Date | null;
  reviewedBy?: Types.ObjectId | null;
  reviewReason?: string | null;
}

export interface IOrderCancellation {
  kind?: 'customer' | 'admin' | 'shipping' | 'payment-timeout' | null;
  reason?: string | null;
  imageUrls?: string[];
  cancelledAt: Date;
  cancelledBy?: Types.ObjectId | null;
  actorRole?: 'user' | 'admin' | 'staff' | 'system' | null;
}

export interface IOrderLoyaltyRuleSnapshot {
  ruleId?: Types.ObjectId | null;
  name: string;
  spendAmount: number;
  pointsEarned: number;
  minOrderAmount: number;
  roundMode: 'floor' | 'round' | 'ceil';
}

export interface IOrder extends Document {
  idempotencyKey?: string | null;
  orderCode: string;
  invoiceCode?: string | null;
  user_id: Types.ObjectId;
  order_list: IOrderItem[];
  subTotal: number;
  shippingFee: number;
  couponCode?: string | null;
  couponId?: Types.ObjectId | null;
  couponCodes: string[];
  couponIds: Types.ObjectId[];
  promotionCampaignId?: Types.ObjectId | null;
  couponDiscountAmount: number;
  shippingDiscountAmount: number;
  appliedMembershipTierId?: Types.ObjectId | null;
  appliedMembershipDiscountPercent?: number | null;
  membershipDiscountAmount: number;
  loyaltyPointsAwarded: number;
  loyaltyPointsClawedBack: number;
  loyaltyRuleSnapshot?: IOrderLoyaltyRuleSnapshot | null;
  taxAmount: number;
  totalAmount: number;
  status: OrderStatus;
  paymentMethod: OrderPaymentMethod;
  paymentMethodId?: Types.ObjectId | null;
  paymentStatus: OrderPaymentStatus;
  paymentDeadlineAt?: Date | null;
  paymentDeadlineWarningSentAt?: Date | null;
  deliveredAt?: Date | null;
  receivedAt?: Date | null;
  returnRequest?: IOrderReturnRequest | null;
  cancellation?: IOrderCancellation | null;
  shipping: IOrderShipping;
  shippingAddress: IOrderShippingAddress;
  orderNote?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const integerMinValidator = (min: number) => ({
  validator: (value: number) => Number.isInteger(value) && value >= min,
  message: `Value must be an integer greater than or equal to ${min}`,
});

const orderItemSchema = new Schema<IOrderItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: Schema.Types.ObjectId, required: true },
    colorVariantId: { type: Schema.Types.ObjectId, required: true },
    size: { type: String, required: true, trim: true, minlength: 1, maxlength: 10 },
    sku: { type: String, required: true, trim: true, uppercase: true, minlength: 3, maxlength: 80 },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 150 },
    fitType: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    color: { type: String, required: true, trim: true, minlength: 1, maxlength: 40 },
    image: { type: String, required: true, trim: true, maxlength: 500 },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      validate: integerMinValidator(1),
    },
    priceAtPurchased: { type: Number, required: true, min: 0 },
    recommendationRequestId: { type: String, trim: true, maxlength: 120, default: null },
  },
  { _id: true },
);

const shippingAddressSchema = new Schema<IOrderShippingAddress>(
  {
    customerName: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    province: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    provinceCode: { type: String, default: null, trim: true, maxlength: 20 },
    provinceId: { type: Number, default: null, min: 1 },
    district: { type: String, default: null, trim: true, maxlength: 80 },
    districtId: { type: Number, default: null, min: 1 },
    ward: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    wardCode: { type: String, required: true, trim: true, maxlength: 20 },
    streetName: { type: String, required: true, trim: true, minlength: 5, maxlength: 150 },
    phoneNumber: { type: String, required: true, trim: true, minlength: 8, maxlength: 20 },
    ghnProvinceId: { type: Number, default: null, min: 1 },
    ghnDistrictId: { type: Number, default: null, min: 1 },
    ghnWardCode: { type: String, default: null, trim: true, maxlength: 20 },
    ghnMappingStatus: { type: String, enum: ['mapped', 'missing', 'manual'], default: 'missing' },
    ghnMappingConfidence: {
      type: String,
      enum: ['exact', 'manual', 'legacy'],
      default: null,
    },
    ghnMappingVerifiedAt: { type: Date, default: null },
  },
  { _id: false },
);

const orderShippingSchema = new Schema<IOrderShipping>(
  {
    provider: { type: String, trim: true, default: null, maxlength: 80 },
    serviceId: { type: Number, default: null, min: 1 },
    serviceTypeId: { type: Number, default: null, min: 1 },
    customerFee: { type: Number, default: null, min: 0 },
    quotedProviderCost: { type: Number, default: null, min: 0 },
    actualProviderCost: { type: Number, default: null, min: 0 },
    comparisonStatus: { type: String, enum: ['live', 'partial', 'fallback'], default: null },
    pricingMode: { type: String, enum: ['CHEAPEST', 'RECOMMENDED', 'FIXED_FALLBACK'], default: null },
    recommendedOptionKey: { type: String, trim: true, default: null, maxlength: 120 },
    selectedOptionKey: { type: String, trim: true, default: null, maxlength: 120 },
    quoteVersion: { type: String, trim: true, default: null, maxlength: 80 },
    options: { type: [Schema.Types.Mixed], default: [] },
    status: { type: String, trim: true, default: null, maxlength: 40 },
    trackingCode: { type: String, trim: true, default: null, maxlength: 100 },
    labelUrl: { type: String, trim: true, default: null, maxlength: 500 },
    estimatedDeliveryDate: { type: Date, default: null },
    rawQuote: { type: Schema.Types.Mixed, default: null },
    rawShipment: { type: Schema.Types.Mixed, default: null },
    lastWebhookEventId: { type: String, trim: true, default: null, maxlength: 128 },
  },
  { _id: false },
);

const orderReturnRequestSchema = new Schema<IOrderReturnRequest>(
  {
    reason: { type: String, required: true, trim: true, minlength: 1, maxlength: 500 },
    imageUrls: {
      type: [{ type: String, trim: true, maxlength: 500 }],
      default: undefined,
    },
    status: {
      type: String,
      enum: ['requested', 'approved', 'rejected'],
      required: true,
      default: 'requested',
    },
    previousOrderStatus: { type: String, enum: ['delivered', 'completed'], default: null },
    requestedAt: { type: Date, required: true, default: Date.now },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reviewReason: { type: String, trim: true, default: null, maxlength: 500 },
  },
  { _id: false },
);

const orderCancellationSchema = new Schema<IOrderCancellation>(
  {
    kind: { type: String, enum: ['customer', 'admin', 'shipping', 'payment-timeout'], default: null },
    reason: { type: String, trim: true, default: null, maxlength: 500 },
    imageUrls: {
      type: [{ type: String, trim: true, maxlength: 500 }],
      default: undefined,
    },
    cancelledAt: { type: Date, required: true, default: Date.now },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    actorRole: { type: String, enum: ['user', 'admin', 'staff', 'system'], default: null },
  },
  { _id: false },
);

const orderLoyaltyRuleSnapshotSchema = new Schema<IOrderLoyaltyRuleSnapshot>(
  {
    ruleId: { type: Schema.Types.ObjectId, ref: 'LoyaltyRule', default: null },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    spendAmount: { type: Number, required: true, min: 1 },
    pointsEarned: { type: Number, required: true, min: 1 },
    minOrderAmount: { type: Number, required: true, min: 0 },
    roundMode: { type: String, enum: ['floor', 'round', 'ceil'], required: true },
  },
  { _id: false },
);

const orderSchema = new Schema<IOrder>(
  {
    idempotencyKey: { type: String, trim: true, default: null, maxlength: 100 },
    orderCode: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
    invoiceCode: { type: String, trim: true, default: null, maxlength: 40 },
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    order_list: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (value: IOrderItem[]) => value.length > 0,
        message: 'Order must include at least one item',
      },
    },
    subTotal: { type: Number, required: true, min: 0 },
    shippingFee: { type: Number, required: true, default: 0, min: 0 },
    couponCode: { type: String, trim: true, default: null, maxlength: 60 },
    couponId: { type: Schema.Types.ObjectId, ref: 'Coupon', default: null },
    couponCodes: {
      type: [{ type: String, trim: true, uppercase: true, maxlength: 60 }],
      default: [],
      validate: {
        validator: (value: string[]) => value.length <= 3,
        message: 'Order can include at most 3 coupons',
      },
    },
    couponIds: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Coupon' }],
      default: [],
      validate: {
        validator: (value: Types.ObjectId[]) => value.length <= 3,
        message: 'Order can include at most 3 coupons',
      },
    },
    promotionCampaignId: { type: Schema.Types.ObjectId, ref: 'PromotionCampaign', default: null },
    couponDiscountAmount: { type: Number, required: true, default: 0, min: 0 },
    shippingDiscountAmount: { type: Number, required: true, default: 0, min: 0 },
    appliedMembershipTierId: { type: Schema.Types.ObjectId, ref: 'MembershipRanking', default: null },
    appliedMembershipDiscountPercent: { type: Number, default: null, min: 0, max: 100 },
    membershipDiscountAmount: { type: Number, required: true, default: 0, min: 0 },
    loyaltyPointsAwarded: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: integerMinValidator(0),
    },
    loyaltyPointsClawedBack: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: integerMinValidator(0),
    },
    loyaltyRuleSnapshot: { type: orderLoyaltyRuleSnapshotSchema, default: null },
    taxAmount: { type: Number, required: true, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ORDER_STATUSES,
      required: true,
      default: 'confirmed',
    },
    paymentMethod: {
      type: String,
      enum: PAYMENT_METHODS,
      required: true,
    },
    paymentMethodId: {
      type: Schema.Types.ObjectId,
      ref: 'PaymentMethod',
      default: null,
    },
    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUSES,
      required: true,
      default: 'pending',
    },
    paymentDeadlineAt: { type: Date, default: null },
    paymentDeadlineWarningSentAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    receivedAt: { type: Date, default: null },
    returnRequest: { type: orderReturnRequestSchema, default: null },
    cancellation: { type: orderCancellationSchema, default: null },
    shipping: { type: orderShippingSchema, default: {} },
    shippingAddress: { type: shippingAddressSchema, required: true },
    orderNote: { type: String, trim: true, default: null, maxlength: 500 },
  },
  { timestamps: true },
);

orderSchema.index({ orderCode: 1 }, { unique: true });
orderSchema.index(
  { user_id: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
);
orderSchema.index({ user_id: 1, createdAt: -1 });
orderSchema.index({ status: 1, paymentMethod: 1, createdAt: -1 });
orderSchema.index({ status: 1, paymentStatus: 1, paymentDeadlineAt: 1 });

export const Order = models.Order || model<IOrder>('Order', orderSchema);
