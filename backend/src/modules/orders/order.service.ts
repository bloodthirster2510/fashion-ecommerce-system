import { Types } from 'mongoose';
import {
  Inventory,
  Order,
  Product,
  type IOrder,
  type OrderPaymentMethod,
  type OrderStatus,
} from '../../database/models';
import { inventoryService } from '../inventory/inventory.service';
import {
  SalesServiceError,
  toIdString,
  toObjectId,
} from '../sales/sales.helpers';
import { cartService } from '../cart/cart.service';
import { promotionPricingService } from '../promotions/pricing/promotion-pricing.service';
import type { CheckoutOrderItem } from '../promotions/pricing/promotion-pricing.types';
import { couponService } from '../promotions/coupons/coupon.service';
import type {
  CreateOrderInput,
  OrderListQueryInput,
  PreviewCheckoutInput,
  UpdateOrderShippingInput,
  UpdateOrderStatusInput,
} from './order.types';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const SUPPORTED_MVP_PAYMENT_METHODS: OrderPaymentMethod[] = ['COD'];
const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  confirmed: ['packed', 'cancelled'],
  packed: ['shipping', 'cancelled'],
  shipping: ['delivered', 'return_requested'],
  delivered: ['return_requested'],
  return_requested: ['returned'],
  returned: [],
  cancelled: [],
};

const clampPagination = (query: OrderListQueryInput) => {
  const page = Math.max(query.page ?? DEFAULT_PAGE, DEFAULT_PAGE);
  const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);

  return { page, limit };
};

const generateOrderCode = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `FS${timestamp}${random}`;
};

const buildOrderFilter = (query: OrderListQueryInput) => {
  const filter: Record<string, unknown> = {};

  if (query.status) {
    filter.status = query.status;
  }

  if (query.paymentMethod) {
    filter.paymentMethod = query.paymentMethod;
  }

  if (query.from || query.to) {
    filter.createdAt = {
      ...(query.from ? { $gte: query.from } : {}),
      ...(query.to ? { $lte: query.to } : {}),
    };
  }

  if (query.keyword) {
    filter.$or = [
      { orderCode: new RegExp(query.keyword.trim(), 'i') },
      { invoiceCode: new RegExp(query.keyword.trim(), 'i') },
      { 'order_list.name': new RegExp(query.keyword.trim(), 'i') },
    ];
  }

  return filter;
};

const getOrderByIdOrThrow = async (id: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new SalesServiceError('Invalid order id', 400);
  }

  const order = await Order.findById(id);
  if (!order) {
    throw new SalesServiceError('Order not found', 404);
  }

  return order;
};

const canManageOrders = (role?: string) => role === 'admin' || role === 'staff';

const assertCanReadOrder = (order: IOrder, userId: string, role?: string) => {
  if (!canManageOrders(role) && toIdString(order.user_id) !== userId) {
    throw new SalesServiceError('Order not found', 404);
  }
};

const assertSupportedPaymentMethod = (paymentMethod: OrderPaymentMethod) => {
  if (!SUPPORTED_MVP_PAYMENT_METHODS.includes(paymentMethod)) {
    throw new SalesServiceError('Only COD payment is supported in this phase', 400);
  }
};

const assertOrderStatusTransition = (from: OrderStatus, to: OrderStatus) => {
  if (from === to) {
    return;
  }

  if (!ORDER_STATUS_TRANSITIONS[from].includes(to)) {
    throw new SalesServiceError(`Cannot transition order from ${from} to ${to}`, 400);
  }
};

const runBestEffort = async (task: Promise<unknown>) => {
  await task.catch(() => undefined);
};

const toOrderItem = (item: CheckoutOrderItem) => ({
  productId: item.productId,
  variantId: item.variantId,
  colorVariantId: item.colorVariantId,
  size: item.size,
  sku: item.sku,
  name: item.name,
  fitType: item.fitType,
  color: item.color,
  image: item.image,
  quantity: item.quantity,
  priceAtPurchased: item.priceAtPurchased,
});

