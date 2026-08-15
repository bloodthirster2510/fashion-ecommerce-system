import { Types } from 'mongoose';
import {
  Cart,
  Coupon,
  CouponUsage,
  MembershipRanking,
  Order,
  User,
  type ICoupon,
  type ICartItem,
  type IMembershipRanking,
} from '../../../database/models';
import {
  SalesServiceError,
  resolveSaleItem,
  toIdString,
  toObjectId,
} from '../../sales/sales.helpers';
import { shippingQuoteService } from '../../shipping/shipping-quote.service';
import type {
  AppliedCoupon,
  CalculateCheckoutInput,
  CheckoutCartItemSelection,
  CheckoutPricingResult,
} from './promotion-pricing.types';
import { promotionCampaignService } from '../campaigns/promotion-campaign.service';

export class PromotionPricingError extends Error {
  public readonly errorCode?: string;
  public readonly data?: Record<string, unknown>;

  constructor(
    message: string,
    public readonly statusCode: number,
    options?: {
      errorCode?: string;
      data?: Record<string, unknown>;
    },
  ) {
    super(message);
    this.name = 'PromotionPricingError';
    this.errorCode = options?.errorCode;
    this.data = options?.data;
  }
}

// export const FREE_SHIPPING_MINIMUM = 399000;

const normalizeCouponCode = (value?: string) => value?.trim().toUpperCase() || undefined;

const normalizeCouponCodes = (input: { couponCode?: string; couponCodes?: string[] }) => {
  const codes = [input.couponCode, ...(input.couponCodes ?? [])]
    .map((code) => normalizeCouponCode(code))
    .filter((code): code is string => Boolean(code));
  const uniqueCodes = Array.from(new Set(codes));
  if (uniqueCodes.length > 3) {
    throw new PromotionPricingError('A maximum of 3 coupon codes can be applied', 400);
  }
  return uniqueCodes;
};

const isSameId = (
  left: Types.ObjectId | string | { toString(): string } | null | undefined,
  right: Types.ObjectId | string | { toString(): string } | null | undefined,
) => toIdString(left) === toIdString(right);

const assertCartItemIds = (cartItemIds: string[]) => {
  if (!cartItemIds?.length) {
    throw new PromotionPricingError('cartItemIds is required', 400);
  }

  cartItemIds.forEach((itemId) => {
    if (!Types.ObjectId.isValid(itemId)) {
      throw new PromotionPricingError('Invalid cart item id', 400);
    }
  });
};

const getCartItemsForCheckout = async (userId: string, cartItemIds: string[]) => {
  assertCartItemIds(cartItemIds);

  const cart = await Cart.findOne({ user_id: toObjectId(userId, 'userId') });
  if (!cart) {
    throw new PromotionPricingError('Cart not found', 404);
  }

  const itemIdSet = new Set(cartItemIds);
  const items = cart.product_list.filter((item: ICartItem) => itemIdSet.has(toIdString(item._id)));

  if (items.length !== itemIdSet.size) {
    throw new PromotionPricingError('One or more cart items were not found', 404);
  }

  return items;
};

const buildCheckoutSelections = async (items: ICartItem[]): Promise<CheckoutCartItemSelection[]> => {
  return Promise.all(
    items.map(async (item) => {
      const resolved = await resolveSaleItem(
        toIdString(item.productId),
        toIdString(item.variantId),
        toIdString(item.colorVariantId),
        item.size,
        item.quantity,
      );

      const orderItem = {
        productId: resolved.productId,
        variantId: resolved.variantId,
        colorVariantId: resolved.colorVariantId,
        size: resolved.size,
        sku: resolved.sku,
        name: resolved.product.name,
        fitType: resolved.fitType,
        color: resolved.color.color,
        image: resolved.image,
        quantity: item.quantity,
        priceAtPurchased: resolved.finalPrice,
        categoryId: resolved.product.category_id,
        recommendationRequestId: item.recommendationRequestId ?? null,
      };

      return {
        cartItem: item,
        orderItem,
        lineTotal: item.quantity * resolved.finalPrice,
      };
    }),
  );
};

