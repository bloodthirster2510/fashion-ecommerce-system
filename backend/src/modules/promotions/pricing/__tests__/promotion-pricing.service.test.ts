import { Types } from 'mongoose';
import {
  Cart,
  Coupon,
  CouponUsage,
  MembershipRanking,
  Order,
  User,
} from '../../../../database/models';
import { resolveSaleItem } from '../../../sales/sales.helpers';
import { shippingQuoteService } from '../../../shipping/shipping-quote.service';
import {
  PromotionPricingError,
  promotionPricingService,
} from '../promotion-pricing.service';

jest.mock('../../../../database/models', () => ({
  Cart: {
    findOne: jest.fn(),
  },
  Coupon: {
    findOne: jest.fn(),
  },
  CouponUsage: {
    countDocuments: jest.fn(),
  },
  MembershipRanking: {
    find: jest.fn(),
  },
  Order: {
    countDocuments: jest.fn(),
  },
  User: {
    findById: jest.fn(),
  },
}));

jest.mock('../../../sales/sales.helpers', () => {
  class SalesServiceError extends Error {
    constructor(
      message: string,
      public readonly statusCode: number,
    ) {
      super(message);
      this.name = 'SalesServiceError';
    }
  }

  return {
    SalesServiceError,
    resolveSaleItem: jest.fn(),
    toIdString: (value: { toString(): string } | string | null | undefined) => value?.toString() ?? '',
    toObjectId: (id: string) => new Types.ObjectId(id),
  };
});

jest.mock('../../../shipping/shipping-quote.service', () => ({
  shippingQuoteService: {
    compareCheckout: jest.fn(),
  },
}));

const mockedCart = Cart as jest.Mocked<typeof Cart>;
const mockedCoupon = Coupon as jest.Mocked<typeof Coupon>;
const mockedCouponUsage = CouponUsage as jest.Mocked<typeof CouponUsage>;
const mockedMembershipRanking = MembershipRanking as jest.Mocked<typeof MembershipRanking>;
const mockedOrder = Order as jest.Mocked<typeof Order>;
const mockedUser = User as jest.Mocked<typeof User>;
const mockedResolveSaleItem = resolveSaleItem as jest.MockedFunction<typeof resolveSaleItem>;
const mockedShippingQuoteService = shippingQuoteService as jest.Mocked<typeof shippingQuoteService>;

const userId = '665000000000000000000020';
const cartItemId = new Types.ObjectId('665000000000000000000030');
const productId = new Types.ObjectId('665000000000000000000003');
const categoryId = new Types.ObjectId('665000000000000000000004');
const variantId = new Types.ObjectId('665000000000000000000011');
const colorVariantId = new Types.ObjectId('665000000000000000000012');
const memberRankId = new Types.ObjectId('665000000000000000000101');
const goldRankId = new Types.ObjectId('665000000000000000000102');

const memberTier = {
  _id: memberRankId,
  name: 'Member',
  minPoint: 0,
  level: 1,
  discountPercent: 0,
};

const goldTier = {
  _id: goldRankId,
  name: 'Gold',
  minPoint: 5000,
  level: 3,
  discountPercent: 7,
};

const baseCoupon = {
  _id: new Types.ObjectId('665000000000000000000201'),
  code: 'GOLDONLY',
  name: 'Gold only',
  description: null,
  discountType: 'percent',
  discountValue: 10,
  maxDiscountAmount: null,
  minOrderAmount: 0,
  usageLimit: null,
  usedCount: 0,
  perUserLimit: 1,
  isPublic: true,
  eligibleUserTypes: ['all'],
  eligibleMembershipRanks: [goldRankId],
  applicableProducts: [],
  applicableCategories: [],
  startAt: new Date('2024-01-01T00:00:00.000Z'),
  endAt: new Date('2099-01-01T00:00:00.000Z'),
  isActive: true,
  deletedAt: null,
};

const mockUser = (loyaltyPoint: number) => {
  mockedUser.findById.mockReturnValue({
    select: jest.fn().mockResolvedValue({ loyaltyPoint }),
  } as never);
};

