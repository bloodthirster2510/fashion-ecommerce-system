import type {
  CouponDiscountType,
  CouponEligibleUserType,
} from '../../../database/models';
import type { OrderPaymentMethod } from '../../../database/models';

export interface CouponListQueryInput {
  status?: 'active' | 'inactive' | 'expired' | 'upcoming';
  keyword?: string;
  page?: number;
  limit?: number;
}

export interface CreateCouponInput {
  code: string;
  name: string;
  description?: string | null;
  discountType: CouponDiscountType;
  discountValue: number;
  maxDiscountAmount?: number | null;
  minOrderAmount?: number;
  usageLimit?: number | null;
  perUserLimit?: number;
  isPublic?: boolean;
  eligibleUserTypes?: CouponEligibleUserType[];
  eligibleMembershipRanks?: string[];
  applicableProducts?: string[];
  applicableCategories?: string[];
  startAt: string | Date;
  endAt: string | Date;
  isActive?: boolean;
}

export type UpdateCouponInput = Partial<CreateCouponInput>;

export interface UpdateCouponStatusInput {
  isActive: boolean;
}

export interface ValidateCouponInput {
  couponCode: string;
  cartItemIds: string[];
  paymentMethod?: OrderPaymentMethod;
}

export interface AvailableCouponsInput {
  cartItemIds?: string[];
  paymentMethod?: OrderPaymentMethod;
}