const getUserOrThrow = async (userId: string) => {
  const user = await User.findById(userId).select('loyaltyPoint membership createdAt');
  if (!user) {
    throw new PromotionPricingError('User not found', 404);
  }

  return user;
};

const getCurrentMembershipTier = async (loyaltyPoint: number) => {
  const tiers = await MembershipRanking.find({ isActive: true }).sort({ level: 1 });
  if (!tiers.length) {
    return null;
  }

  let currentTier: IMembershipRanking | null = null;
  for (let i = tiers.length - 1; i >= 0; i -= 1) {
    if (loyaltyPoint >= tiers[i].minPoint) {
      currentTier = tiers[i];
      break;
    }
  }

  return currentTier;
};

const assertCouponTimeWindow = (coupon: ICoupon, now: Date) => {
  if (!coupon.isActive || coupon.deletedAt) {
    throw new PromotionPricingError('Coupon is not available', 400);
  }

  if (coupon.startAt > now || coupon.endAt < now) {
    throw new PromotionPricingError('Coupon is not available', 400);
  }
};

const assertCouponUsageLimit = (coupon: ICoupon) => {
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    throw new PromotionPricingError('Coupon usage limit reached', 409, {
      errorCode: 'COUPON_USAGE_LIMIT_REACHED',
      data: { couponCode: coupon.code },
    });
  }
};

const getUserOrderCount = (userId: string) => {
  return Order.countDocuments({ user_id: toObjectId(userId, 'userId') });
};

const assertCouponUserEligibility = async (
  coupon: ICoupon,
  userId: string,
  currentTier: IMembershipRanking | null,
) => {
  const eligibleUserTypes = coupon.eligibleUserTypes?.length ? coupon.eligibleUserTypes : ['all'];

  const checks: Promise<boolean>[] = [];

  if (!eligibleUserTypes.includes('all')) {
    if (eligibleUserTypes.includes('new_user')) {
      checks.push(getUserOrderCount(userId).then((count) => count === 0));
    }

    if (eligibleUserTypes.includes('member')) {
      checks.push(Promise.resolve(Boolean(currentTier)));
    }

    const allowed = (await Promise.all(checks)).some(Boolean);
    if (!allowed) {
      throw new PromotionPricingError('Coupon is not available for this user', 400);
    }
  }

  if (coupon.eligibleMembershipRanks.length) {
    const currentTierId = toIdString(currentTier?._id);
    const rankAllowed = coupon.eligibleMembershipRanks.some((rankId) => toIdString(rankId) === currentTierId);
    if (!rankAllowed) {
      throw new PromotionPricingError('Coupon is not available for this membership rank', 400);
    }
  }
};

const getReservedCouponUsageForUser = (coupon: ICoupon, userId: string) => {
  const userUsageCounts = coupon.userUsageCounts as Map<string, number> | Record<string, number> | undefined;
  if (!userUsageCounts) {
    return 0;
  }

  const rawValue = typeof (userUsageCounts as Map<string, number>).get === 'function'
    ? (userUsageCounts as Map<string, number>).get(userId)
    : (userUsageCounts as Record<string, number>)[userId];
  const value = Number(rawValue ?? 0);

  return Number.isFinite(value) ? Math.max(0, value) : 0;
};

const couponHasScope = (coupon: ICoupon) => coupon.applicableProducts.length > 0 || coupon.applicableCategories.length > 0;

const assertCouponPerUserLimit = async (coupon: ICoupon, userId: string) => {
  const completedUsageByUser = await CouponUsage.countDocuments({
    couponId: coupon._id,
    userId: toObjectId(userId, 'userId'),
  });
  const usedByUser = Math.max(completedUsageByUser, getReservedCouponUsageForUser(coupon, userId));

  if (usedByUser >= coupon.perUserLimit) {
    throw new PromotionPricingError('Coupon per-user limit reached', 409, {
      errorCode: 'COUPON_PER_USER_LIMIT_REACHED',
      data: { couponCode: coupon.code },
    });
  }
};