beforeEach(() => {
  jest.clearAllMocks();

  mockedCart.findOne.mockResolvedValue({
    product_list: [
      {
        _id: cartItemId,
        productId,
        variantId,
        colorVariantId,
        size: 'M',
        quantity: 1,
      },
    ],
  } as never);
  mockedResolveSaleItem.mockResolvedValue({
    product: {
      name: 'Basic Tee',
      category_id: categoryId,
    },
    productId,
    variantId,
    colorVariantId,
    size: 'M',
    sku: 'TEE-BLK-M',
    finalPrice: 100000,
    fitType: 'Regular',
    color: {
      color: 'Black',
    },
    image: 'https://example.com/tee.png',
  } as never);
  mockedShippingQuoteService.compareCheckout.mockResolvedValue({
    shippingQuote: {
      provider: 'FIXED',
      serviceId: null,
      serviceTypeId: null,
      fee: 30000,
      status: 'fallback',
      estimatedDeliveryDate: null,
      rawQuote: null,
    },
  } as never);
  mockedMembershipRanking.find.mockReturnValue({
    sort: jest.fn().mockResolvedValue([memberTier, goldTier]),
  } as never);
  mockedCoupon.findOne.mockResolvedValue(baseCoupon as never);
  mockedCouponUsage.countDocuments.mockResolvedValue(0);
  mockedOrder.countDocuments.mockResolvedValue(0);
});

describe('promotionPricingService coupon membership eligibility', () => {
  it('treats the base tier as a member even when its discount is zero', async () => {
    mockUser(100);
    mockedCoupon.findOne.mockResolvedValue({
      ...baseCoupon,
      eligibleUserTypes: ['member'],
      eligibleMembershipRanks: [],
    } as never);

    const result = await promotionPricingService.calculateCheckout({
      userId,
      cartItemIds: [cartItemId.toString()],
      couponCode: 'GOLDONLY',
      paymentMethod: 'COD',
    });

    expect(result.summary.couponDiscountAmount).toBe(10000);
  });

  it('counts an atomic usage reservation toward the per-user limit', async () => {
    mockUser(6000);
    mockedCoupon.findOne.mockResolvedValue({
      ...baseCoupon,
      userUsageCounts: { [userId]: 1 },
    } as never);

    await expect(
      promotionPricingService.calculateCheckout({
        userId,
        cartItemIds: [cartItemId.toString()],
        couponCode: 'GOLDONLY',
        paymentMethod: 'COD',
      }),
    ).rejects.toMatchObject({ message: 'Coupon per-user limit reached', statusCode: 409 });
  });

  it('rejects rank-scoped coupons even when eligible user type is all', async () => {
    mockUser(100);

    await expect(
      promotionPricingService.calculateCheckout({
        userId,
        cartItemIds: [cartItemId.toString()],
        couponCode: 'GOLDONLY',
        paymentMethod: 'COD',
      }),
    ).rejects.toThrow(PromotionPricingError);
  });

  it('applies rank-scoped coupons for the matching current membership tier', async () => {
    mockUser(6000);

    const result = await promotionPricingService.calculateCheckout({
      userId,
      cartItemIds: [cartItemId.toString()],
      couponCode: 'GOLDONLY',
      paymentMethod: 'COD',
    });

    expect(result.summary.couponDiscountAmount).toBe(10000);
    expect(result.appliedCoupon?.code).toBe('GOLDONLY');
  });

  it('applies product coupon before calculating the membership discount', async () => {
    mockUser(6000);

    const result = await promotionPricingService.calculateCheckout({
      userId,
      cartItemIds: [cartItemId.toString()],
      couponCode: 'GOLDONLY',
      paymentMethod: 'COD',
    });

    expect(result.summary.couponDiscountAmount).toBe(10000);
    expect(result.summary.membershipDiscountAmount).toBe(6300);
    expect(result.summary.totalAmount).toBe(113700);
  });

  it('keeps the membership base on product subtotal for a free-shipping coupon', async () => {
    mockUser(6000);
    mockedCoupon.findOne.mockResolvedValue({
      ...baseCoupon,
      discountType: 'free_shipping',
      discountValue: 0,
    } as never);

    const result = await promotionPricingService.calculateCheckout({
      userId,
      cartItemIds: [cartItemId.toString()],
      couponCode: 'GOLDONLY',
      paymentMethod: 'COD',
    });

    expect(result.summary.couponDiscountAmount).toBe(0);
    expect(result.summary.shippingDiscountAmount).toBe(30000);
    expect(result.summary.membershipDiscountAmount).toBe(7000);
    expect(result.summary.totalAmount).toBe(93000);
  });
});
