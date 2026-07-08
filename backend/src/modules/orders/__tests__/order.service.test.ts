import mongoose, { Types } from 'mongoose';
import { Inventory, LoyaltyPointHistory, Order, Product, User } from '../../../database/models';
import { inventoryService } from '../../inventory/inventory.service';
import { cartService } from '../../cart/cart.service';
import { promotionPricingService } from '../../promotions/pricing/promotion-pricing.service';
import { couponService } from '../../promotions/coupons/coupon.service';
import { transactionService } from '../../payments/transaction.service';
import type { CheckoutPricingResult } from '../../promotions/pricing/promotion-pricing.types';
import { GHNService } from '../../shipping/ghn.service';
import { loyaltyRuleService } from '../../admin/loyalty/loyalty-rule.service';
import { calculateLoyaltyPointsForOrder, orderService } from '../order.service';
import { emitOrderUpdate } from '../../realtime/order.gateway';

jest.mock('../../../database/models', () => ({
  Order: {
    aggregate: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
  },
  Product: {
    updateOne: jest.fn(),
  },
  Inventory: {
    updateOne: jest.fn(),
  },
  User: {
    findById: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
  LoyaltyPointHistory: {
    create: jest.fn(),
  },
}));

jest.mock('../../inventory/inventory.service', () => ({
  inventoryService: {
    reserveInventory: jest.fn(),
    commitReservations: jest.fn(),
    releaseReservations: jest.fn(),
    restoreImportRemainingQuantities: jest.fn(),
  },
}));

jest.mock('../../cart/cart.service', () => ({
  cartService: {
    deleteCartItems: jest.fn(),
  },
}));

jest.mock('../../promotions/pricing/promotion-pricing.service', () => ({
  promotionPricingService: {
    calculateCheckout: jest.fn(),
  },
}));

jest.mock('../../promotions/coupons/coupon.service', () => ({
  couponService: {
    reserveCouponUsage: jest.fn(),
    recordCouponUsage: jest.fn(),
    rollbackRecordedCouponUsage: jest.fn(),
    rollbackCouponUsageReservation: jest.fn(),
  },
}));

jest.mock('../../payments/transaction.service', () => ({
  transactionService: {
    createPendingTransaction: jest.fn(),
    createManualAdjustmentTransaction: jest.fn(),
    resolveTransaction: jest.fn(),
  },
}));

jest.mock('../../shipping/ghn.service', () => ({
  GHNService: {
    cancelOrder: jest.fn(),
    createShippingOrder: jest.fn(),
    getOrderDetail: jest.fn(),
  },
}));

jest.mock('../../admin/loyalty/loyalty-rule.service', () => ({
  loyaltyRuleService: {
    getActiveRuleSnapshot: jest.fn(),
  },
}));

jest.mock('../../realtime/order.gateway', () => ({
  emitOrderUpdate: jest.fn(),
}));

jest.mock('../../notifications/push-notification.service', () => ({
  sendShippingUpdatePush: jest.fn().mockResolvedValue({ sent: 0 }),
}));

const mockedOrder = Order as jest.Mocked<typeof Order>;
const mockedProduct = Product as jest.Mocked<typeof Product>;
const mockedInventory = Inventory as jest.Mocked<typeof Inventory>;
const mockedUser = User as jest.Mocked<typeof User>;
const mockedLoyaltyPointHistory = LoyaltyPointHistory as jest.Mocked<typeof LoyaltyPointHistory>;
const mockedInventoryService = inventoryService as jest.Mocked<typeof inventoryService>;
const mockedCartService = cartService as jest.Mocked<typeof cartService>;
const mockedPromotionPricingService = promotionPricingService as jest.Mocked<typeof promotionPricingService>;
const mockedCouponService = couponService as jest.Mocked<typeof couponService>;
const mockedTransactionService = transactionService as jest.Mocked<typeof transactionService>;
const mockedGHNService = GHNService as jest.Mocked<typeof GHNService>;
const mockedLoyaltyRuleService = loyaltyRuleService as jest.Mocked<typeof loyaltyRuleService>;
const mockedEmitOrderUpdate = emitOrderUpdate as jest.MockedFunction<typeof emitOrderUpdate>;

type MockSession = {
  withTransaction: jest.Mock;
  endSession: jest.Mock;
};

let mockSession: MockSession;

const createMockSession = (): MockSession => ({
  withTransaction: jest.fn(async (callback: () => Promise<unknown>) => callback()),
  endSession: jest.fn().mockResolvedValue(undefined),
});

const mockAtomicCancel = <T extends { status: string }>(order: T) => {
  (mockedOrder.findOneAndUpdate as unknown as jest.Mock).mockImplementation((_filter: unknown, update: unknown) => {
    const set = (update as { $set?: Partial<T> }).$set;
    if (set) {
      Object.assign(order, set);
    }
    return Promise.resolve(order as never);
  });
};

const userId = '665000000000000000000020';
const productId = new Types.ObjectId('665000000000000000000003');
const categoryId = new Types.ObjectId('665000000000000000000004');
const variantId = new Types.ObjectId('665000000000000000000011');
const colorVariantId = new Types.ObjectId('665000000000000000000012');
const cartItemId = new Types.ObjectId('665000000000000000000030');
const reservationId = new Types.ObjectId('665000000000000000000040');
const addressId = new Types.ObjectId('665000000000000000000060');
const shippingAddress = {
  customerName: 'Nguyen Van A',
  province: 'Can Tho',
  provinceId: 92,
  district: 'Ninh Kieu',
  districtId: 1574,
  ward: 'An Khanh',
  wardCode: '550101',
  streetName: '123 Duong 3/2',
  phoneNumber: '0912345678',
};

const normalizedShippingAddress = {
  ...shippingAddress,
  provinceCode: '92',
  ghnProvinceId: 92,
  ghnDistrictId: 1574,
  ghnWardCode: '550101',
  ghnMappingStatus: 'manual' as const,
};

const mockUserAddressLookup = (addresses: Array<typeof shippingAddress & { _id: Types.ObjectId; isDefault: boolean }>) => {
  mockedUser.findById.mockReturnValue({
    select: jest.fn().mockResolvedValue({ address: addresses }),
  } as never);
};

const buildPricingResult = (): CheckoutPricingResult => ({
  items: [
    {
      productId,
      categoryId,
      variantId,
      colorVariantId,
      size: 'M',
      sku: 'INV-TEE-BLK-M',
      name: 'Basic Tee',
      fitType: 'Regular',
      color: 'Black',
      image: 'https://example.com/black.png',
      quantity: 2,
      priceAtPurchased: 180000,
    },
  ],
  selectedCartItems: [],
  summary: {
    subTotal: 360000,
    shippingFee: 25000,
    couponDiscountAmount: 0,
    shippingDiscountAmount: 0,
    membershipDiscountAmount: 0,
    taxAmount: 0,
    totalAmount: 385000,
  },
  shippingQuote: {
    provider: 'FIXED',
    serviceId: null,
    serviceTypeId: null,
    fee: 25000,
    status: 'fallback',
    estimatedDeliveryDate: null,
    rawQuote: null,
  },
  shippingComparison: {
    comparisonStatus: 'fallback',
    pricingMode: 'FIXED_FALLBACK',
    customerFee: 25000,
    recommendedOptionKey: 'FIXED:STANDARD',
    selectedOptionKey: 'FIXED:STANDARD',
    quoteVersion: 'shipq_test_1234',
    note: 'fallback',
    options: [
      {
        key: 'FIXED:STANDARD',
        provider: 'FIXED',
        serviceId: null,
        serviceTypeId: null,
        serviceName: 'Tam tinh',
        providerCost: 25000,
        customerFee: 25000,
        estimatedDeliveryDate: null,
        availability: 'fallback',
        isRecommended: true,
        reason: 'fallback',
        rawQuote: null,
      },
    ],
    shippingQuote: {
      provider: 'FIXED',
      serviceId: null,
      serviceTypeId: null,
      fee: 25000,
      status: 'fallback',
      estimatedDeliveryDate: null,
      rawQuote: null,
    },
  },
  appliedCoupon: null,
  appliedMembership: null,
});

describe('orderService', () => {
  it('calculates awarded points from the rule snapshot stored on the order', () => {
    expect(calculateLoyaltyPointsForOrder({
      totalAmount: 385000,
      loyaltyRuleSnapshot: {
        ruleId: null,
        name: 'Double points',
        spendAmount: 1000,
        pointsEarned: 2,
        minOrderAmount: 0,
        roundMode: 'floor',
      },
    } as never)).toBe(770);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSession = createMockSession();
    jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession as never);
    mockedCouponService.reserveCouponUsage.mockResolvedValue(null);
    mockedCouponService.recordCouponUsage.mockResolvedValue(null);
    mockedCouponService.rollbackRecordedCouponUsage.mockResolvedValue(undefined);
    mockedCouponService.rollbackCouponUsageReservation.mockResolvedValue(undefined);
    mockedTransactionService.createPendingTransaction.mockResolvedValue({
      _id: new Types.ObjectId('665000000000000000000091'),
    } as never);
    mockedTransactionService.createManualAdjustmentTransaction.mockResolvedValue({
      _id: new Types.ObjectId('665000000000000000000092'),
    } as never);
    mockedTransactionService.resolveTransaction.mockResolvedValue(null as never);
    mockedInventoryService.restoreImportRemainingQuantities.mockResolvedValue(undefined);
    mockedLoyaltyRuleService.getActiveRuleSnapshot.mockResolvedValue({
      ruleId: null,
      name: 'Default 1 point / 1,000 VND',
      spendAmount: 1000,
      pointsEarned: 1,
      minOrderAmount: 0,
      roundMode: 'floor',
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects MOMO checkout until the gateway is integrated', async () => {
    await expect(
      orderService.createOrder(userId, {
        cartItemIds: [cartItemId.toString()],
        paymentMethod: 'MOMO',
        quoteVersion: 'shipq_test_1234',
        shippingAddress,
      }),
    ).rejects.toMatchObject({
      message: 'Payment method MOMO is not supported in this phase. Supported: COD, VNPAY',
      statusCode: 400,
    });

    expect(mockedPromotionPricingService.calculateCheckout).not.toHaveBeenCalled();
    expect(mockedInventoryService.reserveInventory).not.toHaveBeenCalled();
  });

  it('creates a COD order by reserving and committing inventory', async () => {
    const order = {
      _id: new Types.ObjectId(),
      orderCode: 'FSORDER',
      paymentMethod: 'COD',
      paymentStatus: 'pending',
      status: 'confirmed',
    };

    mockedPromotionPricingService.calculateCheckout.mockResolvedValue(buildPricingResult());
    mockedInventoryService.reserveInventory.mockResolvedValue([
      { _id: reservationId },
    ] as never);
    mockedInventoryService.commitReservations.mockResolvedValue([] as never);
    mockedOrder.create.mockResolvedValue([order] as never);
    mockedProduct.updateOne.mockResolvedValue({} as never);
    mockedCartService.deleteCartItems.mockResolvedValue({} as never);

    const result = await orderService.createOrder(userId, {
      cartItemIds: [cartItemId.toString()],
      paymentMethod: 'COD',
      quoteVersion: 'shipq_test_1234',
      shippingAddress,
    });

    expect(mockedPromotionPricingService.calculateCheckout).toHaveBeenCalledWith({
      userId,
      cartItemIds: [cartItemId.toString()],
      couponCode: undefined,
      paymentMethod: 'COD',
      shippingAddress: normalizedShippingAddress,
    });
    expect(mockSession.withTransaction).toHaveBeenCalledTimes(1);
    expect(mockedCouponService.reserveCouponUsage).not.toHaveBeenCalled();
    expect(mockedInventoryService.reserveInventory).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,
        items: [
          {
            productId: productId.toString(),
            variantId: variantId.toString(),
            colorVariantId: colorVariantId.toString(),
            size: 'M',
            quantity: 2,
          },
        ],
      }),
      { session: mockSession },
    );
    expect(mockedCouponService.recordCouponUsage).not.toHaveBeenCalled();
    expect(mockedOrder.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          _id: expect.any(Types.ObjectId),
          user_id: expect.any(Types.ObjectId),
          order_list: [
            expect.objectContaining({
              productId,
              variantId,
              colorVariantId,
              size: 'M',
              sku: 'INV-TEE-BLK-M',
              quantity: 2,
              priceAtPurchased: 180000,
            }),
          ],
          subTotal: 360000,
          shippingFee: 25000,
          couponCode: null,
          couponId: null,
          couponDiscountAmount: 0,
          shippingDiscountAmount: 0,
          membershipDiscountAmount: 0,
          taxAmount: 0,
          totalAmount: 385000,
          status: 'confirmed',
          paymentMethod: 'COD',
          paymentStatus: 'pending',
          paymentDeadlineAt: null,
          shipping: expect.objectContaining({
            provider: 'FIXED',
            customerFee: 25000,
            quotedProviderCost: 25000,
            recommendedOptionKey: 'FIXED:STANDARD',
            selectedOptionKey: 'FIXED:STANDARD',
            quoteVersion: 'shipq_test_1234',
            status: 'fallback',
          }),
          shippingAddress: normalizedShippingAddress,
        }),
      ],
      { session: mockSession },
    );
    expect(mockedOrder.create.mock.calls[0][0][0].order_list[0]).not.toHaveProperty('categoryId');
    expect(mockedInventoryService.commitReservations).toHaveBeenCalledWith(
      { reservationIds: [reservationId.toString()] },
      { session: mockSession },
    );
    expect(mockedCartService.deleteCartItems).toHaveBeenCalledWith(userId, [cartItemId.toString()]);
    expect(result).toBe(order);
  });

  it('creates a COD order from a saved user address id', async () => {
    const order = {
      _id: new Types.ObjectId(),
      orderCode: 'FSORDER',
      paymentMethod: 'COD',
      paymentStatus: 'pending',
      status: 'confirmed',
    };

    mockUserAddressLookup([{ ...shippingAddress, _id: addressId, isDefault: true }]);
    mockedPromotionPricingService.calculateCheckout.mockResolvedValue(buildPricingResult());
    mockedInventoryService.reserveInventory.mockResolvedValue([
      { _id: reservationId },
    ] as never);
    mockedInventoryService.commitReservations.mockResolvedValue([] as never);
    mockedOrder.create.mockResolvedValue([order] as never);
    mockedProduct.updateOne.mockResolvedValue({} as never);
    mockedCartService.deleteCartItems.mockResolvedValue({} as never);

    const result = await orderService.createOrder(userId, {
      cartItemIds: [cartItemId.toString()],
      paymentMethod: 'COD',
      quoteVersion: 'shipq_test_1234',
      addressId: addressId.toString(),
    });

    expect(mockedUser.findById).toHaveBeenCalledWith(userId);
    expect(mockedPromotionPricingService.calculateCheckout).toHaveBeenCalledWith({
      userId,
      cartItemIds: [cartItemId.toString()],
      couponCode: undefined,
      paymentMethod: 'COD',
      shippingAddress: normalizedShippingAddress,
    });
    expect(mockedOrder.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          shippingAddress: normalizedShippingAddress,
        }),
      ],
      { session: mockSession },
    );
    expect(result).toBe(order);
  });

  it('aborts an online order transaction when pending transaction creation fails', async () => {
    const order = {
      _id: new Types.ObjectId(),
      orderCode: 'FSORDER',
      paymentMethod: 'VNPAY',
      paymentStatus: 'pending',
      status: 'confirmed',
      save: jest.fn().mockResolvedValue(undefined),
    };

    mockedPromotionPricingService.calculateCheckout.mockResolvedValue(buildPricingResult());
    mockedInventoryService.reserveInventory.mockResolvedValue([
      { _id: reservationId },
    ] as never);
    mockedOrder.create.mockResolvedValue([order] as never);
    mockedTransactionService.createPendingTransaction.mockRejectedValue(new Error('transaction create failed'));

    await expect(
      orderService.createOrder(userId, {
        cartItemIds: [cartItemId.toString()],
        paymentMethod: 'VNPAY',
        quoteVersion: 'shipq_test_1234',
        shippingAddress,
      }),
    ).rejects.toThrow('transaction create failed');

    expect(mockedTransactionService.createPendingTransaction).toHaveBeenCalledWith(expect.objectContaining({
      userId,
      orderId: expect.any(String),
      amount: 385000,
      paymentMethod: 'VNPAY',
      gatewayProvider: 'vnpay',
      session: mockSession,
    }));
    expect(mockedOrder.create).toHaveBeenCalledWith(
      [expect.objectContaining({
        paymentMethod: 'VNPAY',
        paymentDeadlineAt: expect.any(Date),
        paymentDeadlineWarningSentAt: null,
      })],
      { session: mockSession },
    );
    expect(mockedInventoryService.commitReservations).not.toHaveBeenCalled();
    expect(mockedInventoryService.releaseReservations).not.toHaveBeenCalled();
    expect(mockedTransactionService.resolveTransaction).not.toHaveBeenCalled();
    expect(order.status).toBe('confirmed');
    expect(order.save).not.toHaveBeenCalled();
    expect(mockedCartService.deleteCartItems).not.toHaveBeenCalled();
  });

  it('aborts the order transaction when inventory commit fails', async () => {
    const transactionId = new Types.ObjectId('665000000000000000000092');
    const order = {
      _id: new Types.ObjectId(),
      orderCode: 'FSORDER',
      paymentMethod: 'VNPAY',
      paymentStatus: 'pending',
      status: 'confirmed',
      save: jest.fn().mockResolvedValue(undefined),
    };

    mockedPromotionPricingService.calculateCheckout.mockResolvedValue(buildPricingResult());
    mockedInventoryService.reserveInventory.mockResolvedValue([
      { _id: reservationId },
    ] as never);
    mockedOrder.create.mockResolvedValue([order] as never);
    mockedTransactionService.createPendingTransaction.mockResolvedValue({ _id: transactionId } as never);
    mockedInventoryService.commitReservations.mockRejectedValue(new Error('commit failed'));

    await expect(
      orderService.createOrder(userId, {
        cartItemIds: [cartItemId.toString()],
        paymentMethod: 'VNPAY',
        quoteVersion: 'shipq_test_1234',
        shippingAddress,
      }),
    ).rejects.toThrow('commit failed');

    expect(mockedTransactionService.createPendingTransaction).toHaveBeenCalledWith(expect.objectContaining({
      session: mockSession,
    }));
    expect(mockedTransactionService.resolveTransaction).not.toHaveBeenCalled();
    expect(mockedInventoryService.releaseReservations).not.toHaveBeenCalled();
    expect(order.status).toBe('confirmed');
    expect(order.save).not.toHaveBeenCalled();
    expect(mockedCartService.deleteCartItems).not.toHaveBeenCalled();
  });

  it('rejects create order when quoteVersion is missing', async () => {
    await expect(
      orderService.createOrder(userId, {
        cartItemIds: [cartItemId.toString()],
        paymentMethod: 'COD',
        shippingAddress,
      } as never),
    ).rejects.toMatchObject({
      message: 'Shipping quote is required. Please preview checkout again.',
      statusCode: 400,
      errorCode: 'QUOTE_REQUIRED',
    });

    expect(mockedPromotionPricingService.calculateCheckout).not.toHaveBeenCalled();
    expect(mockedInventoryService.reserveInventory).not.toHaveBeenCalled();
    expect(mockedOrder.create).not.toHaveBeenCalled();
  });

  it('rejects create order when quoteVersion is blank', async () => {
    await expect(
      orderService.createOrder(userId, {
        cartItemIds: [cartItemId.toString()],
        paymentMethod: 'COD',
        quoteVersion: '  ',
        shippingAddress,
      }),
    ).rejects.toMatchObject({
      message: 'Shipping quote is required. Please preview checkout again.',
      statusCode: 400,
      errorCode: 'QUOTE_REQUIRED',
    });

    expect(mockedPromotionPricingService.calculateCheckout).not.toHaveBeenCalled();
    expect(mockedInventoryService.reserveInventory).not.toHaveBeenCalled();
  });

  it('previews checkout with the default saved address when no address payload is sent', async () => {
    mockUserAddressLookup([{ ...shippingAddress, _id: addressId, isDefault: true }]);
    mockedPromotionPricingService.calculateCheckout.mockResolvedValue(buildPricingResult());

    await orderService.previewCheckout(userId, {
      cartItemIds: [cartItemId.toString()],
      paymentMethod: 'COD',
    });

    expect(mockedPromotionPricingService.calculateCheckout).toHaveBeenCalledWith({
      userId,
      cartItemIds: [cartItemId.toString()],
      couponCode: undefined,
      paymentMethod: 'COD',
      shippingAddress: normalizedShippingAddress,
    });
  });

  it('supports legacy saved addresses without wardCode during checkout preview', async () => {
    const legacyAddress = { ...shippingAddress, _id: addressId, isDefault: true } as Record<string, unknown>;
    delete legacyAddress.wardCode;
    mockedUser.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ address: [legacyAddress] }),
    } as never);
    mockedPromotionPricingService.calculateCheckout.mockResolvedValue(buildPricingResult());

    await expect(orderService.previewCheckout(userId, {
      cartItemIds: [cartItemId.toString()],
      paymentMethod: 'COD',
    })).resolves.toBeDefined();

    expect(mockedPromotionPricingService.calculateCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        shippingAddress: expect.objectContaining({ wardCode: expect.any(String) }),
      }),
    );
  });

  it('returns the order when post-commit cart cleanup fails', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const order = {
      _id: new Types.ObjectId(),
      orderCode: 'FSORDER',
      paymentMethod: 'COD',
      paymentStatus: 'pending',
      status: 'confirmed',
    };

    mockedPromotionPricingService.calculateCheckout.mockResolvedValue(buildPricingResult());
    mockedInventoryService.reserveInventory.mockResolvedValue([
      { _id: reservationId },
    ] as never);
    mockedInventoryService.commitReservations.mockResolvedValue([] as never);
    mockedOrder.create.mockResolvedValue([order] as never);
    mockedProduct.updateOne.mockResolvedValue({} as never);
    mockedCartService.deleteCartItems.mockRejectedValue(new Error('cart cleanup failed'));

    const result = await orderService.createOrder(userId, {
      cartItemIds: [cartItemId.toString()],
      paymentMethod: 'COD',
      quoteVersion: 'shipq_test_1234',
      shippingAddress,
    });

    expect(result).toBe(order);
    expect(mockedInventoryService.releaseReservations).not.toHaveBeenCalled();
    expect(mockedCouponService.rollbackCouponUsageReservation).not.toHaveBeenCalled();
    expect(mockedCouponService.rollbackRecordedCouponUsage).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to delete cart items after order creation:',
      expect.any(Error),
    );
  });

  it('aborts the order transaction when order creation fails after inventory is reserved', async () => {
    mockedPromotionPricingService.calculateCheckout.mockResolvedValue(buildPricingResult());
    mockedInventoryService.reserveInventory.mockResolvedValue([
      { _id: reservationId },
    ] as never);
    mockedOrder.create.mockRejectedValue(new Error('create failed'));

    await expect(
      orderService.createOrder(userId, {
        cartItemIds: [cartItemId.toString()],
        paymentMethod: 'COD',
        quoteVersion: 'shipq_test_1234',
        shippingAddress,
      }),
    ).rejects.toThrow('create failed');

    expect(mockedInventoryService.releaseReservations).not.toHaveBeenCalled();
    expect(mockedCouponService.rollbackCouponUsageReservation).not.toHaveBeenCalled();
    expect(mockedCouponService.rollbackRecordedCouponUsage).not.toHaveBeenCalled();
    expect(mockedCartService.deleteCartItems).not.toHaveBeenCalled();
  });

  it('rejects create order when quoteVersion is stale', async () => {
    mockedPromotionPricingService.calculateCheckout.mockResolvedValue(buildPricingResult());

    await expect(
      orderService.createOrder(userId, {
        cartItemIds: [cartItemId.toString()],
        paymentMethod: 'COD',
        quoteVersion: 'shipq_stale',
        shippingAddress,
      }),
    ).rejects.toMatchObject({
      message: 'Shipping quote has changed. Please preview again.',
      statusCode: 409,
      errorCode: 'QUOTE_CHANGED',
    });

    expect(mockedInventoryService.reserveInventory).not.toHaveBeenCalled();
    expect(mockedOrder.create).not.toHaveBeenCalled();
  });

  it('restocks inventory and keeps paid orders paid when cancelled', async () => {
    const orderId = new Types.ObjectId('665000000000000000000050');
    const couponId = new Types.ObjectId('665000000000000000000090');
    const order = {
      _id: orderId,
      user_id: new Types.ObjectId(userId),
      couponId,
      status: 'confirmed',
      paymentMethod: 'COD',
      paymentStatus: 'paid',
      order_list: [
        {
          productId,
          variantId,
          colorVariantId,
          size: 'M',
          quantity: 2,
        },
      ],
      save: jest.fn(),
    };
    order.save.mockResolvedValue(order as never);
    mockedOrder.findById.mockResolvedValue(order as never);
    mockAtomicCancel(order);
    mockedInventory.updateOne.mockResolvedValue({} as never);
    mockedProduct.updateOne.mockResolvedValue({} as never);

    const result = await orderService.cancelOrder(userId, undefined, orderId.toString());

    expect(mockedInventory.updateOne).toHaveBeenCalledWith(
      {
        productId,
        variantId,
        colorVariantId,
        size: 'M',
      },
      {
        $inc: {
          quantity: 2,
          availableQuantity: 2,
        },
      },
    );
    expect(mockedProduct.updateOne).toHaveBeenCalledWith(
      { _id: productId, sold_quantity: { $gte: 2 } },
      { $inc: { sold_quantity: -2 } },
    );
    expect(mockedInventoryService.restoreImportRemainingQuantities).toHaveBeenCalledWith([
      {
        productId,
        variantId,
        colorVariantId,
        size: 'M',
        quantity: 2,
      },
    ]);
    expect(mockedOrder.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: orderId,
        status: 'confirmed',
      },
      {
        $set: {
          status: 'cancelled',
          cancellation: expect.objectContaining({
            actorRole: 'user',
            cancelledAt: expect.any(Date),
          }),
        },
      },
      {
        returnDocument: 'after',
        runValidators: true,
      },
    );
    expect(order.status).toBe('cancelled');
    expect(order.paymentStatus).toBe('paid');
    expect(order.save).not.toHaveBeenCalled();
    expect(mockedCouponService.rollbackRecordedCouponUsage).toHaveBeenCalledWith(orderId.toString(), {});
    expect(mockedCouponService.rollbackCouponUsageReservation).toHaveBeenCalledWith(
      couponId.toString(),
      userId,
      {},
    );
    expect(result).toBe(order);
  });

  it('lets the customer cancel a new COD order before packing', async () => {
    const orderId = new Types.ObjectId('665000000000000000000061');
    const order = {
      _id: orderId,
      user_id: new Types.ObjectId(userId),
      status: 'confirmed',
      paymentMethod: 'COD',
      paymentStatus: 'pending',
      cancellation: null as {
        reason?: string;
        actorRole?: string;
        cancelledAt?: Date;
      } | null,
      order_list: [
        {
          productId,
          variantId,
          colorVariantId,
          size: 'M',
          quantity: 1,
        },
      ],
      save: jest.fn(),
    };
    order.save.mockResolvedValue(order as never);
    mockedOrder.findById.mockResolvedValue(order as never);
    mockAtomicCancel(order);
    mockedInventory.updateOne.mockResolvedValue({} as never);
    mockedProduct.updateOne.mockResolvedValue({} as never);

    const result = await orderService.cancelOrder(userId, undefined, orderId.toString(), {
      reason: 'Customer changed mind',
    });

    expect(mockedInventory.updateOne).toHaveBeenCalledWith(
      {
        productId,
        variantId,
        colorVariantId,
        size: 'M',
      },
      {
        $inc: {
          quantity: 1,
          availableQuantity: 1,
        },
      },
    );
    expect(order.status).toBe('cancelled');
    expect(order.paymentStatus).toBe('pending');
    expect(order.cancellation).toEqual(expect.objectContaining({
      reason: 'Customer changed mind',
      actorRole: 'user',
      cancelledAt: expect.any(Date),
    }));
    expect(order.save).not.toHaveBeenCalled();
    expect(result).toBe(order);
  });

  it('keeps a paid online order paid when the customer cancels before packing', async () => {
    const orderId = new Types.ObjectId('665000000000000000000062');
    const order = {
      _id: orderId,
      user_id: new Types.ObjectId(userId),
      status: 'confirmed',
      paymentMethod: 'VNPAY',
      paymentStatus: 'paid',
      cancellation: null as {
        reason?: string;
        actorRole?: string;
      } | null,
      order_list: [],
      save: jest.fn(),
    };
    order.save.mockResolvedValue(order as never);
    mockedOrder.findById.mockResolvedValue(order as never);
    mockAtomicCancel(order);

    const result = await orderService.cancelOrder(userId, undefined, orderId.toString(), {
      reason: 'Customer cancelled after payment',
    });

    expect(order.status).toBe('cancelled');
    expect(order.paymentStatus).toBe('paid');
    expect(order.cancellation).toEqual(expect.objectContaining({
      reason: 'Customer cancelled after payment',
      actorRole: 'user',
    }));
    expect(order.save).not.toHaveBeenCalled();
    expect(result).toBe(order);
  });

  it('does not restock when a concurrent cancellation already changed the order status', async () => {
    const orderId = new Types.ObjectId('665000000000000000000069');
    const order = {
      _id: orderId,
      user_id: new Types.ObjectId(userId),
      status: 'confirmed',
      paymentMethod: 'COD',
      paymentStatus: 'pending',
      order_list: [
        {
          productId,
          variantId,
          colorVariantId,
          size: 'M',
          quantity: 1,
        },
      ],
      save: jest.fn(),
    };
    mockedOrder.findById.mockResolvedValue(order as never);
    mockedOrder.findOneAndUpdate.mockResolvedValue(null);

    await expect(
      orderService.cancelOrder(userId, undefined, orderId.toString()),
    ).rejects.toMatchObject({
      message: 'Order status changed. Please reload and try again.',
      statusCode: 409,
    });

    expect(mockedInventory.updateOne).not.toHaveBeenCalled();
    expect(mockedInventoryService.restoreImportRemainingQuantities).not.toHaveBeenCalled();
    expect(mockedProduct.updateOne).not.toHaveBeenCalled();
  });

  it('does not allow cancelling an order that is already shipping', async () => {
    const orderId = new Types.ObjectId('665000000000000000000063');
    const order = {
      _id: orderId,
      user_id: new Types.ObjectId(userId),
      status: 'shipping',
      paymentMethod: 'COD',
      paymentStatus: 'pending',
      shipping: {
        status: 'shipping',
      },
      order_list: [],
      save: jest.fn(),
    };
    mockedOrder.findById.mockResolvedValue(order as never);

    await expect(
      orderService.cancelOrder(userId, undefined, orderId.toString(), {
        reason: 'Cancel while shipping',
      }),
    ).rejects.toThrow('Cannot transition order from shipping to cancelled');

    expect(mockedInventory.updateOne).not.toHaveBeenCalled();
    expect(order.save).not.toHaveBeenCalled();
  });

  it('lets the owning customer confirm a delivered order as completed', async () => {
    const orderId = new Types.ObjectId('665000000000000000000052');
    const order = {
      _id: orderId,
      orderCode: 'FSDELIVERED',
      invoiceCode: null,
      user_id: new Types.ObjectId(userId),
      status: 'delivered',
      deliveredAt: new Date('2026-06-24T08:00:00.000Z'),
      receivedAt: null,
      paymentMethod: 'COD',
      paymentStatus: 'pending',
      shipping: {
        status: 'delivered',
      },
      order_list: [],
      save: jest.fn(),
    };
    order.save.mockResolvedValue(order as never);
    mockedOrder.findById.mockResolvedValue(order as never);

    const result = await orderService.confirmOrderReceived(userId, orderId.toString());

    expect(order.status).toBe('completed');
    expect(order.paymentStatus).toBe('paid');
    expect(order.invoiceCode).toBe('INV-FSDELIVERED');
    expect(order.deliveredAt).toEqual(new Date('2026-06-24T08:00:00.000Z'));
    expect(order.receivedAt).toEqual(expect.any(Date));
    expect(order.shipping.status).toBe('delivered');
    expect(order.save).toHaveBeenCalled();
    expect(result).toBe(order);
  });

  it('does not let the customer confirm receipt before carrier delivery', async () => {
    const orderId = new Types.ObjectId('665000000000000000000064');
    const order = {
      _id: orderId,
      user_id: new Types.ObjectId(userId),
      status: 'shipping',
      deliveredAt: null,
      paymentMethod: 'COD',
      paymentStatus: 'pending',
      shipping: {
        status: 'shipping',
      },
      order_list: [],
      save: jest.fn(),
    };
    mockedOrder.findById.mockResolvedValue(order as never);

    await expect(
      orderService.confirmOrderReceived(userId, orderId.toString()),
    ).rejects.toThrow('Order can only be confirmed received after it is delivered');

    expect(order.status).toBe('shipping');
    expect(order.paymentStatus).toBe('pending');
    expect(order.save).not.toHaveBeenCalled();
  });

  it('awards loyalty points once when a customer confirms delivery', async () => {
    const orderId = new Types.ObjectId('665000000000000000000066');
    const order = {
      _id: orderId,
      user_id: new Types.ObjectId(userId),
      status: 'delivered',
      deliveredAt: new Date('2026-06-24T08:00:00.000Z'),
      paymentMethod: 'COD',
      paymentStatus: 'pending',
      totalAmount: 385000,
      loyaltyPointsAwarded: 0,
      shipping: { status: 'delivered' },
      order_list: [],
      save: jest.fn(),
    };
    const awardedOrder = { ...order, status: 'completed', loyaltyPointsAwarded: 385 };
    order.save.mockResolvedValue(order as never);
    mockedOrder.findById.mockResolvedValue(order as never);
    mockedOrder.findOneAndUpdate.mockResolvedValue(awardedOrder as never);
    mockedUser.findOneAndUpdate.mockResolvedValue({ loyaltyPoint: 585 } as never);
    mockedLoyaltyPointHistory.create.mockResolvedValue([] as never);

    const result = await orderService.confirmOrderReceived(userId, orderId.toString());

    expect(mockedOrder.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ _id: orderId, status: { $in: ['delivered', 'completed'] } }),
      { $set: { loyaltyPointsAwarded: 385 } },
      expect.objectContaining({ session: mockSession }),
    );
    expect(mockedUser.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: new Types.ObjectId(userId) },
      { $inc: { loyaltyPoint: 385 } },
      expect.objectContaining({ session: mockSession }),
    );
    expect(mockedLoyaltyPointHistory.create).toHaveBeenCalledWith(
      [expect.objectContaining({ orderId, type: 'earn', delta: 385, balanceAfter: 585 })],
      { session: mockSession },
    );
    expect(result).toBe(awardedOrder);
  });

  it('does not let the customer confirm receipt after delivery failed', async () => {
    const orderId = new Types.ObjectId('665000000000000000000064');
    const order = {
      _id: orderId,
      user_id: new Types.ObjectId(userId),
      status: 'shipping',
      deliveredAt: null,
      paymentMethod: 'COD',
      paymentStatus: 'pending',
      shipping: {
        status: 'failed',
      },
      order_list: [],
      save: jest.fn(),
    };
    mockedOrder.findById.mockResolvedValue(order as never);

    await expect(
      orderService.confirmOrderReceived(userId, orderId.toString()),
    ).rejects.toThrow('Order can only be confirmed received after it is delivered');

    expect(order.status).toBe('shipping');
    expect(order.paymentStatus).toBe('pending');
    expect(order.save).not.toHaveBeenCalled();
  });

  it('lets the owning customer request return after delivery', async () => {
    const orderId = new Types.ObjectId('665000000000000000000053');
    const order = {
      _id: orderId,
      user_id: new Types.ObjectId(userId),
      status: 'delivered',
      deliveredAt: new Date(),
      paymentMethod: 'VNPAY',
      paymentStatus: 'paid',
      returnRequest: null,
      order_list: [],
      save: jest.fn(),
    };
    order.save.mockResolvedValue(order as never);
    mockedOrder.findById.mockResolvedValue(order as never);

    const result = await orderService.requestReturn(userId, orderId.toString(), {
      reason: 'Size is not suitable',
    });

    expect(order.status).toBe('return_requested');
    expect(order.paymentStatus).toBe('paid');
    expect(order.returnRequest).toEqual({
      reason: 'Size is not suitable',
      status: 'requested',
      previousOrderStatus: 'delivered',
      requestedAt: expect.any(Date),
      reviewedAt: null,
      reviewedBy: null,
      reviewReason: null,
    });
    expect(order.save).toHaveBeenCalled();
    expect(result).toBe(order);
  });

  it('rejects return requests after the 7 day delivery window', async () => {
    const orderId = new Types.ObjectId('665000000000000000000059');
    const order = {
      _id: orderId,
      user_id: new Types.ObjectId(userId),
      status: 'delivered',
      deliveredAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      paymentMethod: 'VNPAY',
      paymentStatus: 'paid',
      returnRequest: null,
      order_list: [],
      save: jest.fn(),
    };
    mockedOrder.findById.mockResolvedValue(order as never);

    await expect(
      orderService.requestReturn(userId, orderId.toString(), {
        reason: 'Size is not suitable',
      }),
    ).rejects.toThrow('Return requests are only available within 7 days after delivery');

    expect(order.save).not.toHaveBeenCalled();
  });

  it('approves a pending return request without changing payment status', async () => {
    const orderId = new Types.ObjectId('665000000000000000000055');
    const order = {
      _id: orderId,
      user_id: new Types.ObjectId(userId),
      status: 'return_requested',
      paymentMethod: 'VNPAY',
      paymentStatus: 'paid',
      returnRequest: {
        reason: 'Size is not suitable',
        status: 'requested',
        requestedAt: new Date('2026-01-01T00:00:00.000Z'),
        reviewedAt: null,
        reviewedBy: null,
        reviewReason: null,
      },
      order_list: [],
      save: jest.fn(),
    };
    order.save.mockResolvedValue(order as never);
    mockedOrder.findById.mockResolvedValue(order as never);

    const result = await orderService.reviewReturnRequest(orderId.toString(), userId, {
      decision: 'approved',
      reason: 'Eligible return',
    });

    expect(order.status).toBe('returned');
    expect(order.paymentStatus).toBe('paid');
    expect(order.returnRequest).toEqual({
      reason: 'Size is not suitable',
      status: 'approved',
      previousOrderStatus: null,
      requestedAt: new Date('2026-01-01T00:00:00.000Z'),
      reviewedAt: expect.any(Date),
      reviewedBy: new Types.ObjectId(userId),
      reviewReason: 'Eligible return',
    });
    expect(order.save).toHaveBeenCalled();
    expect(result).toBe(order);
  });

  it('claws back awarded loyalty points when a return is approved', async () => {
    const orderId = new Types.ObjectId('665000000000000000000067');
    const order = {
      _id: orderId,
      user_id: new Types.ObjectId(userId),
      status: 'return_requested',
      paymentMethod: 'VNPAY',
      paymentStatus: 'paid',
      loyaltyPointsAwarded: 385,
      returnRequest: {
        reason: 'Size is not suitable',
        status: 'requested',
        requestedAt: new Date('2026-01-01T00:00:00.000Z'),
        reviewedAt: null,
        reviewedBy: null,
        reviewReason: null,
      },
      order_list: [],
      save: jest.fn(),
    };
    const adjustedOrder = { ...order, loyaltyPointsClawedBack: 385 };
    order.save.mockResolvedValue(order as never);
    mockedOrder.findById.mockResolvedValue(order as never);
    mockedOrder.findOneAndUpdate.mockResolvedValue(adjustedOrder as never);
    mockedUser.findOneAndUpdate.mockResolvedValue({ loyaltyPoint: 0 } as never);
    mockedLoyaltyPointHistory.create.mockResolvedValue([] as never);

    const result = await orderService.reviewReturnRequest(orderId.toString(), userId, {
      decision: 'approved',
      reason: 'Eligible return',
    });

    expect(mockedOrder.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: orderId,
        loyaltyPointsAwarded: 385,
        $or: [
          { loyaltyPointsClawedBack: { $exists: false } },
          { loyaltyPointsClawedBack: { $lt: 385 } },
        ],
      }),
      { $inc: { loyaltyPointsClawedBack: 385 } },
      expect.objectContaining({ session: mockSession }),
    );
    expect(mockedUser.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: new Types.ObjectId(userId) },
      [{ $set: { loyaltyPoint: { $max: [0, { $subtract: ['$loyaltyPoint', 385] }] } } }],
      expect.objectContaining({ session: mockSession, updatePipeline: true }),
    );
    expect(mockedLoyaltyPointHistory.create).toHaveBeenCalledWith(
      [expect.objectContaining({ orderId, type: 'adjust', delta: -385, balanceAfter: 0 })],
      { session: mockSession },
    );
    expect(result).toBe(adjustedOrder);
  });

  it('rejects a pending return request and restores the delivered status', async () => {
    const orderId = new Types.ObjectId('665000000000000000000056');
    const order = {
      _id: orderId,
      user_id: new Types.ObjectId(userId),
      status: 'return_requested',
      paymentMethod: 'COD',
      paymentStatus: 'paid',
      returnRequest: {
        reason: 'Changed my mind',
        status: 'requested',
        requestedAt: new Date('2026-01-01T00:00:00.000Z'),
        reviewedAt: null,
        reviewedBy: null,
        reviewReason: null,
      },
      order_list: [],
      save: jest.fn(),
    };
    order.save.mockResolvedValue(order as never);
    mockedOrder.findById.mockResolvedValue(order as never);

    const result = await orderService.reviewReturnRequest(orderId.toString(), userId, {
      decision: 'rejected',
      reason: 'Product was already used',
    });

    expect(order.status).toBe('delivered');
    expect(order.returnRequest).toEqual({
      reason: 'Changed my mind',
      status: 'rejected',
      previousOrderStatus: null,
      requestedAt: new Date('2026-01-01T00:00:00.000Z'),
      reviewedAt: expect.any(Date),
      reviewedBy: new Types.ObjectId(userId),
      reviewReason: 'Product was already used',
    });
    expect(order.save).toHaveBeenCalled();
    expect(result).toBe(order);
  });

  it('rejects a pending return request and restores the completed status when the customer had confirmed receipt', async () => {
    const orderId = new Types.ObjectId('665000000000000000000068');
    const order = {
      _id: orderId,
      user_id: new Types.ObjectId(userId),
      status: 'return_requested',
      paymentMethod: 'COD',
      paymentStatus: 'paid',
      returnRequest: {
        reason: 'Changed my mind',
        status: 'requested',
        previousOrderStatus: 'completed',
        requestedAt: new Date('2026-01-01T00:00:00.000Z'),
        reviewedAt: null,
        reviewedBy: null,
        reviewReason: null,
      },
      order_list: [],
      save: jest.fn(),
    };
    order.save.mockResolvedValue(order as never);
    mockedOrder.findById.mockResolvedValue(order as never);

    const result = await orderService.reviewReturnRequest(orderId.toString(), userId, {
      decision: 'rejected',
      reason: 'Product was already used',
    });

    expect(order.status).toBe('completed');
    expect(order.returnRequest).toEqual(expect.objectContaining({
      status: 'rejected',
      previousOrderStatus: 'completed',
      reviewReason: 'Product was already used',
    }));
    expect(order.save).toHaveBeenCalled();
    expect(result).toBe(order);
  });

  it('requires a reason when rejecting a return request', async () => {
    const orderId = new Types.ObjectId('665000000000000000000057');
    const order = {
      _id: orderId,
      user_id: new Types.ObjectId(userId),
      status: 'return_requested',
      paymentMethod: 'COD',
      paymentStatus: 'paid',
      returnRequest: {
        reason: 'Changed my mind',
        status: 'requested',
        requestedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      order_list: [],
      save: jest.fn(),
    };
    mockedOrder.findById.mockResolvedValue(order as never);

    await expect(
      orderService.reviewReturnRequest(orderId.toString(), userId, {
        decision: 'rejected',
      }),
    ).rejects.toThrow('Return rejection reason is required');

    expect(order.save).not.toHaveBeenCalled();
  });

  it('lists orders with grouped statuses and keeps status summary outside the selected group', async () => {
    const orderItems = [{ _id: new Types.ObjectId(), status: 'cancelled' }];
    const findQuery = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(orderItems),
    };

    mockedOrder.find.mockReturnValue(findQuery as never);
    mockedOrder.countDocuments.mockResolvedValue(2 as never);
    mockedOrder.aggregate.mockResolvedValue([
      { _id: 'confirmed', count: 3 },
      { _id: 'cancelled', count: 1 },
      { _id: 'returned', count: 1 },
    ] as never);

    const result = await orderService.getOrders({
      statuses: ['cancelled', 'returned'],
      paymentMethods: ['VNPAY', 'MOMO'],
      paymentStatuses: ['paid', 'refunded'],
      page: 2,
      limit: 5,
    });

    expect(mockedOrder.find).toHaveBeenCalledWith({
      status: { $in: ['cancelled', 'returned'] },
      paymentMethod: { $in: ['VNPAY', 'MOMO'] },
      paymentStatus: { $in: ['paid', 'refunded'] },
    });
    expect(mockedOrder.countDocuments).toHaveBeenCalledWith({
      status: { $in: ['cancelled', 'returned'] },
      paymentMethod: { $in: ['VNPAY', 'MOMO'] },
      paymentStatus: { $in: ['paid', 'refunded'] },
    });
    expect(mockedOrder.aggregate).toHaveBeenCalledWith([
      { $match: { paymentMethod: { $in: ['VNPAY', 'MOMO'] }, paymentStatus: { $in: ['paid', 'refunded'] } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    expect(findQuery.sort).toHaveBeenCalledWith({ createdAt: 1 });
    expect(findQuery.skip).toHaveBeenCalledWith(5);
    expect(result.items).toBe(orderItems);
    expect(result.statusSummary.confirmed).toBe(3);
    expect(result.statusSummary.cancelled).toBe(1);
    expect(result.statusSummary.returned).toBe(1);
    expect(result.statusSummary.all).toBe(5);
  });

  it('applies admin order list sort options', async () => {
    const findQuery = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    };

    mockedOrder.find.mockReturnValue(findQuery as never);
    mockedOrder.countDocuments.mockResolvedValue(0 as never);
    mockedOrder.aggregate.mockResolvedValue([] as never);

    await orderService.getOrders({
      sort: 'total_desc',
      page: 1,
      limit: 10,
    });

    expect(findQuery.sort).toHaveBeenCalledWith({ totalAmount: -1, createdAt: -1 });
  });

  it('adjusts payment status through the orders service and emits realtime payment updates', async () => {
    const orderId = new Types.ObjectId('665000000000000000000070');
    const actorId = '665000000000000000000071';
    const order = {
      _id: orderId,
      orderCode: 'FSPAYMENT',
      user_id: new Types.ObjectId(userId),
      status: 'confirmed',
      paymentMethod: 'VNPAY',
      paymentMethodId: null,
      paymentStatus: 'pending',
      totalAmount: 385000,
      shipping: {
        status: 'quoted',
      },
      order_list: [],
      save: jest.fn(),
    };
    order.save.mockResolvedValue(order as never);
    mockedOrder.findById.mockResolvedValue(order as never);

    const result = await orderService.adjustOrderPaymentStatus(orderId.toString(), {
      paymentStatus: 'paid',
      reason: 'Bank reconciliation completed',
      actorId,
    });

    expect(result).toBe(order);
    expect(order.paymentStatus).toBe('paid');
    expect(order.save).toHaveBeenCalled();
    expect(mockedTransactionService.createManualAdjustmentTransaction).toHaveBeenCalledWith({
      userId,
      orderId: orderId.toString(),
      amount: 385000,
      paymentMethod: 'VNPAY',
      paymentMethodId: null,
      status: 'success',
      reason: 'Bank reconciliation completed',
      actorId,
    });
    expect(mockedEmitOrderUpdate).toHaveBeenCalledWith(order, 'payment_update', {
      status: 'confirmed',
      paymentStatus: 'pending',
      shippingStatus: 'quoted',
    });
  });

  it('rejects invalid order status transitions', async () => {
    const orderId = new Types.ObjectId('665000000000000000000051');
    const order = {
      _id: orderId,
      user_id: new Types.ObjectId(userId),
      status: 'confirmed',
      paymentMethod: 'COD',
      paymentStatus: 'pending',
      order_list: [],
      save: jest.fn(),
    };
    mockedOrder.findById.mockResolvedValue(order as never);

    await expect(
      orderService.updateOrderStatus(orderId.toString(), { status: 'delivered' }),
    ).rejects.toThrow('Cannot transition order from confirmed to delivered');

    expect(order.save).not.toHaveBeenCalled();
  });

  it('does not let admin complete a shipping order before carrier delivery', async () => {
    const orderId = new Types.ObjectId('665000000000000000000059');
    const order = {
      _id: orderId,
      user_id: new Types.ObjectId(userId),
      status: 'shipping',
      deliveredAt: null,
      paymentMethod: 'COD',
      paymentStatus: 'pending',
      shipping: {
        status: 'shipping',
      },
      order_list: [],
      save: jest.fn(),
    };
    mockedOrder.findById.mockResolvedValue(order as never);

    await expect(
      orderService.updateOrderStatus(orderId.toString(), { status: 'completed' }),
    ).rejects.toThrow('Cannot transition order from shipping to completed');

    expect(order.status).toBe('shipping');
    expect(order.save).not.toHaveBeenCalled();
  });

  it('lets admin mark a shipping order delivered when carrier delivery is confirmed externally', async () => {
    const orderId = new Types.ObjectId('665000000000000000000058');
    const order = {
      _id: orderId,
      user_id: new Types.ObjectId(userId),
      status: 'shipping',
      deliveredAt: null,
      paymentMethod: 'COD',
      paymentStatus: 'pending',
      shipping: {
        status: 'delivering',
      },
      order_list: [],
      save: jest.fn(),
    };
    order.save.mockResolvedValue(order as never);
    mockedOrder.findById.mockResolvedValue(order as never);

    const result = await orderService.updateOrderStatus(orderId.toString(), { status: 'delivered' });

    expect(order.status).toBe('delivered');
    expect(order.paymentStatus).toBe('paid');
    expect(order.deliveredAt).toEqual(expect.any(Date));
    expect(order.shipping.status).toBe('delivered');
    expect(order.save).toHaveBeenCalled();
    expect(result).toBe(order);
  });

  it('applies a simulated delivered webhook and marks COD as paid', async () => {
    const orderId = new Types.ObjectId('665000000000000000000065');
    const order = {
      _id: orderId,
      user_id: new Types.ObjectId(userId),
      orderCode: 'FS-WEBHOOK-1',
      status: 'shipping',
      deliveredAt: null,
      paymentMethod: 'COD',
      paymentStatus: 'pending',
      shipping: {
        provider: 'GHN',
        status: 'shipping',
        trackingCode: 'GHN123',
        rawShipment: null as Record<string, unknown> | null,
      },
      order_list: [],
      save: jest.fn(),
    };
    order.save.mockResolvedValue(order as never);
    mockedOrder.findById.mockResolvedValue(order as never);

    const result = await orderService.applyShippingWebhook({
      orderId: orderId.toString(),
      status: 'delivered',
      reason: 'GHN delivered',
      trackingCode: 'GHN123',
      rawPayload: { status: 'delivered' },
    });

    expect(order.status).toBe('delivered');
    expect(order.paymentStatus).toBe('paid');
    expect(order.deliveredAt).toEqual(expect.any(Date));
    expect(order.shipping.status).toBe('delivered');
    expect(order.shipping.rawShipment).toEqual({ status: 'delivered' });
    expect(result.before).toEqual(expect.objectContaining({
      status: 'shipping',
      paymentStatus: 'pending',
    }));
    expect(result.reason).toBe('GHN delivered');
    expect(result.order).toBe(order);
  });

  it('acknowledges a repeated delivered webhook without saving or awarding twice', async () => {
    const orderId = new Types.ObjectId('665000000000000000000075');
    const order = {
      _id: orderId,
      user_id: new Types.ObjectId(userId),
      orderCode: 'FS-WEBHOOK-DUPLICATE',
      status: 'delivered',
      deliveredAt: new Date('2026-06-24T08:00:00.000Z'),
      paymentMethod: 'COD',
      paymentStatus: 'paid',
      shipping: {
        provider: 'GHN',
        status: 'delivered',
        trackingCode: 'GHN-DUPLICATE',
      },
      order_list: [],
      save: jest.fn(),
    };
    mockedOrder.findById.mockResolvedValue(order as never);

    const result = await orderService.applyShippingWebhook({
      orderId: orderId.toString(),
      status: 'delivered',
      trackingCode: 'GHN-DUPLICATE',
      rawPayload: { status: 'delivered' },
    });

    expect(result.duplicate).toBe(true);
    expect(result.order).toBe(order);
    expect(order.save).not.toHaveBeenCalled();
  });

  it('auto-completes delivered orders after the customer confirmation window', async () => {
    const orderId = new Types.ObjectId('665000000000000000000076');
    const deliveredAt = new Date('2026-06-10T08:00:00.000Z');
    const now = new Date('2026-06-18T08:00:00.000Z');
    const order = {
      _id: orderId,
      orderCode: 'FSAUTOCOMPLETE',
      invoiceCode: null,
      user_id: new Types.ObjectId(userId),
      status: 'delivered',
      deliveredAt,
      receivedAt: null,
      paymentMethod: 'COD',
      paymentStatus: 'paid',
      totalAmount: 0,
      loyaltyPointsAwarded: 0,
      shipping: {
        status: 'delivered',
      },
      order_list: [],
      save: jest.fn(),
    };
    order.save.mockResolvedValue(order as never);
    const limit = jest.fn().mockResolvedValue([order]);
    mockedOrder.find.mockReturnValue({ limit } as never);

    const result = await orderService.autoCompleteDeliveredOrders(now);

    expect(mockedOrder.find).toHaveBeenCalledWith({
      $or: [
        {
          status: 'delivered',
          deliveredAt: { $lte: new Date('2026-06-11T08:00:00.000Z') },
        },
        {
          status: 'shipping',
          'shipping.estimatedDeliveryDate': { $lte: new Date('2026-06-11T08:00:00.000Z') },
          'shipping.status': { $nin: ['failed', 'cancelled'] },
        },
      ],
    });
    expect(limit).toHaveBeenCalledWith(50);
    expect(order.status).toBe('completed');
    expect(order.receivedAt).toBe(now);
    expect(order.invoiceCode).toBe('INV-FSAUTOCOMPLETE');
    expect(order.save).toHaveBeenCalledWith({ session: mockSession });
    expect(mockedEmitOrderUpdate).toHaveBeenCalledWith(
      order,
      'status_update',
      expect.objectContaining({ status: 'delivered' }),
      undefined,
    );
    expect(result).toMatchObject({
      scannedCount: 1,
      completedCount: 1,
      failedCount: 0,
      completedOrderIds: [orderId.toString()],
    });
  });

  it('auto-completes stale shipping orders after the estimated delivery window', async () => {
    const orderId = new Types.ObjectId('665000000000000000000079');
    const estimatedDeliveryDate = new Date('2026-06-12T08:00:00.000Z');
    const now = new Date('2026-06-20T08:00:00.000Z');
    const order = {
      _id: orderId,
      orderCode: 'FSSTALESHIP',
      invoiceCode: null,
      user_id: new Types.ObjectId(userId),
      status: 'shipping',
      deliveredAt: null,
      receivedAt: null,
      paymentMethod: 'COD',
      paymentStatus: 'pending',
      totalAmount: 0,
      loyaltyPointsAwarded: 0,
      shipping: {
        status: 'shipping',
        estimatedDeliveryDate,
      },
      order_list: [],
      save: jest.fn(),
    };
    order.save.mockResolvedValue(order as never);
    const limit = jest.fn().mockResolvedValue([order]);
    mockedOrder.find.mockReturnValue({ limit } as never);

    const result = await orderService.autoCompleteDeliveredOrders(now);

    expect(order.status).toBe('completed');
    expect(order.paymentStatus).toBe('paid');
    expect(order.deliveredAt).toBe(estimatedDeliveryDate);
    expect(order.receivedAt).toBe(now);
    expect(order.shipping.status).toBe('delivered');
    expect(order.invoiceCode).toBe('INV-FSSTALESHIP');
    expect(mockedEmitOrderUpdate).toHaveBeenCalledWith(
      order,
      'status_update',
      expect.objectContaining({ status: 'shipping' }),
      undefined,
    );
    expect(result).toMatchObject({
      scannedCount: 1,
      completedCount: 1,
      failedCount: 0,
      completedOrderIds: [orderId.toString()],
    });
  });

  it('applies a simulated failed delivery webhook without completing the order', async () => {
    const orderId = new Types.ObjectId('665000000000000000000066');
    const order = {
      _id: orderId,
      user_id: new Types.ObjectId(userId),
      orderCode: 'FS-WEBHOOK-2',
      status: 'shipping',
      deliveredAt: null,
      paymentMethod: 'VNPAY',
      paymentStatus: 'paid',
      shipping: {
        provider: 'GHN',
        status: 'shipping',
        trackingCode: 'GHN456',
      },
      order_list: [],
      save: jest.fn(),
    };
    order.save.mockResolvedValue(order as never);
    mockedOrder.findById.mockResolvedValue(order as never);

    const result = await orderService.applyShippingWebhook({
      orderId: orderId.toString(),
      status: 'failed',
      reason: 'Customer was not available',
      trackingCode: 'GHN456',
    });

    expect(order.status).toBe('shipping');
    expect(order.paymentStatus).toBe('paid');
    expect(order.deliveredAt).toBeNull();
    expect(order.shipping.status).toBe('failed');
    expect(result.reason).toBe('Customer was not available');
    expect(result.order).toBe(order);
  });

  it('recalculates total amount when customer shipping fee is updated', async () => {
    const orderId = new Types.ObjectId('665000000000000000000070');
    const order = {
      _id: orderId,
      user_id: new Types.ObjectId(userId),
      status: 'confirmed',
      paymentMethod: 'COD',
      paymentStatus: 'pending',
      subTotal: 200000,
      shippingFee: 25000,
      couponDiscountAmount: 10000,
      shippingDiscountAmount: 5000,
      membershipDiscountAmount: 2000,
      taxAmount: 0,
      totalAmount: 208000,
      shipping: {
        provider: 'GHN',
        customerFee: 25000,
        actualProviderCost: null as number | null,
      },
      order_list: [],
      save: jest.fn(),
    };
    order.save.mockResolvedValue(order as never);
    mockedOrder.findById.mockResolvedValue(order as never);

    const result = await orderService.updateOrderShipping(orderId.toString(), {
      customerFee: 30000,
      actualProviderCost: 28000,
    });

    expect(order.shipping.customerFee).toBe(30000);
    expect(order.shipping.actualProviderCost).toBe(28000);
    expect(order.shippingFee).toBe(30000);
    expect(order.totalAmount).toBe(213000);
    expect(order.save).toHaveBeenCalled();
    expect(result).toBe(order);
  });

  it('creates a GHN shipment from a packed order and stores the GHN order code', async () => {
    const orderId = new Types.ObjectId('665000000000000000000067');
    const order = {
      _id: orderId,
      user_id: new Types.ObjectId(userId),
      orderCode: 'FS-GHN-1',
      status: 'packed',
      paymentMethod: 'COD',
      paymentStatus: 'pending',
      totalAmount: 112970,
      shippingFee: 20900,
      shipping: {
        provider: 'GHN',
        serviceId: 53320,
        serviceTypeId: 2,
        status: 'quoted',
        trackingCode: null,
        actualProviderCost: null as number | null,
        rawShipment: null as Record<string, unknown> | null,
      },
      shippingAddress: {
        customerName: 'Granji',
        phoneNumber: '0343149695',
        streetName: '365 Tran Minh Son',
        province: 'Can Tho',
        district: 'Ninh Kieu',
        ward: 'An Khanh',
        wardCode: '550101',
        ghnDistrictId: 1574,
        ghnWardCode: '550101',
      },
      order_list: [
        {
          name: 'Basic Tee',
          quantity: 1,
          priceAtPurchased: 99000,
        },
      ],
      save: jest.fn(),
    };
    const ghnPayload = {
      data: {
        order_code: 'GHD123456',
        total_fee: 20900,
        expected_delivery_time: '2026-06-16T10:00:00.000Z',
      },
    };
    order.save.mockResolvedValue(order as never);
    mockedOrder.findById.mockResolvedValue(order as never);
    mockedGHNService.createShippingOrder.mockResolvedValue(ghnPayload as never);

    const result = await orderService.createGhnShipment(orderId.toString());

    expect(mockedGHNService.createShippingOrder).toHaveBeenCalledWith(expect.objectContaining({
      clientOrderCode: 'FS-GHN-1',
      codAmount: 112970,
      serviceId: 53320,
      toDistrictId: 1574,
      toWardCode: '550101',
    }));
    expect(order.shipping.provider).toBe('GHN');
    expect(order.shipping.status).toBe('ready');
    expect(order.shipping.trackingCode).toBe('GHD123456');
    expect(order.shipping.actualProviderCost).toBe(20900);
    expect(order.shipping.rawShipment).toEqual(ghnPayload);
    expect(order.save).toHaveBeenCalled();
    expect(result).toBe(order);
  });

  it('applies a GHN webhook using the client order code relationship', async () => {
    const orderId = new Types.ObjectId('665000000000000000000068');
    const order = {
      _id: orderId,
      user_id: new Types.ObjectId(userId),
      orderCode: 'FS-GHN-WEBHOOK',
      status: 'packed',
      deliveredAt: null,
      paymentMethod: 'COD',
      paymentStatus: 'pending',
      shipping: {
        provider: 'GHN',
        status: 'ready',
        trackingCode: null as string | null,
      },
      order_list: [],
      save: jest.fn(),
    };
    order.save.mockResolvedValue(order as never);
    mockedOrder.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(order as never);

    const result = await orderService.applyGhnShippingWebhook({
      status: 'delivering',
      client_order_code: 'FS-GHN-WEBHOOK',
      order_code: 'GHD789',
    });

    expect(mockedOrder.findOne).toHaveBeenNthCalledWith(1, { 'shipping.trackingCode': 'GHD789' });
    expect(mockedOrder.findOne).toHaveBeenNthCalledWith(2, { orderCode: 'FS-GHN-WEBHOOK' });
    expect(order.status).toBe('shipping');
    expect(order.paymentStatus).toBe('pending');
    expect(order.shipping.status).toBe('shipping');
    expect(order.shipping.trackingCode).toBe('GHD789');
    expect(result.reason).toBe('GHN reported delivering');
    expect(result.order).toBe(order);
  });

  it('cancels and restocks an order when the shipping webhook is cancelled', async () => {
    const orderId = new Types.ObjectId('665000000000000000000071');
    const couponId = new Types.ObjectId('665000000000000000000092');
    const order = {
      _id: orderId,
      user_id: new Types.ObjectId(userId),
      couponId,
      orderCode: 'FS-GHN-CANCEL',
      status: 'shipping',
      deliveredAt: null,
      paymentMethod: 'COD',
      paymentStatus: 'pending',
      shipping: {
        provider: 'GHN',
        status: 'shipping',
        trackingCode: 'GHD-CANCEL',
      },
      cancellation: null,
      order_list: [
        {
          productId,
          variantId,
          colorVariantId,
          size: 'M',
          quantity: 2,
        },
      ],
      save: jest.fn(),
    };
    order.save.mockResolvedValue(order as never);
    mockedOrder.findById.mockResolvedValue(order as never);
    mockedInventory.updateOne.mockResolvedValue({} as never);
    mockedProduct.updateOne.mockResolvedValue({} as never);

    const result = await orderService.applyShippingWebhook({
      orderId: orderId.toString(),
      status: 'cancelled',
      provider: 'GHN',
      trackingCode: 'GHD-CANCEL',
      reason: 'GHN cancelled shipment',
    });

    expect(order.status).toBe('cancelled');
    expect(order.shipping.status).toBe('cancelled');
    expect(order.cancellation).toEqual(expect.objectContaining({
      reason: 'GHN cancelled shipment',
      actorRole: 'system',
      cancelledAt: expect.any(Date),
    }));
    expect(mockedInventory.updateOne).toHaveBeenCalledWith(
      {
        productId,
        variantId,
        colorVariantId,
        size: 'M',
      },
      {
        $inc: {
          quantity: 2,
          availableQuantity: 2,
        },
      },
    );
    expect(mockedInventoryService.restoreImportRemainingQuantities).toHaveBeenCalledWith([
      {
        productId,
        variantId,
        colorVariantId,
        size: 'M',
        quantity: 2,
      },
    ]);
    expect(mockedProduct.updateOne).toHaveBeenCalledWith(
      { _id: productId, sold_quantity: { $gte: 2 } },
      { $inc: { sold_quantity: -2 } },
    );
    expect(mockedCouponService.rollbackRecordedCouponUsage).toHaveBeenCalledWith(orderId.toString(), {});
    expect(mockedCouponService.rollbackCouponUsageReservation).toHaveBeenCalledWith(
      couponId.toString(),
      userId,
      {},
    );
    expect(result.order).toBe(order);
  });

  it('does not restock twice when a cancelled shipping webhook is replayed', async () => {
    const orderId = new Types.ObjectId('665000000000000000000072');
    const order = {
      _id: orderId,
      user_id: new Types.ObjectId(userId),
      orderCode: 'FS-GHN-CANCEL-REPLAY',
      status: 'cancelled',
      paymentMethod: 'COD',
      paymentStatus: 'pending',
      shipping: {
        provider: 'GHN',
        status: 'shipping',
        trackingCode: 'GHD-CANCEL-REPLAY',
      },
      cancellation: {
        reason: 'Already cancelled',
        actorRole: 'system',
        cancelledAt: new Date('2026-06-18T00:00:00.000Z'),
      },
      order_list: [
        {
          productId,
          variantId,
          colorVariantId,
          size: 'M',
          quantity: 1,
        },
      ],
      save: jest.fn(),
    };
    order.save.mockResolvedValue(order as never);
    mockedOrder.findById.mockResolvedValue(order as never);

    await orderService.applyShippingWebhook({
      orderId: orderId.toString(),
      status: 'cancelled',
      provider: 'GHN',
      trackingCode: 'GHD-CANCEL-REPLAY',
    });

    expect(order.status).toBe('cancelled');
    expect(order.shipping.status).toBe('cancelled');
    expect(mockedInventory.updateOne).not.toHaveBeenCalled();
    expect(mockedInventoryService.restoreImportRemainingQuantities).not.toHaveBeenCalled();
    expect(mockedProduct.updateOne).not.toHaveBeenCalled();
    expect(mockedCouponService.rollbackRecordedCouponUsage).not.toHaveBeenCalled();
    expect(mockedCouponService.rollbackCouponUsageReservation).not.toHaveBeenCalled();
  });

  it('rejects processing online orders before payment is paid', async () => {
    const orderId = new Types.ObjectId('665000000000000000000054');
    const order = {
      _id: orderId,
      user_id: new Types.ObjectId(userId),
      status: 'confirmed',
      paymentMethod: 'VNPAY',
      paymentStatus: 'pending',
      order_list: [],
      save: jest.fn(),
    };
    mockedOrder.findById.mockResolvedValue(order as never);

    await expect(
      orderService.updateOrderStatus(orderId.toString(), { status: 'packed' }),
    ).rejects.toThrow('Online orders must be paid before processing');

    expect(order.save).not.toHaveBeenCalled();
  });

  it('cancels, restocks and rolls back benefits when the order payment deadline expires', async () => {
    const now = new Date('2026-06-24T08:00:00.000Z');
    const orderId = new Types.ObjectId('665000000000000000000055');
    const couponId = new Types.ObjectId('665000000000000000000056');
    const cancelledOrder = {
      _id: orderId,
      user_id: new Types.ObjectId(userId),
      orderCode: 'FS-DEADLINE',
      status: 'cancelled',
      paymentMethod: 'VNPAY',
      paymentStatus: 'failed',
      paymentDeadlineAt: now,
      couponId,
      couponIds: [couponId],
      loyaltyPointsAwarded: 0,
      loyaltyPointsClawedBack: 0,
      cancellation: { kind: 'payment-timeout' },
      order_list: [{ productId, variantId, colorVariantId, size: 'M', quantity: 2 }],
    };
    mockedOrder.findOneAndUpdate.mockResolvedValue(cancelledOrder as never);
    mockedInventory.updateOne.mockResolvedValue({} as never);
    mockedProduct.updateOne.mockResolvedValue({} as never);
    mockedInventoryService.restoreImportRemainingQuantities.mockResolvedValue(undefined);

    const result = await orderService.cancelOrderForPaymentDeadline(orderId.toString(), now);

    expect(mockedOrder.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: orderId.toString(),
        status: 'confirmed',
        paymentStatus: { $in: ['pending', 'failed'] },
        paymentDeadlineAt: { $lte: now },
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'cancelled',
          paymentStatus: 'failed',
          cancellation: expect.objectContaining({ kind: 'payment-timeout', actorRole: 'system' }),
        }),
      }),
      { returnDocument: 'after', runValidators: true },
    );
    expect(mockedInventory.updateOne).toHaveBeenCalled();
    expect(mockedInventoryService.restoreImportRemainingQuantities).toHaveBeenCalled();
    expect(mockedProduct.updateOne).toHaveBeenCalled();
    expect(mockedCouponService.rollbackRecordedCouponUsage).toHaveBeenCalledWith(orderId.toString(), {});
    expect(mockedCouponService.rollbackCouponUsageReservation).toHaveBeenCalledWith(
      couponId.toString(),
      userId,
      {},
    );
    expect(result).toBe(cancelledOrder);
  });
});
