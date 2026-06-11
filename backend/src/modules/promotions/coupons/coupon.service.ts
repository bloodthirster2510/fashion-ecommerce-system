import { Types } from 'mongoose';
import {
  Coupon,
  CouponUsage,
  type CouponDiscountType,
  type CouponEligibleUserType,
  type ICoupon,
} from '../../../database/models';
import {
  PromotionPricingError,
  promotionPricingService,
} from '../pricing/promotion-pricing.service';
import type { AppliedCoupon } from '../pricing/promotion-pricing.types';
import type {
  AvailableCouponsInput,
  CouponListQueryInput,
  CreateCouponInput,
  UpdateCouponInput,
  ValidateCouponInput,
} from './coupon.types';

export class CouponServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'CouponServiceError';
  }
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const COUPON_DISCOUNT_TYPES = new Set<CouponDiscountType>(['percent', 'fixed', 'free_shipping']);
const ELIGIBLE_USER_TYPES = new Set<CouponEligibleUserType>(['all', 'new_user', 'member']);

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeCode = (value: string) => value.trim().toUpperCase();

const assertValidObjectId = (id: string, fieldName: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new CouponServiceError(`Invalid ${fieldName}`, 400);
  }
};

const toObjectIdList = (values?: string[]) => {
  if (!values?.length) {
    return [];
  }

  return values.map((value) => {
    assertValidObjectId(value, 'object id');
    return new Types.ObjectId(value);
  });
};

const toNullableNumber = (value: unknown) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '') {
    return null;
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    throw new CouponServiceError('Invalid numeric value', 400);
  }

  return numericValue;
};

const toRequiredNumber = (value: unknown, fieldName: string) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    throw new CouponServiceError(`Invalid ${fieldName}`, 400);
  }

  return numericValue;
};

const toPositiveInteger = (value: unknown, fieldName: string) => {
  const numericValue = toRequiredNumber(value, fieldName);
  if (!Number.isInteger(numericValue) || numericValue < 1) {
    throw new CouponServiceError(`Invalid ${fieldName}`, 400);
  }

  return numericValue;
};

const toDate = (value: string | Date, fieldName: string) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new CouponServiceError(`Invalid ${fieldName}`, 400);
  }

  return date;
};

const normalizeEligibleUserTypes = (values?: CouponEligibleUserType[]) => {
  if (values === undefined) {
    return undefined;
  }

  if (!Array.isArray(values) || values.length === 0) {
    throw new CouponServiceError('eligibleUserTypes must include at least one value', 400);
  }

  const normalized = Array.from(new Set(values));
  normalized.forEach((value) => {
    if (!ELIGIBLE_USER_TYPES.has(value)) {
      throw new CouponServiceError('Invalid eligibleUserTypes', 400);
    }
  });

  return normalized.includes('all') ? ['all'] : normalized;
};

const assertDiscountValue = (discountType: CouponDiscountType, discountValue: number) => {
  if (discountType === 'free_shipping') {
    if (discountValue !== 0) {
      throw new CouponServiceError('discountValue must be 0 for free shipping coupons', 400);
    }

    return;
  }

  if (discountType === 'percent') {
    if (discountValue <= 0 || discountValue > 100) {
      throw new CouponServiceError('discountValue must be between 0 and 100 for percent coupons', 400);
    }

    return;
  }

  if (discountValue <= 0) {
    throw new CouponServiceError('discountValue must be greater than 0 for fixed coupons', 400);
  }
};

const assertCouponPatchIsConsistent = (data: Record<string, unknown>, currentCoupon?: ICoupon) => {
  const discountType = (data.discountType ?? currentCoupon?.discountType) as CouponDiscountType | undefined;
  const discountValue = data.discountValue ?? currentCoupon?.discountValue;
  const startAt = data.startAt ?? currentCoupon?.startAt;
  const endAt = data.endAt ?? currentCoupon?.endAt;

  if (discountType !== undefined && !COUPON_DISCOUNT_TYPES.has(discountType)) {
    throw new CouponServiceError('Invalid discountType', 400);
  }

  if (discountType !== undefined && discountValue !== undefined) {
    assertDiscountValue(discountType, Number(discountValue));
  }

  if (startAt instanceof Date && endAt instanceof Date && endAt <= startAt) {
    throw new CouponServiceError('endAt must be after startAt', 400);
  }
};

