import { existsSync } from 'fs';
import mongoose, { Types } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import {
  Cart,
  Category,
  Coupon,
  CouponUsage,
  Inventory,
  LoyaltyPointHistory,
  Order,
  Product,
  User,
  type IOrder,
} from '../database/models';
import { membershipRankingAdminService } from '../modules/admin/loyalty/membership-ranking.service';
import { loyaltyRuleService } from '../modules/admin/loyalty/loyalty-rule.service';
import { orderService } from '../modules/orders/order.service';
import { promotionAnalyticsService } from '../modules/promotions/analytics/promotion-analytics.service';
import { couponService } from '../modules/promotions/coupons/coupon.service';

const WINDOWS_MONGOD = 'C:\\Program Files\\MongoDB\\Server\\8.3\\bin\\mongod.exe';
const configuredMongod = process.env.MONGOMS_SYSTEM_BINARY;
const systemBinary = configuredMongod || (existsSync(WINDOWS_MONGOD) ? WINDOWS_MONGOD : undefined);
const binaryVersion = process.env.MONGOMS_VERSION
  || (systemBinary === WINDOWS_MONGOD ? '8.3.2' : undefined);

describe('loyalty + voucher order integration', () => {
  let replicaSet: MongoMemoryReplSet;

  beforeAll(async () => {
    replicaSet = await MongoMemoryReplSet.create({
      binary: systemBinary ? { systemBinary, version: binaryVersion } : undefined,
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    await mongoose.connect(replicaSet.getUri('fashion-ecommerce-e2e'));
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
    await replicaSet?.stop();
  });

  it('creates a voucher order, records usage, awards points, and exposes admin analytics', async () => {
    const userId = new Types.ObjectId();
    const categoryId = new Types.ObjectId();
    const fitTypeId = new Types.ObjectId();
    const productId = new Types.ObjectId();
    const variantId = new Types.ObjectId();
    const colorVariantId = new Types.ObjectId();
    const cartItemId = new Types.ObjectId();
    const now = new Date();
    const shippingAddress = {
      customerName: 'E2E Customer',
      province: 'Ho Chi Minh',
      ward: 'Ben Nghe',
      wardCode: '00001',
      streetName: '123 Nguyen Hue',
      phoneNumber: '0343149694',
    };

    await User.create({
      _id: userId,
      name: 'E2E Customer',
      email: 'loyalty-e2e@example.com',
      password: 'e2e-password',
      role: 'user',
      phone: '0343149694',
      gender: 'female',
      dateOfBirth: new Date('1995-01-01'),
      address: [{ ...shippingAddress, isDefault: true }],
      loyaltyPoint: 0,
      isActive: true,
    });
    await Category.create({
      _id: categoryId,
      name: 'E2E Dresses',
      level: 1,
      gender: 'female',
      image: 'https://example.com/category.jpg',
      description: 'Category used by the isolated checkout test',
      isLeaf: true,
      sizes: ['M'],
      measurementFields: [{ key: 'bust', label: 'Bust', unit: 'cm', required: true, sortOrder: 0 }],
      fitTypes: [{ _id: fitTypeId, key: 'regular', label: 'Regular', sortOrder: 0, isActive: true }],
      isActive: true,
    });
    await Product.create({
      _id: productId,
      category_id: categoryId,
      brand_id: new Types.ObjectId(),
      name: 'E2E Voucher Dress',
      description: 'Product used by the isolated voucher checkout integration test',
      product_image: 'https://example.com/product.jpg',
      isActive: true,
      variant: [{
        _id: variantId,
        fitTypeId,
        price: 200000,
        discount: 0,
        sizeMeasurements: [{ size: 'M', measurements: [{ key: 'bust', value: 90 }] }],
        colors: [{ _id: colorVariantId, color: 'Black', colorCode: '#000000', image: 'https://example.com/black.jpg' }],
        isActive: true,
      }],
    });
    await Inventory.create({
      productId,
      variantId,
      colorVariantId,
      size: 'M',
      sku: 'E2E-DRESS-BLACK-M',
      quantity: 10,
      reservedQuantity: 0,
      availableQuantity: 10,
    });
    await Cart.create({
      user_id: userId,
      product_list: [{
        _id: cartItemId,
        productId,
        variantId,
        colorVariantId,
        size: 'M',
        sku: 'E2E-DRESS-BLACK-M',
        quantity: 1,
        priceAtAddedTime: 200000,
        isSelected: true,
      }],
    });
    await loyaltyRuleService.createRule({
      name: 'E2E double points',
      spendAmount: 1000,
      pointsEarned: 2,
      minOrderAmount: 0,
      roundMode: 'floor',
      isActive: true,
    });
    const coupon = await couponService.createCoupon({
      code: 'E2E10',
      name: 'E2E ten percent',
      discountType: 'percent',
      discountValue: 10,
      maxDiscountAmount: 50000,
      minOrderAmount: 100000,
      usageLimit: 10,
      perUserLimit: 1,
      isPublic: true,
      eligibleUserTypes: ['all'],
      startAt: new Date(now.getTime() - 60_000),
      endAt: new Date(now.getTime() + 86_400_000),
      isActive: true,
    });

    const preview = await orderService.previewCheckout(userId.toString(), {
      cartItemIds: [cartItemId.toString()],
      shippingAddress,
      paymentMethod: 'COD',
      couponCode: 'E2E10',
    });
    expect(preview.summary).toMatchObject({
      subTotal: 200000,
      couponDiscountAmount: 20000,
      totalAmount: 205000,
    });

    const createdOrder = await orderService.createOrder(userId.toString(), {
      cartItemIds: [cartItemId.toString()],
      shippingAddress,
      quoteVersion: preview.quoteVersion,
      paymentMethod: 'COD',
      couponCode: 'E2E10',
    }) as unknown as IOrder;
    expect(createdOrder).toMatchObject({
      status: 'confirmed',
      couponCode: 'E2E10',
      couponDiscountAmount: 20000,
      totalAmount: 205000,
    });

    await orderService.updateOrderStatus(createdOrder._id.toString(), { status: 'packed' });
    await orderService.updateOrderStatus(createdOrder._id.toString(), { status: 'shipping' });
    const deliveredOrder = await orderService.updateOrderStatus(createdOrder._id.toString(), { status: 'delivered' });
    const persistedDeliveredOrder = await Order.findById(createdOrder._id).lean();

    expect(deliveredOrder.status).toBe('delivered');
    expect(deliveredOrder.paymentStatus).toBe('paid');
    expect({
      returnedPoints: deliveredOrder.loyaltyPointsAwarded,
      persistedPoints: persistedDeliveredOrder?.loyaltyPointsAwarded,
      persistedStatus: persistedDeliveredOrder?.status,
    }).toEqual({
      returnedPoints: 410,
      persistedPoints: 410,
      persistedStatus: 'delivered',
    });

    const [persistedUser, persistedCoupon, usage, history] = await Promise.all([
      User.findById(userId).lean(),
      Coupon.findById(coupon._id).lean(),
      CouponUsage.findOne({ orderId: createdOrder._id }).lean(),
      LoyaltyPointHistory.findOne({ orderId: createdOrder._id, type: 'earn' }).lean(),
    ]);
    expect(persistedUser?.loyaltyPoint).toBe(410);
    expect(persistedCoupon?.usedCount).toBe(1);
    expect(usage).toMatchObject({ codeSnapshot: 'E2E10', discountAmount: 20000 });
    expect(history).toMatchObject({ delta: 410, balanceAfter: 410, actorRole: 'system' });

    const [adminUsage, pointHistory, analytics] = await Promise.all([
      couponService.listCouponUsage(coupon._id.toString(), { page: 1, limit: 10 }),
      membershipRankingAdminService.listLoyaltyPointHistory({ userId: userId.toString(), page: '1', limit: '10' }),
      promotionAnalyticsService.getPromotionAnalytics({
        from: new Date(now.getTime() - 86_400_000).toISOString(),
        to: new Date(now.getTime() + 86_400_000).toISOString(),
      }),
    ]);
    expect(adminUsage.summary).toMatchObject({ usageCount: 1, discountAmount: 20000 });
    expect(pointHistory.summary).toMatchObject({ added: 410, deducted: 0 });
    expect(pointHistory.items).toHaveLength(1);
    expect(analytics.orders).toMatchObject({ orderCount: 1, netRevenue: 205000, couponDiscount: 20000 });
    expect(analytics.coupons).toMatchObject({ usageCount: 1, totalDiscount: 20000 });
    expect(analytics.loyalty).toContainEqual({ type: 'earn', transactionCount: 1, points: 410 });

    expect(await Order.countDocuments()).toBe(1);
  });
});
