import { Types } from 'mongoose';
import {
  Inventory,
  Order,
  Product,
  Transaction,
  User,
  type IOrder,
  type IUserAddress,
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
import { transactionService } from '../payments/transaction.service';
import { paymentMethodService } from '../payment-methods/payment-method.service';
import { promotionPricingService } from '../promotions/pricing/promotion-pricing.service';
import type { CheckoutOrderItem } from '../promotions/pricing/promotion-pricing.types';
import { couponService } from '../promotions/coupons/coupon.service';
import type {
  ShippingComparisonResult,
  ShippingQuoteResult,
} from '../shipping/shipping.types';
import { shippingAreaMappingService } from '../shipping/shipping-area-mapping.service';
import type {
  CreateOrderInput,
  OrderListQueryInput,
  PreviewCheckoutInput,
  ShippingAddressInput,
  UpdateOrderShippingInput,
  UpdateOrderStatusInput,
} from './order.types';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const SUPPORTED_MVP_PAYMENT_METHODS: OrderPaymentMethod[] = ['COD', 'VNPAY', 'MOMO'];
const ONLINE_PAYMENT_METHODS: OrderPaymentMethod[] = ['VNPAY', 'MOMO', 'CARD', 'BANK'];
const ORDER_STATUSES: OrderStatus[] = [
  'confirmed',
  'packed',
  'shipping',
  'delivered',
  'cancelled',
  'return_requested',
  'returned',
];
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

  if (query.statuses?.length) {
    filter.status = { $in: query.statuses };
  } else if (query.status) {
    filter.status = query.status;
  }

  if (query.paymentMethod) {
    filter.paymentMethod = query.paymentMethod;
  }

  if (query.paymentStatus) {
    filter.paymentStatus = query.paymentStatus;
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

const buildStatusSummary = async (filter: Record<string, unknown>) => {
  const summaryFilter = { ...filter };
  delete summaryFilter.status;

  const rows = await Order.aggregate<{ _id: OrderStatus; count: number }>([
    { $match: summaryFilter },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  const summary = ORDER_STATUSES.reduce(
    (result, status) => ({
      ...result,
      [status]: 0,
    }),
    {} as Record<OrderStatus, number>,
  );

  rows.forEach((row) => {
    if (ORDER_STATUSES.includes(row._id)) {
      summary[row._id] = row.count;
    }
  });

  return {
    ...summary,
    all: ORDER_STATUSES.reduce((total, status) => total + summary[status], 0),
  };
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
    throw new SalesServiceError(
      `Payment method ${paymentMethod} is not supported in this phase. Supported: ${SUPPORTED_MVP_PAYMENT_METHODS.join(', ')}`,
      400,
    );
  }
};

const isOnlinePaymentMethod = (paymentMethod: OrderPaymentMethod) =>
  ONLINE_PAYMENT_METHODS.includes(paymentMethod);

const getGatewayProvider = (paymentMethod: OrderPaymentMethod) => {
  if (paymentMethod === 'VNPAY') return 'vnpay' as const;
  if (paymentMethod === 'MOMO') return 'momo' as const;
  return null;
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

const toOrderShippingSnapshot = (shippingQuote: ShippingQuoteResult) => ({
  provider: shippingQuote.provider,
  serviceId: shippingQuote.serviceId,
  serviceTypeId: shippingQuote.serviceTypeId,
  customerFee: shippingQuote.fee,
  quotedProviderCost: shippingQuote.fee,
  actualProviderCost: null,
  status: shippingQuote.status,
  trackingCode: null,
  labelUrl: null,
  estimatedDeliveryDate: shippingQuote.estimatedDeliveryDate,
  rawQuote: shippingQuote.rawQuote,
  rawShipment: null,
});

const toShippingComparisonSnapshot = (comparison: ShippingComparisonResult) => ({
  comparisonStatus: comparison.comparisonStatus,
  pricingMode: comparison.pricingMode,
  recommendedOptionKey: comparison.recommendedOptionKey,
  selectedOptionKey: comparison.selectedOptionKey,
  quoteVersion: comparison.quoteVersion,
  options: comparison.options.map((option) => ({
    key: option.key,
    provider: option.provider,
    serviceId: option.serviceId,
    serviceTypeId: option.serviceTypeId,
    serviceName: option.serviceName,
    providerCost: option.providerCost,
    customerFee: option.customerFee,
    estimatedDeliveryDate: option.estimatedDeliveryDate,
    availability: option.availability,
    isRecommended: option.isRecommended,
    reason: option.reason,
  })),
});

const toNullablePositiveInteger = (value: unknown) => {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
};

const trimOptional = (value: unknown) => (
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
);

const toShippingAddressSnapshot = (address: ShippingAddressInput): ShippingAddressInput => {
  const provinceId = toNullablePositiveInteger(address.provinceId);
  const districtId = toNullablePositiveInteger(address.districtId);
  const resolvedGhnFields = shippingAreaMappingService.resolveStoredGhnFields(address);

  return {
    customerName: address.customerName.trim(),
    province: address.province.trim(),
    provinceCode: trimOptional(address.provinceCode) ?? (provinceId ? String(provinceId) : null),
    provinceId,
    district: trimOptional(address.district),
    districtId,
    ward: address.ward.trim(),
    wardCode: address.wardCode.trim(),
    streetName: address.streetName.trim(),
    phoneNumber: address.phoneNumber.trim(),
    ghnProvinceId: resolvedGhnFields.ghnProvinceId,
    ghnDistrictId: resolvedGhnFields.ghnDistrictId,
    ghnWardCode: resolvedGhnFields.ghnWardCode,
    ghnMappingStatus: resolvedGhnFields.ghnMappingStatus,
  };
};

const getUserShippingAddressSnapshot = async (userId: string, addressId?: string) => {
  const user = await User.findById(userId).select('address');
  if (!user) {
    throw new SalesServiceError('User not found', 404);
  }

  const addresses = user.address as IUserAddress[];
  const address = addressId
    ? addresses.find((item) => toIdString(item._id) === addressId)
    : addresses.find((item) => item.isDefault) ?? addresses[0];

  if (!address) {
    throw new SalesServiceError(
      addressId ? 'Address not found' : 'Shipping address is required',
      addressId ? 404 : 400,
    );
  }

  return toShippingAddressSnapshot(address);
};

const resolveCheckoutShippingAddress = async (
  userId: string,
  input: { addressId?: string; shippingAddress?: ShippingAddressInput },
  options: { required: boolean },
) => {
  if (input.addressId || !input.shippingAddress) {
    try {
      return await getUserShippingAddressSnapshot(userId, input.addressId);
    } catch (error) {
      const canSkipMissingDefaultAddress =
        !options.required &&
        !input.addressId &&
        error instanceof SalesServiceError &&
        error.statusCode === 400;

      if (!canSkipMissingDefaultAddress) {
        throw error;
      }
    }
  }

  if (input.shippingAddress) {
    return toShippingAddressSnapshot(input.shippingAddress);
  }

  if (options.required) {
    throw new SalesServiceError('Shipping address is required', 400);
  }

  return undefined;
};

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
  const shippingAddress = await resolveCheckoutShippingAddress(userId, input, { required: false });

  const pricing = await promotionPricingService.calculateCheckout({
    userId,
    cartItemIds: input.cartItemIds,
    couponCode: input.couponCode,
    paymentMethod: input.paymentMethod ?? 'COD',
    shippingAddress,
  });

  return {
    items: pricing.items,
    quoteVersion: pricing.shippingComparison.quoteVersion,
    summary: pricing.summary,
    shippingQuote: pricing.shippingQuote,
    shippingComparison: pricing.shippingComparison,
    coupon: mapAppliedCouponForCustomer(pricing.appliedCoupon),
    appliedMembership: pricing.appliedMembership,
  };
};

const createOrder = async (userId: string, input: CreateOrderInput) => {
  assertSupportedPaymentMethod(input.paymentMethod);
  const selectedPaymentMethod = await paymentMethodService.assertUsablePaymentMethodForCheckout({
    userId,
    paymentMethodId: input.paymentMethodId,
    paymentMethod: input.paymentMethod,
  });
  const shippingAddress = await resolveCheckoutShippingAddress(userId, input, { required: true });

  const pricing = await promotionPricingService.calculateCheckout({
    userId,
    cartItemIds: input.cartItemIds,
    couponCode: input.couponCode,
    paymentMethod: input.paymentMethod,
    shippingAddress,
  });
  const normalizedQuoteVersion = input.quoteVersion?.trim();
  if (normalizedQuoteVersion && pricing.shippingComparison.quoteVersion !== normalizedQuoteVersion) {
    throw new SalesServiceError('Shipping quote has changed. Please preview again.', 409, {
      errorCode: 'QUOTE_CHANGED',
      data: {
        latestQuoteVersion: pricing.shippingComparison.quoteVersion,
      },
    });
  }
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
      paymentMethodId: selectedPaymentMethod?._id ?? null,
      paymentStatus: 'pending',
      shipping: {
        ...toOrderShippingSnapshot(pricing.shippingQuote),
        ...toShippingComparisonSnapshot(pricing.shippingComparison),
      },
      shippingAddress,
      orderNote: input.orderNote?.trim() || null,
    });
    createdOrder = order;

    await inventoryService.commitReservations({ reservationIds });
    inventoryCommitted = true;

    // Tạo Transaction pending cho phương thức thanh toán online.
    // COD không cần transaction ngay; sẽ được xử lý khi giao hàng thành công.
    if (isOnlinePaymentMethod(input.paymentMethod)) {
      await runBestEffort(
        transactionService.createPendingTransaction({
          userId,
          orderId: orderId.toString(),
          amount: totalAmount,
          paymentMethod: input.paymentMethod,
          paymentMethodId: selectedPaymentMethod?._id?.toString(),
          gatewayProvider: getGatewayProvider(input.paymentMethod),
        }),
      );
    }

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

  const [items, totalItems, statusSummary] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
    buildStatusSummary(filter),
  ]);

  return {
    items,
    statusSummary,
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

  const [items, totalItems, statusSummary] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
    buildStatusSummary(filter),
  ]);

  return {
    items,
    statusSummary,
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

const getOrderTransactions = async (userId: string, role: string | undefined, id: string) => {
  const order = await getOrderByIdOrThrow(id);
  assertCanReadOrder(order, userId, role);

  return Transaction.find({ order_id: order._id })
    .sort({ attemptNo: -1, createdAt: -1 })
    .lean();
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

const confirmOrderReceived = async (userId: string, id: string) => {
  const order = await getOrderByIdOrThrow(id);
  assertCanReadOrder(order, userId);

  if (order.status === 'delivered') {
    return order;
  }

  if (order.status !== 'shipping') {
    throw new SalesServiceError('Order can only be confirmed received while it is shipping', 400);
  }

  assertOrderStatusTransition(order.status, 'delivered');
  order.status = 'delivered';

  if (order.paymentMethod === 'COD') {
    order.paymentStatus = 'paid';
  }

  order.shipping = {
    ...(order.shipping ?? {}),
    status: 'delivered',
  };

  return order.save();
};

const requestReturn = async (userId: string, id: string) => {
  const order = await getOrderByIdOrThrow(id);
  assertCanReadOrder(order, userId);

  if (order.status === 'return_requested') {
    return order;
  }

  if (order.status !== 'delivered') {
    throw new SalesServiceError('Order can only request return after it is delivered', 400);
  }

  assertOrderStatusTransition(order.status, 'return_requested');
  order.status = 'return_requested';

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
    serviceId: input.serviceId ?? order.shipping?.serviceId ?? null,
    serviceTypeId: input.serviceTypeId ?? order.shipping?.serviceTypeId ?? null,
    customerFee: input.customerFee ?? order.shipping?.customerFee ?? order.shippingFee ?? null,
    quotedProviderCost: input.quotedProviderCost ?? order.shipping?.quotedProviderCost ?? null,
    actualProviderCost: input.actualProviderCost ?? input.fee ?? order.shipping?.actualProviderCost ?? null,
    comparisonStatus: input.comparisonStatus ?? order.shipping?.comparisonStatus ?? null,
    pricingMode: input.pricingMode ?? order.shipping?.pricingMode ?? null,
    recommendedOptionKey: input.recommendedOptionKey ?? order.shipping?.recommendedOptionKey ?? null,
    selectedOptionKey: input.selectedOptionKey ?? order.shipping?.selectedOptionKey ?? null,
    quoteVersion: input.quoteVersion ?? order.shipping?.quoteVersion ?? null,
    options: input.options ?? order.shipping?.options ?? [],
    status: input.status ?? order.shipping?.status ?? null,
    trackingCode: input.trackingCode ?? order.shipping?.trackingCode ?? null,
    labelUrl: input.labelUrl ?? order.shipping?.labelUrl ?? null,
    estimatedDeliveryDate: input.estimatedDeliveryDate ?? order.shipping?.estimatedDeliveryDate ?? null,
    rawQuote: input.rawQuote ?? order.shipping?.rawQuote ?? null,
    rawShipment: input.rawShipment ?? order.shipping?.rawShipment ?? null,
  };

  return order.save();
};

export const orderService = {
  previewCheckout,
  createOrder,
  getMyOrders,
  getOrders,
  getOrderById,
  getOrderTransactions,
  cancelOrder,
  confirmOrderReceived,
  requestReturn,
  updateOrderStatus,
  updateOrderShipping,
};