const mapAppliedCouponForCustomer = (
  appliedCoupon: Awaited<ReturnType<typeof promotionPricingService.calculateCheckout>>['appliedCoupon'],
) => {
  if (!appliedCoupon) {
    return null;
  }

  const coupon = appliedCoupon.coupon;
  return {
    _id: coupon._id.toString(),
    code: appliedCoupon.code,
    name: coupon.name,
    description: coupon.description ?? null,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    maxDiscountAmount: coupon.maxDiscountAmount ?? null,
    minOrderAmount: coupon.minOrderAmount,
    endAt: coupon.endAt,
    discountAmount: appliedCoupon.discountAmount,
    shippingDiscountAmount: appliedCoupon.shippingDiscountAmount,
    eligibleSubTotal: appliedCoupon.eligibleSubTotal,
  };
};

const previewCheckout = async (userId: string, input: PreviewCheckoutInput) => {
  assertSupportedPaymentMethod(input.paymentMethod ?? 'COD');

  const pricing = await promotionPricingService.calculateCheckout({
    userId,
    cartItemIds: input.cartItemIds,
    couponCode: input.couponCode,
    paymentMethod: input.paymentMethod ?? 'COD',
  });

  return {
    items: pricing.items,
    summary: pricing.summary,
    coupon: mapAppliedCouponForCustomer(pricing.appliedCoupon),
    appliedMembership: pricing.appliedMembership,
  };
};

const createOrder = async (userId: string, input: CreateOrderInput) => {
  assertSupportedPaymentMethod(input.paymentMethod);

  if (!input.shippingAddress) {
    throw new SalesServiceError('shippingAddress is required', 400);
  }

  const pricing = await promotionPricingService.calculateCheckout({
    userId,
    cartItemIds: input.cartItemIds,
    couponCode: input.couponCode,
    paymentMethod: input.paymentMethod,
  });
  const orderItems = pricing.items.map(toOrderItem);
  const {
    subTotal,
    shippingFee,
    couponDiscountAmount,
    shippingDiscountAmount,
    membershipDiscountAmount,
    taxAmount,
    totalAmount,
  } = pricing.summary;

  const orderId = new Types.ObjectId();
  let reservedCoupon: Awaited<ReturnType<typeof couponService.reserveCouponUsage>> | null = null;
  let reservationIds: string[] = [];
  let couponUsageRecorded = false;
  let inventoryCommitted = false;
  let createdOrder: IOrder | null = null;

  try {
    reservedCoupon = await couponService.reserveCouponUsage(userId, pricing.appliedCoupon);
    const reservations = await inventoryService.reserveInventory({
      userId,
      ttlMinutes: 15,
      items: orderItems.map((item) => ({
        productId: toIdString(item.productId),
        variantId: toIdString(item.variantId),
        colorVariantId: toIdString(item.colorVariantId),
        size: item.size,
        quantity: item.quantity,
      })),
    });
    reservationIds = reservations.map((reservation) => toIdString(reservation._id));

    await couponService.recordCouponUsage({
      userId,
      orderId: orderId.toString(),
      appliedCoupon: pricing.appliedCoupon,
    });
    couponUsageRecorded = Boolean(pricing.appliedCoupon);

    const order = await Order.create({
      _id: orderId,
      orderCode: generateOrderCode(),
      user_id: toObjectId(userId, 'userId'),
      order_list: orderItems,
      subTotal,
      shippingFee,
      couponCode: pricing.appliedCoupon?.code ?? null,
      couponId: pricing.appliedCoupon?.coupon._id ?? null,
      couponDiscountAmount,
      shippingDiscountAmount,
      membershipDiscountAmount,
      taxAmount,
      totalAmount,
      status: 'confirmed',
      paymentMethod: input.paymentMethod,
      paymentStatus: 'pending',
      shipping: {},
      shippingAddress: input.shippingAddress,
      orderNote: input.orderNote?.trim() || null,
    });
    createdOrder = order;

    await inventoryService.commitReservations({ reservationIds });
    inventoryCommitted = true;

    await runBestEffort(Promise.all(
      orderItems.map((item) =>
        Product.updateOne(
          { _id: item.productId },
          { $inc: { sold_quantity: item.quantity } },
        ),
      ),
    ));
    await runBestEffort(cartService.deleteCartItems(userId, input.cartItemIds));

    return order;
  } catch (error) {
    if (!inventoryCommitted) {
      await inventoryService.releaseReservations({ reservationIds }).catch(() => undefined);
      if (couponUsageRecorded) {
        await couponService.rollbackRecordedCouponUsage(orderId.toString()).catch(() => undefined);
      }
      await couponService.rollbackCouponUsageReservation(toIdString(reservedCoupon?._id)).catch(() => undefined);

      if (createdOrder) {
        createdOrder.status = 'cancelled';
        await createdOrder.save().catch(() => undefined);
      }
    }
    throw error;
  }
};

