import { Types } from 'mongoose';
import { Coupon, CouponUsage } from '../../../../database/models';
import {
  PromotionPricingError,
  promotionPricingService,
} from '../../pricing/promotion-pricing.service';
import { CouponServiceError, couponService } from '../coupon.service';

jest.mock('../../../../database/models', () => ({
  Coupon: {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
  },
  CouponUsage: {
    countDocuments: jest.fn(),
    create: jest.fn(),
    deleteOne: jest.fn(),
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
const mockedPromotionPricingService = promotionPricingService as jest.Mocked<typeof promotionPricingService>;

const couponId = new Types.ObjectId('665000000000000000000201');
const userId = '665000000000000000000020';
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

beforeEach(() => {
  jest.clearAllMocks();
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

describe('couponService admin safeguards', () => {
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
});

describe('couponService customer availability', () => {
  it('does not expose internal errors as unavailable coupon reasons', async () => {
    mockedCoupon.find.mockReturnValue({
      sort: jest.fn().mockResolvedValue([baseCoupon]),
    } as never);
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
