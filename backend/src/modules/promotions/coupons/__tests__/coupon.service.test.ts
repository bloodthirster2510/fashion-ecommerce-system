import { Types } from 'mongoose';
import { Coupon, CouponUsage, User } from '../../../../database/models';
import {
  PromotionPricingError,
  promotionPricingService,
} from '../../pricing/promotion-pricing.service';
import {
  CouponServiceError,
  clearCouponValidationCacheForTests,
  couponService,
} from '../coupon.service';

jest.mock('../../../../database/models', () => ({
  Coupon: {
    aggregate: jest.fn(),
    countDocuments: jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
  },
  CouponUsage: {
    aggregate: jest.fn(),
    countDocuments: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
    find: jest.fn(),
  },
  User: {
    find: jest.fn(),
  },
  Order: {
    find: jest.fn(),
  },
}));

jest.mock('../../pricing/promotion-pricing.service', () => {
  class PromotionPricingError extends Error {
    constructor(
      message: string,
      public readonly statusCode: number,
    ) {
      super(message);
      this.name = 'PromotionPricingError';
    }
  }

  return {
    PromotionPricingError,
    promotionPricingService: {
      calculateCheckout: jest.fn(),
    },
  };
});

const mockedCoupon = Coupon as jest.Mocked<typeof Coupon>;
const mockedCouponUsage = CouponUsage as jest.Mocked<typeof CouponUsage>;
const mockedUser = User as jest.Mocked<typeof User>;
const mockedPromotionPricingService = promotionPricingService as jest.Mocked<typeof promotionPricingService>;

const couponId = new Types.ObjectId('665000000000000000000201');
const userId = '665000000000000000000020';
const actorId = new Types.ObjectId('665000000000000000000021');
const userUsagePath = `userUsageCounts.${userId}`;

const baseCoupon = {
  _id: couponId,
  code: 'SAVE10',
  name: 'Save 10',
  description: null,
  discountType: 'fixed',
  discountValue: 10000,
  maxDiscountAmount: null,
  minOrderAmount: 0,
  usageLimit: 5,
  usedCount: 1,
  perUserLimit: 2,
  isPublic: true,
  eligibleUserTypes: ['all'],
  eligibleMembershipRanks: [],
  applicableProducts: [],
  applicableCategories: [],
  startAt: new Date('2024-01-01T00:00:00.000Z'),
  endAt: new Date('2099-01-01T00:00:00.000Z'),
  isActive: true,
  deletedAt: null,
};

const appliedCoupon = {
  coupon: baseCoupon,
  code: baseCoupon.code,
  discountType: baseCoupon.discountType,
  discountAmount: 10000,
  shippingDiscountAmount: 0,
  eligibleSubTotal: 100000,
};

const pricingSummary = {
  subTotal: 100000,
  shippingFee: 20000,
  couponDiscountAmount: 10000,
  shippingDiscountAmount: 0,
  membershipDiscountAmount: 0,
  taxAmount: 0,
  totalAmount: 110000,
};

beforeEach(() => {
  jest.clearAllMocks();
  clearCouponValidationCacheForTests();
});

