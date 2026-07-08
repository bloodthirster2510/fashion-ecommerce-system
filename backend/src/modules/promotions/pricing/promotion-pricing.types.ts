import type { Types } from 'mongoose';
import type {
  CouponDiscountType,
  ICoupon,
  ICartItem,
  OrderPaymentMethod,
} from '../../../database/models';
import type {
  ShippingAddressForQuote,
  ShippingComparisonResult,
  ShippingQuoteResult,
} from '../../shipping/shipping.types';

export interface CalculateCheckoutInput {
  userId: string;
  cartItemIds: string[];
  couponCode?: string;
  couponCodes?: string[];
  paymentMethod?: OrderPaymentMethod;
  shippingAddress?: ShippingAddressForQuote;
  shippingQuote?: ShippingQuoteResult;
  shippingComparison?: ShippingComparisonResult;
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
  recommendationRequestId?: string | null;
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
  shippingQuote: ShippingQuoteResult;
  shippingComparison: ShippingComparisonResult;
  appliedCoupon: AppliedCoupon | null;
  appliedCoupons?: AppliedCoupon[];
  appliedCampaign?: {
    campaignId: string;
    code: string;
    name: string;
  } | null;
  appliedMembership: AppliedMembership | null;
}