const getCouponEligibleSubtotal = (
  coupon: ICoupon,
  selections: CheckoutCartItemSelection[],
) => {
  const hasProductScope = coupon.applicableProducts.length > 0;
  const hasCategoryScope = coupon.applicableCategories.length > 0;

  if (!hasProductScope && !hasCategoryScope) {
    return selections.reduce((sum, item) => sum + item.lineTotal, 0);
  }

  return selections
    .filter(({ orderItem }) => {
      const productMatched =
        hasProductScope && coupon.applicableProducts.some((productId) => isSameId(productId, orderItem.productId));
      const categoryMatched =
        hasCategoryScope && coupon.applicableCategories.some((categoryId) => isSameId(categoryId, orderItem.categoryId));

      return productMatched || categoryMatched;
    })
    .reduce((sum, item) => sum + item.lineTotal, 0);
};

const calculateCouponDiscount = (
  coupon: ICoupon,
  eligibleSubTotal: number,
  shippingFee: number,
  automaticShippingDiscount: number,
) => {
  if (coupon.discountType === 'free_shipping') {
    return {
      couponDiscountAmount: 0,
      couponShippingDiscountAmount: Math.max(0, shippingFee - automaticShippingDiscount),
    };
  }

  if (coupon.discountType === 'percent') {
    const rawDiscount = Math.round(eligibleSubTotal * (coupon.discountValue / 100));
    return {
      couponDiscountAmount:
        coupon.maxDiscountAmount != null ? Math.min(rawDiscount, coupon.maxDiscountAmount) : rawDiscount,
      couponShippingDiscountAmount: 0,
    };
  }

  const fixedDiscountAmount = Math.min(coupon.discountValue, eligibleSubTotal);

  return {
    couponDiscountAmount:
      coupon.maxDiscountAmount != null ? Math.min(fixedDiscountAmount, coupon.maxDiscountAmount) : fixedDiscountAmount,
    couponShippingDiscountAmount: 0,
  };
};

const getCouponByCode = async (couponCode: string) => {
  const coupon = await Coupon.findOne({ code: couponCode, deletedAt: null });
  if (!coupon) {
    throw new PromotionPricingError('Coupon not found', 404);
  }

  return coupon;
};

const applyCoupon = async (input: {
  userId: string;
  couponCode?: string;
  selections: CheckoutCartItemSelection[];
  subTotal: number;
  shippingFee: number;
  automaticShippingDiscount: number;
  currentTier: IMembershipRanking | null;
}): Promise<AppliedCoupon | null> => {
  const code = normalizeCouponCode(input.couponCode);
  if (!code) {
    return null;
  }

  const coupon = await getCouponByCode(code);
  assertCouponTimeWindow(coupon, new Date());
  assertCouponUsageLimit(coupon);
  await assertCouponUserEligibility(coupon, input.userId, input.currentTier);
  await assertCouponPerUserLimit(coupon, input.userId);

  const eligibleSubTotal = getCouponEligibleSubtotal(coupon, input.selections);
  if (eligibleSubTotal <= 0) {
    throw new PromotionPricingError('Coupon does not apply to selected items', 400);
  }

  const minimumBaseAmount = couponHasScope(coupon) ? eligibleSubTotal : input.subTotal;
  if (minimumBaseAmount < coupon.minOrderAmount) {
    throw new PromotionPricingError('Order does not meet coupon minimum amount', 400);
  }

  const { couponDiscountAmount, couponShippingDiscountAmount } = calculateCouponDiscount(
    coupon,
    eligibleSubTotal,
    input.shippingFee,
    input.automaticShippingDiscount,
  );

  return {
    coupon,
    code,
    discountType: coupon.discountType,
    discountAmount: couponDiscountAmount,
    shippingDiscountAmount: couponShippingDiscountAmount,
    eligibleSubTotal,
  };
};

