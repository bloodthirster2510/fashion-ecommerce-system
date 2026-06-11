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

export class PromotionPricingError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'PromotionPricingError';
  }
}

// export const FREE_SHIPPING_MINIMUM = 399000;

const normalizeCouponCode = (value?: string) => value?.trim().toUpperCase() || undefined;

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

  let currentTier: IMembershipRanking | null = tiers[0];
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
    throw new PromotionPricingError('Coupon usage limit reached', 409);
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
      checks.push(Promise.resolve(Boolean(currentTier && currentTier.discountPercent > 0)));
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

const assertCouponPerUserLimit = async (coupon: ICoupon, userId: string) => {
  const usedByUser = await CouponUsage.countDocuments({
    couponId: coupon._id,
    userId: toObjectId(userId, 'userId'),
  });

  if (usedByUser >= coupon.perUserLimit) {
    throw new PromotionPricingError('Coupon per-user limit reached', 409);
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

  return {
    couponDiscountAmount: Math.min(coupon.discountValue, eligibleSubTotal),
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

  if (input.subTotal < coupon.minOrderAmount) {
    throw new PromotionPricingError('Order does not meet coupon minimum amount', 400);
  }

  const eligibleSubTotal = getCouponEligibleSubtotal(coupon, input.selections);
  if (eligibleSubTotal <= 0) {
    throw new PromotionPricingError('Coupon does not apply to selected items', 400);
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
    input.paymentMethod !== 'VNPAY' &&
    input.paymentMethod !== 'MOMO'
  ) {
    throw new SalesServiceError(
      `Payment method ${input.paymentMethod} is not supported in this phase. Supported: COD, VNPAY, MOMO`,
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
  const appliedCoupon = await applyCoupon({
    userId: input.userId,
    couponCode: input.couponCode,
    selections,
    subTotal,
    shippingFee,
    automaticShippingDiscount,
    currentTier,
  });
  const couponDiscountAmount = appliedCoupon?.discountAmount ?? 0;
  const shippingDiscountAmount = Math.min(
    shippingFee,
    automaticShippingDiscount + (appliedCoupon?.shippingDiscountAmount ?? 0),
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
    appliedMembership,
  };
};

export const promotionPricingService = {
  calculateCheckout,
};