const clampPagination = (query: CouponListQueryInput) => {
  const page = Math.max(query.page ?? DEFAULT_PAGE, DEFAULT_PAGE);
  const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);

  return { page, limit };
};

const buildCouponFilter = (query: CouponListQueryInput) => {
  const filter: Record<string, unknown> = { deletedAt: null };
  const now = new Date();

  if (query.status === 'active') {
    filter.isActive = true;
    filter.startAt = { $lte: now };
    filter.endAt = { $gte: now };
  } else if (query.status === 'inactive') {
    filter.isActive = false;
  } else if (query.status === 'expired') {
    filter.endAt = { $lt: now };
  } else if (query.status === 'upcoming') {
    filter.startAt = { $gt: now };
  }

  if (query.keyword?.trim()) {
    const keywordRegex = new RegExp(escapeRegex(query.keyword.trim()), 'i');
    filter.$or = [
      { code: keywordRegex },
      { name: keywordRegex },
      { description: keywordRegex },
    ];
  }

  return filter;
};

const normalizeCouponInput = (input: CreateCouponInput | UpdateCouponInput, isCreate: boolean) => {
  const data: Record<string, unknown> = {};

  if (input.code !== undefined) data.code = normalizeCode(input.code);
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.description !== undefined) data.description = input.description?.trim() || null;
  if (input.discountType !== undefined) data.discountType = input.discountType;
  if (input.discountValue !== undefined) data.discountValue = toRequiredNumber(input.discountValue, 'discountValue');
  if (input.maxDiscountAmount !== undefined) data.maxDiscountAmount = toNullableNumber(input.maxDiscountAmount);
  if (input.minOrderAmount !== undefined) data.minOrderAmount = toRequiredNumber(input.minOrderAmount, 'minOrderAmount');
  if (input.usageLimit !== undefined) data.usageLimit = toNullableNumber(input.usageLimit);
  if (input.perUserLimit !== undefined) data.perUserLimit = toPositiveInteger(input.perUserLimit, 'perUserLimit');
  if (input.isPublic !== undefined) data.isPublic = Boolean(input.isPublic);
  if (input.eligibleUserTypes !== undefined) data.eligibleUserTypes = normalizeEligibleUserTypes(input.eligibleUserTypes);
  if (input.eligibleMembershipRanks !== undefined) {
    data.eligibleMembershipRanks = toObjectIdList(input.eligibleMembershipRanks);
  }
  if (input.applicableProducts !== undefined) data.applicableProducts = toObjectIdList(input.applicableProducts);
  if (input.applicableCategories !== undefined) data.applicableCategories = toObjectIdList(input.applicableCategories);
  if (input.startAt !== undefined) data.startAt = toDate(input.startAt, 'startAt');
  if (input.endAt !== undefined) data.endAt = toDate(input.endAt, 'endAt');
  if (input.isActive !== undefined) data.isActive = Boolean(input.isActive);

  if (isCreate) {
    const requiredFields = ['code', 'name', 'discountType', 'discountValue', 'startAt', 'endAt'];
    requiredFields.forEach((field) => {
      if (data[field] === undefined || data[field] === '') {
        throw new CouponServiceError(`${field} is required`, 400);
      }
    });
  }

  assertCouponPatchIsConsistent(data);

  return data;
};

const mapCouponForCustomer = (coupon: ICoupon) => ({
  _id: coupon._id.toString(),
  code: coupon.code,
  name: coupon.name,
  description: coupon.description ?? null,
  discountType: coupon.discountType,
  discountValue: coupon.discountValue,
  maxDiscountAmount: coupon.maxDiscountAmount ?? null,
  minOrderAmount: coupon.minOrderAmount,
  endAt: coupon.endAt,
});

