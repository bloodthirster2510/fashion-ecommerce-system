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
  district: string;
  ward: string;
  streetName: string;
  phoneNumber: string;
}

export interface IOrderShipping {
  provider?: string | null;
  trackingCode?: string | null;
  labelUrl?: string | null;
  estimatedDeliveryDate?: Date | null;
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
    district: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    ward: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    streetName: { type: String, required: true, trim: true, minlength: 5, maxlength: 150 },
    phoneNumber: { type: String, required: true, trim: true, minlength: 8, maxlength: 20 },
  },
  { _id: false },
);

const orderShippingSchema = new Schema<IOrderShipping>(
  {
    provider: { type: String, trim: true, default: null, maxlength: 80 },
    trackingCode: { type: String, trim: true, default: null, maxlength: 100 },
    labelUrl: { type: String, trim: true, default: null, maxlength: 500 },
    estimatedDeliveryDate: { type: Date, default: null },
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