describe('couponService usage reservation', () => {
  it('reserves coupon usage with an atomic global and per-user counter update', async () => {
    mockedCouponUsage.countDocuments.mockResolvedValue(1);
    mockedCoupon.updateOne.mockResolvedValue({} as never);
    mockedCoupon.findOneAndUpdate.mockResolvedValue({ _id: couponId } as never);

    const result = await couponService.reserveCouponUsage(userId, appliedCoupon as never);

    expect(mockedCoupon.updateOne).toHaveBeenCalledWith(
      { _id: couponId },
      { $max: { [userUsagePath]: 1 } },
    );
    expect(mockedCoupon.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: couponId,
        deletedAt: null,
        isActive: true,
        startAt: { $lte: expect.any(Date) },
        endAt: { $gte: expect.any(Date) },
        usedCount: { $lt: 5 },
        [userUsagePath]: { $lt: 2 },
      }),
      { $inc: { usedCount: 1, [userUsagePath]: 1 } },
      { returnDocument: 'after' },
    );
    expect(result).toEqual({ _id: couponId });
  });

  it('rejects reservation before incrementing when the user already reached their limit', async () => {
    mockedCouponUsage.countDocuments.mockResolvedValue(2);

    await expect(
      couponService.reserveCouponUsage(userId, appliedCoupon as never),
    ).rejects.toThrow(PromotionPricingError);

    expect(mockedCoupon.updateOne).not.toHaveBeenCalled();
    expect(mockedCoupon.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('rolls back both global and per-user usage counters', async () => {
    mockedCoupon.updateOne.mockResolvedValue({} as never);

    await couponService.rollbackCouponUsageReservation(couponId.toString(), userId);

    expect(mockedCoupon.updateOne).toHaveBeenCalledWith(
      {
        _id: couponId.toString(),
        usedCount: { $gt: 0 },
        [userUsagePath]: { $gt: 0 },
      },
      { $inc: { usedCount: -1, [userUsagePath]: -1 } },
    );
  });
});

describe('couponService admin filters', () => {
  it('filters coupons by discount type, visibility and audience', async () => {
    const listQuery = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    };
    mockedCoupon.find.mockReturnValue(listQuery as never);
    mockedCoupon.countDocuments.mockResolvedValue(0);
    mockedCoupon.aggregate.mockResolvedValue([]);

    await couponService.listCoupons({
      discountType: 'percent',
      isPublic: false,
      eligibleUserType: 'member',
    });

    const expectedFilter = {
      deletedAt: null,
      discountType: 'percent',
      isPublic: false,
      eligibleUserTypes: 'member',
    };
    expect(mockedCoupon.find).toHaveBeenCalledWith(expectedFilter, {
      userUsageCounts: 0,
      deletedAt: 0,
      __v: 0,
    });
    expect(mockedCoupon.countDocuments).toHaveBeenCalledWith(expectedFilter);
  });
});