const calculateCheckout = async (input: CalculateCheckoutInput): Promise<CheckoutPricingResult> => {
  if (
    input.paymentMethod &&
    input.paymentMethod !== 'COD' &&
    input.paymentMethod !== 'VNPAY'
  ) {
    throw new SalesServiceError(
      `Payment method ${input.paymentMethod} is not supported in this phase. Supported: COD, VNPAY`,
      400,
    );
  }

  const cartItems = await getCartItemsForCheckout(input.userId, input.cartItemIds);
  const selections = await buildCheckoutSelections(cartItems);
  const subTotal = selections.reduce((sum, item) => sum + item.lineTotal, 0);
  const shippingComparison = input.shippingComparison ?? await shippingQuoteService.compareCheckout({
    shippingAddress: input.shippingAddress,
    items: selections.map((selection) => ({
      name: selection.orderItem.name,
      quantity: selection.orderItem.quantity,
      price: selection.orderItem.priceAtPurchased,
    })),
  });
  const shippingQuote = shippingComparison.shippingQuote;
  const shippingFee = shippingQuote.fee;
  const automaticShippingDiscount = 0;
  const user = await getUserOrThrow(input.userId);
  const currentTier = await getCurrentMembershipTier(user.loyaltyPoint ?? 0);
  const couponCodes = normalizeCouponCodes(input);
  const rawAppliedCoupons = await Promise.all(couponCodes.map((couponCode) => applyCoupon({
    userId: input.userId,
    couponCode,
    selections,
    subTotal,
    shippingFee,
    automaticShippingDiscount,
    currentTier,
  }))) as AppliedCoupon[];
  let stackingCampaign = null;
  if (rawAppliedCoupons.length > 1) {
    if (rawAppliedCoupons.filter((coupon) => coupon.discountType === 'free_shipping').length > 1) {
      throw new PromotionPricingError('Only one free-shipping coupon can be stacked', 409);
    }
    stackingCampaign = await promotionCampaignService.findStackingCampaignForCoupons(
      rawAppliedCoupons.map((coupon) => coupon.coupon._id),
    );
    if (!stackingCampaign) {
      throw new PromotionPricingError('These coupons cannot be stacked together', 409);
    }
  }

  let remainingProductDiscount = subTotal;
  let remainingShippingDiscount = Math.max(0, shippingFee - automaticShippingDiscount);
  const appliedCoupons = rawAppliedCoupons.map((coupon) => {
    const discountAmount = Math.min(coupon.discountAmount, remainingProductDiscount);
    const shippingDiscountAmount = Math.min(coupon.shippingDiscountAmount, remainingShippingDiscount);
    remainingProductDiscount -= discountAmount;
    remainingShippingDiscount -= shippingDiscountAmount;
    return { ...coupon, discountAmount, shippingDiscountAmount };
  });
  const appliedCoupon = appliedCoupons[0] ?? null;
  const couponDiscountAmount = appliedCoupons.reduce((sum, coupon) => sum + coupon.discountAmount, 0);
  const shippingDiscountAmount = Math.min(
    shippingFee,
    automaticShippingDiscount + appliedCoupons.reduce((sum, coupon) => sum + coupon.shippingDiscountAmount, 0),
  );
  const membershipBaseAmount = Math.max(0, subTotal - couponDiscountAmount);
  const appliedMembership = currentTier
    ? {
        tierId: toIdString(currentTier._id),
        name: currentTier.name,
        discountPercent: currentTier.discountPercent,
        discountAmount:
          currentTier.discountPercent > 0
            ? Math.min(
                membershipBaseAmount,
                Math.round(membershipBaseAmount * (currentTier.discountPercent / 100)),
              )
            : 0,
      }
    : null;
  const membershipDiscountAmount = appliedMembership?.discountAmount ?? 0;
  const taxAmount = 0;
  const totalAmount = Math.max(
    0,
    subTotal + shippingFee + taxAmount - couponDiscountAmount - shippingDiscountAmount - membershipDiscountAmount,
  );

  return {
    items: selections.map((selection) => selection.orderItem),
    selectedCartItems: selections,
    summary: {
      subTotal,
      shippingFee,
      couponDiscountAmount,
      shippingDiscountAmount,
      membershipDiscountAmount,
      taxAmount,
      totalAmount,
    },
    shippingQuote,
    shippingComparison,
    appliedCoupon,
    appliedCoupons,
    appliedCampaign: stackingCampaign ? {
      campaignId: stackingCampaign._id.toString(),
      code: stackingCampaign.code,
      name: stackingCampaign.name,
    } : null,
    appliedMembership,
  };
};

export const promotionPricingService = {
  calculateCheckout,
};