const listCoupons = async (query: CouponListQueryInput) => {
  const { page, limit } = clampPagination(query);
  const filter = buildCouponFilter(query);

  const [items, totalItems] = await Promise.all([
    Coupon.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Coupon.countDocuments(filter),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
    },
  };
};

const getCouponById = async (id: string) => {
  assertValidObjectId(id, 'coupon id');
  const coupon = await Coupon.findById(id);
  if (!coupon || coupon.deletedAt) {
    throw new CouponServiceError('Coupon not found', 404);
  }

  const usageCount = await CouponUsage.countDocuments({ couponId: coupon._id });
  return { coupon, usageCount };
};

const createCoupon = async (input: CreateCouponInput, actorId?: string) => {
  const data = normalizeCouponInput(input, true);
  if (actorId) {
    assertValidObjectId(actorId, 'actor id');
    data.createdBy = new Types.ObjectId(actorId);
    data.updatedBy = new Types.ObjectId(actorId);
  }

  return Coupon.create(data);
};

const updateCoupon = async (id: string, input: UpdateCouponInput, actorId?: string) => {
  assertValidObjectId(id, 'coupon id');
  const currentCoupon = await Coupon.findOne({ _id: id, deletedAt: null });

  if (!currentCoupon) {
    throw new CouponServiceError('Coupon not found', 404);
  }

  const data = normalizeCouponInput(input, false);

  if (Object.keys(data).length === 0) {
    throw new CouponServiceError('No data to update', 400);
  }

  assertCouponPatchIsConsistent(data, currentCoupon);

  if (actorId) {
    assertValidObjectId(actorId, 'actor id');
    data.updatedBy = new Types.ObjectId(actorId);
  }

  const coupon = await Coupon.findOneAndUpdate(
    { _id: currentCoupon._id, deletedAt: null },
    { $set: data },
    { new: true, runValidators: true },
  );

  if (!coupon) {
    throw new CouponServiceError('Coupon not found', 404);
  }

  return coupon;
};

const updateCouponStatus = async (id: string, isActive: boolean, actorId?: string) => {
  return updateCoupon(id, { isActive }, actorId);
};

const deleteCoupon = async (id: string, actorId?: string) => {
  assertValidObjectId(id, 'coupon id');
  const usageCount = await CouponUsage.countDocuments({ couponId: id });

  if (usageCount > 0) {
    throw new CouponServiceError('Coupon has usage history and cannot be deleted', 409);
  }

  const updateData: Record<string, unknown> = {
    deletedAt: new Date(),
    isActive: false,
  };

  if (actorId) {
    assertValidObjectId(actorId, 'actor id');
    updateData.updatedBy = new Types.ObjectId(actorId);
  }

  const coupon = await Coupon.findOneAndUpdate(
    { _id: id, deletedAt: null },
    { $set: updateData },
    { new: true },
  );

  if (!coupon) {
    throw new CouponServiceError('Coupon not found', 404);
  }

  return coupon;
};

const validateCoupon = async (userId: string, input: ValidateCouponInput) => {
  if (!input.couponCode?.trim()) {
    throw new CouponServiceError('couponCode is required', 400);
  }

  const pricing = await promotionPricingService.calculateCheckout({
    userId,
    cartItemIds: input.cartItemIds,
    couponCode: input.couponCode,
    paymentMethod: input.paymentMethod ?? 'COD',
  });

  if (!pricing.appliedCoupon) {
    throw new CouponServiceError('Coupon not applied', 400);
  }

  return {
    coupon: mapCouponForCustomer(pricing.appliedCoupon.coupon),
    summary: pricing.summary,
    appliedMembership: pricing.appliedMembership,
  };
};

