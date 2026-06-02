import type { Types } from 'mongoose';
import type {
  CouponDiscountType,
  ICoupon,
  ICartItem,
  OrderPaymentMethod,
} from '../../../database/models';

export interface CalculateCheckoutInput {
  userId: string;
  cartItemIds: string[];
  couponCode?: string;
  paymentMethod?: OrderPaymentMethod;
}

export interface CheckoutOrderItem {
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
  categoryId: Types.ObjectId;
}

export interface CheckoutCartItemSelection {
  cartItem: ICartItem;
  orderItem: CheckoutOrderItem;
  lineTotal: number;
}

export interface AppliedCoupon {
  coupon: ICoupon;
  code: string;
  discountType: CouponDiscountType;
  discountAmount: number;
  shippingDiscountAmount: number;
  eligibleSubTotal: number;
}

export interface AppliedMembership {
  tierId?: string;
  name: string;
  discountPercent: number;
  discountAmount: number;
}

export interface CheckoutPricingSummary {
  subTotal: number;
  shippingFee: number;
  couponDiscountAmount: number;
  shippingDiscountAmount: number;
  membershipDiscountAmount: number;
  taxAmount: number;
  totalAmount: number;
}

export interface CheckoutPricingResult {
  items: CheckoutOrderItem[];
  selectedCartItems: CheckoutCartItemSelection[];
  summary: CheckoutPricingSummary;
  appliedCoupon: AppliedCoupon | null;
  appliedMembership: AppliedMembership | null;
}
