import { Types } from 'mongoose';
import { Inventory, Order, Product } from '../../../database/models';
import { inventoryService } from '../../inventory/inventory.service';
import { cartService } from '../../cart/cart.service';
import { promotionPricingService } from '../../promotions/pricing/promotion-pricing.service';
import { couponService } from '../../promotions/coupons/coupon.service';
import type { CheckoutPricingResult } from '../../promotions/pricing/promotion-pricing.types';
import { orderService } from '../order.service';

jest.mock('../../../database/models', () => ({
  Order: {
    create: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
  },
  Product: {
    updateOne: jest.fn(),
  },
  Inventory: {
    updateOne: jest.fn(),
  },
}));

jest.mock('../../inventory/inventory.service', () => ({
  inventoryService: {
    reserveInventory: jest.fn(),
    commitReservations: jest.fn(),
    releaseReservations: jest.fn(),
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

const mockedOrder = Order as jest.Mocked<typeof Order>;
const mockedProduct = Product as jest.Mocked<typeof Product>;
const mockedInventory = Inventory as jest.Mocked<typeof Inventory>;
const mockedInventoryService = inventoryService as jest.Mocked<typeof inventoryService>;
const mockedCartService = cartService as jest.Mocked<typeof cartService>;
const mockedPromotionPricingService = promotionPricingService as jest.Mocked<typeof promotionPricingService>;
const mockedCouponService = couponService as jest.Mocked<typeof couponService>;

const userId = '665000000000000000000020';
const productId = new Types.ObjectId('665000000000000000000003');
const categoryId = new Types.ObjectId('665000000000000000000004');
const variantId = new Types.ObjectId('665000000000000000000011');
const colorVariantId = new Types.ObjectId('665000000000000000000012');
const cartItemId = new Types.ObjectId('665000000000000000000030');
const reservationId = new Types.ObjectId('665000000000000000000040');

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
  appliedCoupon: null,
  appliedMembership: null,
});

describe('orderService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedCouponService.reserveCouponUsage.mockResolvedValue(null);
    mockedCouponService.recordCouponUsage.mockResolvedValue(null);
    mockedCouponService.rollbackRecordedCouponUsage.mockResolvedValue(undefined);
    mockedCouponService.rollbackCouponUsageReservation.mockResolvedValue(undefined);
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
    mockedOrder.create.mockResolvedValue(order as never);
    mockedProduct.updateOne.mockResolvedValue({} as never);
    mockedCartService.deleteCartItems.mockResolvedValue({} as never);

    const result = await orderService.createOrder(userId, {
      cartItemIds: [cartItemId.toString()],
      paymentMethod: 'COD',
      shippingAddress: {
        customerName: 'Nguyen Van A',
        province: 'Can Tho',
        district: 'Ninh Kieu',
        ward: 'An Khanh',
        streetName: '123 Duong 3/2',
        phoneNumber: '0912345678',
      },
    });

    expect(mockedPromotionPricingService.calculateCheckout).toHaveBeenCalledWith({
      userId,
      cartItemIds: [cartItemId.toString()],
      couponCode: undefined,
      paymentMethod: 'COD',
    });
    expect(mockedCouponService.reserveCouponUsage).toHaveBeenCalledWith(userId, null);
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
    );
    expect(mockedCouponService.recordCouponUsage).toHaveBeenCalledWith({
      userId,
      orderId: expect.any(String),
      appliedCoupon: null,
    });
    expect(mockedOrder.create).toHaveBeenCalledWith(
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
      }),
    );
    expect(mockedOrder.create.mock.calls[0][0].order_list[0]).not.toHaveProperty('categoryId');
    expect(mockedInventoryService.commitReservations).toHaveBeenCalledWith({
      reservationIds: [reservationId.toString()],
    });
    expect(mockedCartService.deleteCartItems).toHaveBeenCalledWith(userId, [cartItemId.toString()]);
    expect(result).toBe(order);
  });

  it('returns the order when post-commit cart cleanup fails', async () => {
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
    mockedOrder.create.mockResolvedValue(order as never);
    mockedProduct.updateOne.mockResolvedValue({} as never);
    mockedCartService.deleteCartItems.mockRejectedValue(new Error('cart cleanup failed'));

    const result = await orderService.createOrder(userId, {
      cartItemIds: [cartItemId.toString()],
      paymentMethod: 'COD',
      shippingAddress: {
        customerName: 'Nguyen Van A',
        province: 'Can Tho',
        district: 'Ninh Kieu',
        ward: 'An Khanh',
        streetName: '123 Duong 3/2',
        phoneNumber: '0912345678',
      },
    });

    expect(result).toBe(order);
    expect(mockedInventoryService.releaseReservations).not.toHaveBeenCalled();
    expect(mockedCouponService.rollbackCouponUsageReservation).not.toHaveBeenCalled();
    expect(mockedCouponService.rollbackRecordedCouponUsage).not.toHaveBeenCalled();
  });

  it('releases reservations when order creation fails after inventory is reserved', async () => {
    mockedPromotionPricingService.calculateCheckout.mockResolvedValue(buildPricingResult());
    mockedInventoryService.reserveInventory.mockResolvedValue([
      { _id: reservationId },
    ] as never);
    mockedOrder.create.mockRejectedValue(new Error('create failed'));
    mockedInventoryService.releaseReservations.mockResolvedValue([] as never);

    await expect(
      orderService.createOrder(userId, {
        cartItemIds: [cartItemId.toString()],
        paymentMethod: 'COD',
        shippingAddress: {
          customerName: 'Nguyen Van A',
          province: 'Can Tho',
          district: 'Ninh Kieu',
          ward: 'An Khanh',
          streetName: '123 Duong 3/2',
          phoneNumber: '0912345678',
        },
      }),
    ).rejects.toThrow('create failed');

    expect(mockedInventoryService.releaseReservations).toHaveBeenCalledWith({
      reservationIds: [reservationId.toString()],
    });
    expect(mockedCouponService.rollbackCouponUsageReservation).toHaveBeenCalledWith('');
    expect(mockedCouponService.rollbackRecordedCouponUsage).not.toHaveBeenCalled();
    expect(mockedCartService.deleteCartItems).not.toHaveBeenCalled();
  });

  it('restocks inventory and refunds paid COD orders when cancelled', async () => {
    const orderId = new Types.ObjectId('665000000000000000000050');
    const order = {
      _id: orderId,
      user_id: new Types.ObjectId(userId),
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
    expect(order.status).toBe('cancelled');
    expect(order.paymentStatus).toBe('refunded');
    expect(order.save).toHaveBeenCalled();
    expect(result).toBe(order);
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
});