const listAvailableCoupons = async (userId: string, input: AvailableCouponsInput = {}) => {
  const now = new Date();
  const coupons = await Coupon.find({
    deletedAt: null,
    isPublic: true,
    isActive: true,
    startAt: { $lte: now },
    endAt: { $gte: now },
  }).sort({ endAt: 1 });
  const activeCoupons = coupons.filter((coupon) => (
    coupon.usageLimit == null || coupon.usedCount < coupon.usageLimit
  ));
  const hasCartContext = Boolean(input.cartItemIds?.length);

  return {
    items: await Promise.all(
      activeCoupons.map(async (coupon) => {
        if (!hasCartContext) {
          return {
            coupon: mapCouponForCustomer(coupon),
            isApplicable: null,
            reason: null,
            summary: null,
            appliedMembership: null,
            estimatedDiscountAmount: 0,
            estimatedShippingDiscountAmount: 0,
          };
        }

        try {
          const pricing = await promotionPricingService.calculateCheckout({
            userId,
            cartItemIds: input.cartItemIds ?? [],
            couponCode: coupon.code,
            paymentMethod: input.paymentMethod ?? 'COD',
          });

          return {
            coupon: mapCouponForCustomer(coupon),
            isApplicable: Boolean(pricing.appliedCoupon),
            reason: null,
            summary: pricing.summary,
            appliedMembership: pricing.appliedMembership,
            estimatedDiscountAmount: pricing.appliedCoupon?.discountAmount ?? 0,
            estimatedShippingDiscountAmount: pricing.appliedCoupon?.shippingDiscountAmount ?? 0,
          };
        } catch (error) {
          return {
            coupon: mapCouponForCustomer(coupon),
            isApplicable: false,
            reason: error instanceof Error ? error.message : 'Coupon is not available',
            summary: null,
            appliedMembership: null,
            estimatedDiscountAmount: 0,
            estimatedShippingDiscountAmount: 0,
          };
        }
      }),
    ),
  };
};

const reserveCouponUsage = async (userId: string, appliedCoupon: AppliedCoupon | null) => {
  if (!appliedCoupon) {
    return null;
  }

  const coupon = appliedCoupon.coupon;
  const usedByUser = await CouponUsage.countDocuments({
    couponId: coupon._id,
    userId: new Types.ObjectId(userId),
  });

  if (usedByUser >= coupon.perUserLimit) {
    throw new PromotionPricingError('Coupon per-user limit reached', 409);
  }

  const usageLimitFilter =
    coupon.usageLimit == null ? {} : { usedCount: { $lt: coupon.usageLimit } };
  const reservedCoupon = await Coupon.findOneAndUpdate(
    {
      _id: coupon._id,
      deletedAt: null,
      isActive: true,
      startAt: { $lte: new Date() },
      endAt: { $gte: new Date() },
      ...usageLimitFilter,
    },
    { $inc: { usedCount: 1 } },
    { new: true },
  );

  if (!reservedCoupon) {
    throw new PromotionPricingError('Coupon usage limit reached', 409);
  }

  return reservedCoupon;
};

const rollbackCouponUsageReservation = async (couponId?: string) => {
  if (!couponId) {
    return;
  }

  await Coupon.updateOne(
    { _id: couponId, usedCount: { $gt: 0 } },
    { $inc: { usedCount: -1 } },
  );
};

const rollbackRecordedCouponUsage = async (orderId?: string) => {
  if (!orderId) {
    return;
  }

  await CouponUsage.deleteOne({ orderId: new Types.ObjectId(orderId) });
};

const recordCouponUsage = async (input: {
  userId: string;
  orderId: string;
  appliedCoupon: AppliedCoupon | null;
}) => {
  if (!input.appliedCoupon) {
    return null;
  }

  const coupon = input.appliedCoupon.coupon;

  return CouponUsage.create({
    couponId: coupon._id,
    userId: new Types.ObjectId(input.userId),
    orderId: new Types.ObjectId(input.orderId),
    codeSnapshot: coupon.code,
    discountTypeSnapshot: coupon.discountType,
    discountAmount: input.appliedCoupon.discountAmount,
    shippingDiscountAmount: input.appliedCoupon.shippingDiscountAmount,
    usedAt: new Date(),
  });
};

export const couponService = {
  listCoupons,
  getCouponById,
  createCoupon,
  updateCoupon,
  updateCouponStatus,
  deleteCoupon,
  listAvailableCoupons,
  validateCoupon,
  reserveCouponUsage,
  rollbackCouponUsageReservation,
  rollbackRecordedCouponUsage,
  recordCouponUsage,
};