describe('couponService admin safeguards', () => {
  it('returns creator and updater identities in coupon detail', async () => {
    mockedCoupon.findById.mockResolvedValue({
      ...baseCoupon,
      createdBy: actorId,
      updatedBy: actorId,
      toObject: () => ({ ...baseCoupon, createdBy: actorId, updatedBy: actorId }),
    } as never);
    mockedCouponUsage.countDocuments.mockResolvedValue(0);
    mockedUser.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { _id: actorId, name: 'Promotion Admin', email: 'admin@example.com', role: 'admin' },
        ]),
      }),
    } as never);

    const result = await couponService.getCouponById(couponId.toString());

    expect(result.coupon).toMatchObject({
      createdBy: { _id: actorId, name: 'Promotion Admin' },
      updatedBy: { _id: actorId, name: 'Promotion Admin' },
    });
  });

  it('checks coupon code availability while excluding the coupon being edited', async () => {
    mockedCoupon.countDocuments.mockResolvedValue(0);

    await expect(
      couponService.checkCouponCodeAvailability(' save10 ', couponId.toString()),
    ).resolves.toEqual({ code: 'SAVE10', available: true });

    expect(mockedCoupon.countDocuments).toHaveBeenCalledWith({
      code: 'SAVE10',
      deletedAt: null,
      _id: { $ne: couponId },
    });
  });

  it('maps duplicate coupon codes to a conflict response', async () => {
    mockedCoupon.create.mockRejectedValue({ code: 11000 });

    await expect(
      couponService.createCoupon({
        code: 'save10',
        name: 'Save 10',
        discountType: 'fixed',
        discountValue: 10000,
        startAt: new Date('2026-01-01T00:00:00.000Z'),
        endAt: new Date('2027-01-01T00:00:00.000Z'),
      }),
    ).rejects.toMatchObject({ message: 'Coupon code already exists', statusCode: 409 });
  });

  it('rejects lowering usageLimit below the already used count', async () => {
    mockedCoupon.findOne.mockResolvedValue({
      ...baseCoupon,
      usedCount: 7,
    } as never);

    await expect(
      couponService.updateCoupon(couponId.toString(), { usageLimit: 5 }),
    ).rejects.toThrow(CouponServiceError);

    expect(mockedCoupon.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('does not delete a coupon with a pending usage reservation', async () => {
    mockedCoupon.findOne.mockResolvedValue({ ...baseCoupon, usedCount: 1 } as never);
    mockedCouponUsage.countDocuments.mockResolvedValue(0);

    await expect(couponService.deleteCoupon(couponId.toString())).rejects.toMatchObject({
      message: 'Coupon has usage history and cannot be deleted',
      statusCode: 409,
    });

    expect(mockedCoupon.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe('couponService admin creation tools', () => {
  it('duplicates a coupon with overrides and resets usage counters through create', async () => {
    mockedCoupon.findOne.mockResolvedValue(baseCoupon as never);
    mockedCoupon.create.mockResolvedValue({ ...baseCoupon, code: 'SAVE10_COPY' } as never);

    await couponService.duplicateCoupon(couponId.toString(), {
      code: 'SAVE10_COPY',
      name: 'Save 10 copy',
      startAt: new Date('2026-06-20T00:00:00.000Z'),
      endAt: new Date('2026-07-20T00:00:00.000Z'),
    });

    expect(mockedCoupon.create).toHaveBeenCalledWith(expect.objectContaining({
      code: 'SAVE10_COPY',
      name: 'Save 10 copy',
      isActive: false,
    }));
  });

  it('previews a capped percentage discount on a sample order', () => {
    const result = couponService.previewCoupon({
      coupon: {
        code: 'SAVE20',
        name: 'Save 20',
        discountType: 'percent',
        discountValue: 20,
        maxDiscountAmount: 50000,
        minOrderAmount: 200000,
        startAt: new Date('2026-06-20T00:00:00.000Z'),
        endAt: new Date('2026-07-20T00:00:00.000Z'),
      },
      sampleSubTotal: 500000,
      sampleShippingFee: 30000,
    });

    expect(result).toMatchObject({
      eligible: true,
      summary: { discountAmount: 50000, shippingDiscountAmount: 0, totalAmount: 480000 },
    });
  });
});

describe('couponService usage analytics', () => {
  it('returns paginated coupon usage with user and order details', async () => {
    mockedCoupon.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: couponId }),
    } as never);
    const usageItems = [{ _id: new Types.ObjectId(), discountAmount: 10000 }];
    const usageQuery = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(usageItems),
    };
    mockedCouponUsage.find.mockReturnValue(usageQuery as never);
    mockedCouponUsage.countDocuments.mockResolvedValue(21);
    mockedCouponUsage.aggregate.mockResolvedValue([{ discountAmount: 10000, shippingDiscountAmount: 0 }]);

    const result = await couponService.listCouponUsage(couponId.toString(), { page: 2, limit: 10 });

    expect(mockedCouponUsage.find).toHaveBeenCalledWith({ couponId });
    expect(usageQuery.skip).toHaveBeenCalledWith(10);
    expect(usageQuery.limit).toHaveBeenCalledWith(10);
    expect(usageQuery.populate).toHaveBeenCalledWith('userId', 'name email phone');
    expect(usageQuery.populate).toHaveBeenCalledWith('orderId', 'orderCode status totalAmount');
    expect(result).toEqual({
      items: usageItems,
      summary: { usageCount: 21, discountAmount: 10000, shippingDiscountAmount: 0 },
      pagination: { page: 2, limit: 10, totalItems: 21, totalPages: 3 },
    });
  });
});

describe('couponService customer availability', () => {
  it('does not expose internal errors as unavailable coupon reasons', async () => {
    mockedCoupon.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([baseCoupon]),
        }),
      }),
    } as never);
    mockedCoupon.countDocuments.mockResolvedValue(1);
    mockedPromotionPricingService.calculateCheckout.mockRejectedValue(
      new Error('database timeout: replica credentials unavailable'),
    );

    const result = await couponService.listAvailableCoupons(userId, {
      cartItemIds: ['665000000000000000000030'],
      paymentMethod: 'COD',
    });

    expect(result.items[0]).toEqual(expect.objectContaining({
      isApplicable: false,
      reason: 'Coupon is not available',
    }));
  });
});

describe('couponService customer validation', () => {
  it('caches successful validation results for the same coupon context', async () => {
    mockedPromotionPricingService.calculateCheckout.mockResolvedValue({
      appliedCoupon,
      summary: pricingSummary,
      appliedMembership: null,
    } as never);

    const firstResult = await couponService.validateCoupon(userId, {
      couponCode: 'save10',
      cartItemIds: ['665000000000000000000031', '665000000000000000000030'],
      paymentMethod: 'COD',
    });
    const secondResult = await couponService.validateCoupon(userId, {
      couponCode: 'SAVE10',
      cartItemIds: ['665000000000000000000030', '665000000000000000000031'],
      paymentMethod: 'COD',
    });

    expect(mockedPromotionPricingService.calculateCheckout).toHaveBeenCalledTimes(1);
    expect(mockedPromotionPricingService.calculateCheckout).toHaveBeenCalledWith({
      userId,
      cartItemIds: ['665000000000000000000031', '665000000000000000000030'],
      couponCode: 'SAVE10',
      paymentMethod: 'COD',
    });
    expect(secondResult).toBe(firstResult);
  });
});
