import { Types } from 'mongoose';
import {
  Cart,
  Inventory,
  Order,
  Product,
  type ICartItem,
  type IOrder,
  type OrderPaymentMethod,
} from '../../database/models';
import { inventoryService } from '../inventory/inventory.service';
import {
  SalesServiceError,
  resolveSaleItem,
  toIdString,
  toObjectId,
} from '../sales/sales.helpers';
import { cartService } from '../cart/cart.service';
import type {
  CreateOrderInput,
  OrderListQueryInput,
  UpdateOrderShippingInput,
  UpdateOrderStatusInput,
} from './order.types';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const COD_SHIPPING_FEE = 25000;
const FREE_SHIPPING_MINIMUM = 399000;
const SUPPORTED_MVP_PAYMENT_METHODS: OrderPaymentMethod[] = ['COD'];

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

const getCartItemsForCheckout = async (userId: string, cartItemIds: string[]) => {
  if (!cartItemIds?.length) {
    throw new SalesServiceError('cartItemIds is required', 400);
  }

  cartItemIds.forEach((itemId) => {
    if (!Types.ObjectId.isValid(itemId)) {
      throw new SalesServiceError('Invalid cart item id', 400);
    }
  });

  const cart = await Cart.findOne({ user_id: toObjectId(userId, 'userId') });
  if (!cart) {
    throw new SalesServiceError('Cart not found', 404);
  }

  const itemIdSet = new Set(cartItemIds);
  const items = cart.product_list.filter((item: ICartItem) => itemIdSet.has(toIdString(item._id)));

  if (items.length !== itemIdSet.size) {
    throw new SalesServiceError('One or more cart items were not found', 404);
  }

  return { cart, items };
};

const buildOrderItems = async (items: ICartItem[]) => {
  return Promise.all(
    items.map(async (item) => {
      const resolved = await resolveSaleItem(
        toIdString(item.productId),
        toIdString(item.variantId),
        toIdString(item.colorVariantId),
        item.size,
        item.quantity,
      );

      return {
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
      };
    }),
  );
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

const createOrder = async (userId: string, input: CreateOrderInput) => {
  assertSupportedPaymentMethod(input.paymentMethod);

  if (!input.shippingAddress) {
    throw new SalesServiceError('shippingAddress is required', 400);
  }

  const { items } = await getCartItemsForCheckout(userId, input.cartItemIds);
  const orderItems = await buildOrderItems(items);
  const subTotal = orderItems.reduce((sum, item) => sum + item.quantity * item.priceAtPurchased, 0);
  const shippingFee = COD_SHIPPING_FEE;
  const couponDiscountAmount = 0;
  const shippingDiscountAmount = subTotal >= FREE_SHIPPING_MINIMUM ? shippingFee : 0;
  const membershipDiscountAmount = 0;
  const taxAmount = 0;
  const totalAmount = Math.max(
    0,
    subTotal + shippingFee + taxAmount - couponDiscountAmount - shippingDiscountAmount - membershipDiscountAmount,
  );

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
  const reservationIds = reservations.map((reservation) => toIdString(reservation._id));

  try {
    const order = await Order.create({
      orderCode: generateOrderCode(),
      user_id: toObjectId(userId, 'userId'),
      order_list: orderItems,
      subTotal,
      shippingFee,
      couponCode: input.couponCode?.trim() || null,
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

    await inventoryService.commitReservations({ reservationIds });
    await Promise.all(
      orderItems.map((item) =>
        Product.updateOne(
          { _id: item.productId },
          { $inc: { sold_quantity: item.quantity } },
        ),
      ),
    );
    await cartService.deleteCartItems(userId, input.cartItemIds);

    return order;
  } catch (error) {
    await inventoryService.releaseReservations({ reservationIds }).catch(() => undefined);
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

  if (order.status === 'delivered' || order.status === 'returned') {
    throw new SalesServiceError('Order cannot be cancelled in the current status', 400);
  }

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
  createOrder,
  getMyOrders,
  getOrders,
  getOrderById,
  cancelOrder,
  updateOrderStatus,
  updateOrderShipping,
};
