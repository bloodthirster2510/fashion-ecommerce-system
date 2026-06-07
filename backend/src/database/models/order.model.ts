import { Schema, model, models, type Document, type Types } from 'mongoose';

export type OrderStatus =
  | 'confirmed'
  | 'packed'
  | 'shipping'
  | 'delivered'
  | 'cancelled'
  | 'return_requested'
  | 'returned';

export type OrderPaymentMethod = 'COD' | 'VNPAY' | 'MOMO' | 'CARD' | 'BANK';
export type OrderPaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

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
}

export interface IOrder extends Document {
  orderCode: string;
  invoiceCode?: string | null;
  user_id: Types.ObjectId;
  order_list: IOrderItem[];
  subTotal: number;
  shippingFee: number;
  couponCode?: string | null;
  couponId?: Types.ObjectId | null;
  couponDiscountAmount: number;
  shippingDiscountAmount: number;
  membershipDiscountAmount: number;
  taxAmount: number;
  totalAmount: number;
  status: OrderStatus;
  paymentMethod: OrderPaymentMethod;
  paymentStatus: OrderPaymentStatus;
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
  },
  { _id: false },
);

const orderSchema = new Schema<IOrder>(
  {
    orderCode: { type: String, required: true, unique: true, trim: true, uppercase: true, maxlength: 40 },
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
    couponDiscountAmount: { type: Number, required: true, default: 0, min: 0 },
    shippingDiscountAmount: { type: Number, required: true, default: 0, min: 0 },
    membershipDiscountAmount: { type: Number, required: true, default: 0, min: 0 },
    taxAmount: { type: Number, required: true, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['confirmed', 'packed', 'shipping', 'delivered', 'cancelled', 'return_requested', 'returned'],
      required: true,
      default: 'confirmed',
    },
    paymentMethod: {
      type: String,
      enum: ['COD', 'VNPAY', 'MOMO', 'CARD', 'BANK'],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      required: true,
      default: 'pending',
    },
    shipping: { type: orderShippingSchema, default: {} },
    shippingAddress: { type: shippingAddressSchema, required: true },
    orderNote: { type: String, trim: true, default: null, maxlength: 500 },
  },
  { timestamps: true },
);

orderSchema.index({ orderCode: 1 }, { unique: true });
orderSchema.index({ user_id: 1, createdAt: -1 });
orderSchema.index({ status: 1, paymentMethod: 1, createdAt: -1 });

export const Order = models.Order || model<IOrder>('Order', orderSchema);