const getMyOrders = async (userId: string, query: OrderListQueryInput) => {
  const { page, limit } = clampPagination(query);
  const filter = {
    ...buildOrderFilter(query),
    user_id: toObjectId(userId, 'userId'),
  };

  const [items, totalItems] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
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

const getOrders = async (query: OrderListQueryInput) => {
  const { page, limit } = clampPagination(query);
  const filter = buildOrderFilter(query);

  const [items, totalItems] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
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

const getOrderById = async (userId: string, role: string | undefined, id: string) => {
  const order = await getOrderByIdOrThrow(id);
  assertCanReadOrder(order, userId, role);

  return order;
};

const restockCommittedOrder = async (order: IOrder) => {
  await Promise.all(
    order.order_list.map((item) =>
      Inventory.updateOne(
        {
          productId: item.productId,
          variantId: item.variantId,
          colorVariantId: item.colorVariantId,
          size: item.size,
        },
        {
          $inc: {
            quantity: item.quantity,
            availableQuantity: item.quantity,
          },
        },
      ),
    ),
  );

  await Promise.all(
    order.order_list.map((item) =>
      Product.updateOne(
        { _id: item.productId, sold_quantity: { $gte: item.quantity } },
        { $inc: { sold_quantity: -item.quantity } },
      ),
    ),
  );
};

const cancelOrder = async (userId: string, role: string | undefined, id: string) => {
  const order = await getOrderByIdOrThrow(id);
  assertCanReadOrder(order, userId, role);

  if (order.status === 'cancelled') {
    throw new SalesServiceError('Order is already cancelled', 400);
  }

  assertOrderStatusTransition(order.status, 'cancelled');

  await restockCommittedOrder(order);
  order.status = 'cancelled';
  order.paymentStatus = order.paymentStatus === 'paid' ? 'refunded' : order.paymentStatus;

  return order.save();
};

const updateOrderStatus = async (
  id: string,
  input: UpdateOrderStatusInput,
) => {
  if (input.status === 'cancelled') {
    const order = await getOrderByIdOrThrow(id);
    return cancelOrder(toIdString(order.user_id), 'admin', id);
  }

  const order = await getOrderByIdOrThrow(id);
  assertOrderStatusTransition(order.status, input.status);

  if (order.status === input.status) {
    return order;
  }

  order.status = input.status;

  if (input.status === 'delivered' && order.paymentMethod === 'COD') {
    order.paymentStatus = 'paid';
  }

  return order.save();
};

const updateOrderShipping = async (id: string, input: UpdateOrderShippingInput) => {
  const order = await getOrderByIdOrThrow(id);

  order.shipping = {
    provider: input.provider ?? order.shipping?.provider ?? null,
    trackingCode: input.trackingCode ?? order.shipping?.trackingCode ?? null,
    labelUrl: input.labelUrl ?? order.shipping?.labelUrl ?? null,
    estimatedDeliveryDate: input.estimatedDeliveryDate ?? order.shipping?.estimatedDeliveryDate ?? null,
  };

  return order.save();
};

export const orderService = {
  previewCheckout,
  createOrder,
  getMyOrders,
  getOrders,
  getOrderById,
  cancelOrder,
  updateOrderStatus,
  updateOrderShipping,
};
