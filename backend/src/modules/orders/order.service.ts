import crypto from 'crypto';
import mongoose, { Types, type ClientSession } from 'mongoose';
import {
  Category,
  Inventory,
  LoyaltyPointHistory,
  Order,
  Product,
  Transaction,
  User,
  type IOrder,
  type ICategoryFitType,
  type IProductVariant,
  type OrderPaymentStatus,
  type IUserAddress,
  type OrderPaymentMethod,
  type OrderStatus,
  type TransactionStatus,
} from '../../database/models';
import { inventoryService } from '../inventory/inventory.service';
import {
  SalesServiceError,
  toIdString,
  toObjectId,
} from '../sales/sales.helpers';
import { cartService } from '../cart/cart.service';
import { interactionService } from '../interactions/interaction.service';
import { recommendationService } from '../recommendations/recommendation.service';
import { transactionService } from '../payments/transaction.service';
import {
  getOrderPaymentDeadlineAt,
  getOrderPaymentDeadlineWarningMs,
} from '../payments/order-payment-deadline.config';
import { paymentMethodService } from '../payment-methods/payment-method.service';
import { promotionPricingService } from '../promotions/pricing/promotion-pricing.service';
import type { CheckoutOrderItem } from '../promotions/pricing/promotion-pricing.types';
import { couponService } from '../promotions/coupons/coupon.service';
import { loyaltyRuleService } from '../admin/loyalty/loyalty-rule.service';
import { uploadImageToCloudinary } from '../../utils/cloudinary';
import type {
  ShippingComparisonResult,
  ShippingQuoteResult,
} from '../shipping/shipping.types';
import { shippingAreaMappingService } from '../shipping/shipping-area-mapping.service';
import { GHNService } from '../shipping/ghn.service';
import {
  emitOrderUpdate,
  type OrderRealtimeEventType,
  type OrderShippingMilestone,
} from '../realtime/order.gateway';
import {
  sendShippingUpdatePush,
  type ShippingPushMilestone,
} from '../notifications/push-notification.service';
import {
  recordLoyaltyEarnedNotification,
  recordOrderCreatedNotification,
  recordOrderPaymentNotification,
  recordOrderStatusNotification,
} from '../notifications/customer-notification.service';
import type {
  AdjustOrderPaymentStatusInput,
  CancelOrderInput,
  CreateOrderInput,
  OrderEvidenceImageInput,
  OrderListQueryInput,
  PreviewCheckoutInput,
  RequestReturnInput,
  ReviewReturnRequestInput,
  ShippingAddressInput,
  SimulatedShippingWebhookInput,
  UpdateOrderGhnMappingInput,
  UpdateOrderShippingInput,
  UpdateOrderStatusInput,
} from './order.types';
import {
  ONLINE_PAYMENT_METHODS,
  ORDER_STATUSES,
  ORDER_STATUS_TRANSITIONS,
  SHIPPING_MILESTONE_STATUSES,
  SHIPPING_WEBHOOK_STATUSES,
  SUPPORTED_PAYMENT_METHODS,
} from './order.constants';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_ORDER_EXPORT_ROWS = 5000;
const MAX_ORDER_EVIDENCE_IMAGES = 5;
const MAX_ORDER_EVIDENCE_IMAGE_BYTES = 3 * 1024 * 1024;
const RETURN_WINDOW_DAYS = 7;
const RETURN_WINDOW_MS = RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;
const AUTO_COMPLETE_DELIVERED_AFTER_DAYS = 7;
const AUTO_COMPLETE_DELIVERED_AFTER_MS = AUTO_COMPLETE_DELIVERED_AFTER_DAYS * 24 * 60 * 60 * 1000;
const AUTO_COMPLETE_BATCH_SIZE = 50;
const DEFAULT_GHN_ITEM_WEIGHT_GRAMS = 500;
const DEFAULT_GHN_PACKAGE_LENGTH_CM = 20;
const DEFAULT_GHN_PACKAGE_WIDTH_CM = 20;
const DEFAULT_GHN_PACKAGE_HEIGHT_CM = 10;
const DEFAULT_GHN_SERVICE_TYPE_ID = 2;

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

const SHIPPING_FALLBACK_CONDITION = {
  $or: [
    { 'shippingAddress.ghnMappingStatus': { $in: ['missing', 'manual'] } },
    { 'shippingAddress.ghnMappingVerifiedAt': null },
    { 'shippingAddress.ghnMappingConfidence': null },
    { 'shippingAddress.ghnDistrictId': null },
    { 'shippingAddress.ghnWardCode': null },
    {
      $and: [
        {
          $or: [
            { 'shipping.provider': 'FIXED' },
            { 'shipping.status': 'fallback' },
            { 'shipping.comparisonStatus': 'fallback' },
          ],
        },
        { 'shipping.status': { $ne: 'mapping_resolved' } },
      ],
    },
  ],
};

const buildOrderFilter = (query: OrderListQueryInput) => {
  const filter: Record<string, unknown> = {};

  if (query.statuses?.length) {
    filter.status = { $in: query.statuses };
  } else if (query.status) {
    filter.status = query.status;
  }

  if (query.paymentMethods?.length) {
    filter.paymentMethod = { $in: query.paymentMethods };
  } else if (query.paymentMethod) {
    filter.paymentMethod = query.paymentMethod;
  }

  if (query.paymentStatuses?.length) {
    filter.paymentStatus = { $in: query.paymentStatuses };
  } else if (query.paymentStatus) {
    filter.paymentStatus = query.paymentStatus;
  }

  if (query.from || query.to) {
    filter.createdAt = {
      ...(query.from ? { $gte: query.from } : {}),
      ...(query.to ? { $lte: query.to } : {}),
    };
  }

  if (query.paymentDeadlineBefore) {
    filter.paymentDeadlineAt = { $ne: null, $lte: query.paymentDeadlineBefore };
  }

  if (query.shippingFallback) {
    filter.$and = [
      ...((filter.$and as unknown[]) ?? []),
      SHIPPING_FALLBACK_CONDITION,
    ];
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

const getOrderSort = (
  query: OrderListQueryInput,
  fallback: NonNullable<OrderListQueryInput['sort']>,
): Record<string, 1 | -1> => {
  switch (query.sort ?? fallback) {
    case 'created_asc':
      return { createdAt: 1 };
    case 'total_desc':
      return { totalAmount: -1, createdAt: -1 };
    case 'total_asc':
      return { totalAmount: 1, createdAt: -1 };
    case 'payment_deadline_asc':
      return { paymentDeadlineAt: 1, createdAt: -1 };
    case 'created_desc':
    default:
      return { createdAt: -1 };
  }
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

const buildOperationalSummary = async (filter: Record<string, unknown>) => {
  const summaryFilter = { ...filter };
  delete summaryFilter.status;
  delete summaryFilter.paymentStatus;

  const countWith = (condition: Record<string, unknown>) =>
    Order.countDocuments({ $and: [summaryFilter, condition] });

  const readyOrderCondition = {
    paymentStatus: { $ne: 'failed' },
    $or: [
      { paymentMethod: 'COD' },
      { paymentStatus: 'paid' },
    ],
  };

  const now = new Date();
  const deadlineSoonAt = new Date(now.getTime() + getOrderPaymentDeadlineWarningMs());

  const [
    returnRequests,
    refunds,
    paidReady,
    packingReady,
    handoffReady,
    deliveryConfirmations,
    paymentRisk,
    paymentDeadlineSoon,
    shippingMappingRequired,
  ] = await Promise.all([
    countWith({
      status: { $in: ['return_requested', 'return_approved'] },
      'returnRequest.status': { $in: ['requested', 'approved'] },
    }),
    countWith({
      status: { $in: ['cancelled', 'returned'] },
      paymentStatus: 'paid',
    }),
    countWith({
      status: { $in: ['confirmed', 'packed'] },
      paymentStatus: 'paid',
    }),
    countWith({
      status: 'confirmed',
      ...readyOrderCondition,
    }),
    countWith({
      status: 'packed',
      ...readyOrderCondition,
    }),
    countWith({
      status: 'delivered',
      ...readyOrderCondition,
    }),
    countWith({
      status: { $nin: ['cancelled', 'returned'] },
      $or: [
        { paymentStatus: 'failed' },
        {
          paymentMethod: { $ne: 'COD' },
          paymentStatus: { $ne: 'paid' },
        },
      ],
    }),
    countWith({
      status: 'confirmed',
      paymentMethod: { $in: ONLINE_PAYMENT_METHODS },
      paymentStatus: { $in: ['pending', 'failed'] },
      paymentDeadlineAt: { $gt: now, $lte: deadlineSoonAt },
    }),
    countWith({
      status: { $in: ['confirmed', 'packed'] },
      ...SHIPPING_FALLBACK_CONDITION,
    }),
  ]);

  return {
    returnRequests,
    refunds,
    paidReady,
    packingReady,
    handoffReady,
    readyToProcess: packingReady + handoffReady,
    deliveryConfirmations,
    paymentRisk,
    paymentOverdueRisk: Math.max(0, paymentRisk - paymentDeadlineSoon),
    paymentDeadlineSoon,
    shippingMappingRequired,
    totalPriority:
      returnRequests
      + refunds
      + packingReady
      + handoffReady
      + deliveryConfirmations
      + paymentRisk
      + shippingMappingRequired,
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
  if (!(SUPPORTED_PAYMENT_METHODS as readonly OrderPaymentMethod[]).includes(paymentMethod)) {
    throw new SalesServiceError(
      `Payment method ${paymentMethod} is not supported in this phase. Supported: ${SUPPORTED_PAYMENT_METHODS.join(', ')}`,
      400,
    );
  }
};

const requireCheckoutQuoteVersion = (quoteVersion: string | undefined) => {
  const normalizedQuoteVersion = quoteVersion?.trim();
  if (!normalizedQuoteVersion) {
    throw new SalesServiceError('Shipping quote is required. Please preview checkout again.', 400, {
      errorCode: 'QUOTE_REQUIRED',
    });
  }

  return normalizedQuoteVersion;
};

const isOnlinePaymentMethod = (paymentMethod: OrderPaymentMethod) =>
  (ONLINE_PAYMENT_METHODS as readonly OrderPaymentMethod[]).includes(paymentMethod);

const toManualTransactionStatus = (paymentStatus: OrderPaymentStatus): TransactionStatus => {
  if (paymentStatus === 'paid' || paymentStatus === 'refunded') return 'success';
  if (paymentStatus === 'pending') return 'pending';
  return 'failed';
};

const requiresPaidOnlineOrder = (status: OrderStatus) =>
  status !== 'confirmed' && status !== 'cancelled';

const getGatewayProvider = (paymentMethod: OrderPaymentMethod) => {
  if (paymentMethod === 'VNPAY') return 'vnpay' as const;
  if (paymentMethod === 'MOMO') return 'momo' as const;
  return null;
};

const generateInvoiceCode = (order: Pick<IOrder, '_id' | 'orderCode'>) => {
  const base = order.orderCode?.trim().toUpperCase() || toIdString(order._id).slice(-10).toUpperCase();
  return `INV-${base}`.slice(0, 40);
};

const ensureDeliveredInvoiceCode = (order: IOrder) => {
  if ((order.status === 'delivered' || order.status === 'completed') && !order.invoiceCode) {
    order.invoiceCode = generateInvoiceCode(order);
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

const assertPaymentAllowsOrderStatus = (order: IOrder, to: OrderStatus) => {
  if (
    isOnlinePaymentMethod(order.paymentMethod) &&
    requiresPaidOnlineOrder(to) &&
    order.paymentStatus !== 'paid'
  ) {
    throw new SalesServiceError('Online orders must be paid before processing', 400);
  }
};

const logBestEffortFailure = (context: string, error: unknown) => {
  console.error(`${context}:`, error);
};

const runBestEffort = async (context: string, task: Promise<unknown>) => {
  try {
    await task;
  } catch (error) {
    logBestEffortFailure(context, error);
  }
};

type OrderChangeSnapshot = {
  status: string;
  paymentStatus: string;
  deliveredAt: Date | null;
  shipping: IOrder['shipping'] | null;
};

type RecommendationOrderLifecycleEvent =
  | 'order_created'
  | 'payment_completed'
  | 'order_cancelled'
  | 'order_returned';

const createOrderChangeSnapshot = (order: IOrder): OrderChangeSnapshot => ({
  status: order.status,
  paymentStatus: order.paymentStatus,
  deliveredAt: order.deliveredAt ?? null,
  shipping: order.shipping
    ? ({
        ...order.shipping,
        status: order.shipping.status ?? null,
        trackingCode: order.shipping.trackingCode ?? null,
      } as IOrder['shipping'])
    : null,
});

const recordRecommendationOrderLifecycle = async (
  order: IOrder,
  eventType: RecommendationOrderLifecycleEvent,
) => {
  const orderId = toIdString(order._id);
  const reversesPayment = (
    eventType === 'order_cancelled' || eventType === 'order_returned'
  ) && (order.paymentStatus === 'paid' || order.paymentStatus === 'refunded');

  await runBestEffort(
    `Failed to record recommendation ${eventType} conversions`,
    Promise.all(
      order.order_list
        .filter((item) => Boolean(item.recommendationRequestId))
        .map((item) => recommendationService.recordRecommendationConversionEvent({
          userId: toIdString(order.user_id),
          requestId: item.recommendationRequestId,
          recommendedProductId: toIdString(item.productId),
          eventType,
          orderId,
          orderCode: order.orderCode,
          orderStatus: order.status,
          orderPaymentStatus: order.paymentStatus,
          quantity: item.quantity,
          attributedAmount: item.priceAtPurchased * item.quantity,
          reversesPayment,
        })),
    ),
  );

  if (eventType === 'payment_completed') {
    await runBestEffort(
      'Failed to record paid purchase interactions',
      interactionService.recordPurchaseInteractions(
        toIdString(order.user_id),
        order.order_list.map((item) => ({
          sourceId: `${orderId}:${toIdString(item._id)}`,
          productId: toIdString(item.productId),
          recommendationRequestId: item.recommendationRequestId ?? null,
          variantId: toIdString(item.variantId),
          colorVariantId: toIdString(item.colorVariantId),
          size: item.size,
          quantity: item.quantity,
        })),
        { orderId, orderCode: order.orderCode },
      ),
    );
  }
};

const recordRecommendationPaymentCompleted = async (orderId: string) => {
  const order = await getOrderByIdOrThrow(orderId);
  if (order.paymentStatus !== 'paid') return order;

  await recordRecommendationOrderLifecycle(order, 'payment_completed');

  // A gateway callback may arrive after a local timeout/cancellation. Keep the
  // paid event for auditability and turn the negative event into a reversal.
  if (order.status === 'cancelled') {
    await recordRecommendationOrderLifecycle(order, 'order_cancelled');
  } else if (order.status === 'returned') {
    await recordRecommendationOrderLifecycle(order, 'order_returned');
  }

  return order;
};

const triggerOrderStatusChange = async (
  order: IOrder,
  before: OrderChangeSnapshot,
  type: OrderRealtimeEventType,
  milestone?: OrderShippingMilestone,
) => {
  const shippingStatusBefore = before.shipping?.status ?? null;
  const shippingStatusAfter = order.shipping?.status ?? null;
  if (before.status === order.status && shippingStatusBefore === shippingStatusAfter) return;

  await runBestEffort(
    'Failed to emit order realtime event',
    Promise.resolve(emitOrderUpdate(order, type, {
      status: before.status,
      paymentStatus: before.paymentStatus,
      shippingStatus: shippingStatusBefore,
    }, milestone)),
  );

  if (before.status !== order.status) {
    await recordOrderStatusNotification({
      userId: order.user_id.toString(),
      orderId: order._id.toString(),
      orderCode: order.orderCode,
      status: order.status,
      imageUrl: order.order_list[0]?.image ?? null,
    });
  }

  if (milestone && ['picked', 'shipping', 'delivered', 'failed'].includes(milestone)) {
    await runBestEffort(
      'Failed to send shipping update push notification',
      sendShippingUpdatePush({
        userId: order.user_id.toString(),
        orderId: order._id.toString(),
        orderCode: order.orderCode,
        milestone: milestone as ShippingPushMilestone,
      }),
    );
  }

  if (before.paymentStatus !== 'paid' && order.paymentStatus === 'paid') {
    await recordRecommendationOrderLifecycle(order, 'payment_completed');
  }

  if (before.paymentStatus !== order.paymentStatus) {
    await recordOrderPaymentNotification({
      userId: order.user_id.toString(),
      orderId: order._id.toString(),
      orderCode: order.orderCode,
      paymentStatus: order.paymentStatus,
      imageUrl: order.order_list[0]?.image ?? null,
    });
  }

  if (
    before.status !== order.status &&
    ['delivered', 'completed'].includes(order.status) &&
    (order.loyaltyPointsAwarded ?? 0) > 0
  ) {
    await recordLoyaltyEarnedNotification({
      userId: order.user_id.toString(),
      orderId: order._id.toString(),
      orderCode: order.orderCode,
      points: order.loyaltyPointsAwarded,
    });
  }

  if (before.status !== order.status && order.status === 'cancelled') {
    await recordRecommendationOrderLifecycle(order, 'order_cancelled');
  } else if (before.status !== order.status && order.status === 'returned') {
    await recordRecommendationOrderLifecycle(order, 'order_returned');
  }
};

const triggerOrderPaymentChange = async (
  order: IOrder,
  before: OrderChangeSnapshot,
) => {
  if (before.paymentStatus === order.paymentStatus) return;

  await runBestEffort(
    'Failed to emit order payment realtime event',
    Promise.resolve(emitOrderUpdate(order, 'payment_update', {
      status: before.status,
      paymentStatus: before.paymentStatus,
      shippingStatus: before.shipping?.status ?? null,
    })),
  );

  if (before.paymentStatus !== 'paid' && order.paymentStatus === 'paid') {
    await recordRecommendationOrderLifecycle(order, 'payment_completed');
  }

  await recordOrderPaymentNotification({
    userId: order.user_id.toString(),
    orderId: order._id.toString(),
    orderCode: order.orderCode,
    paymentStatus: order.paymentStatus,
    imageUrl: order.order_list[0]?.image ?? null,
  });
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
  recommendationRequestId: item.recommendationRequestId ?? null,
});

type IdLike = Types.ObjectId | string | { toString(): string };
type OrderItemLike = {
  productId?: IdLike;
  variantId?: IdLike;
  fitType?: string;
};
type OrderLike = {
  order_list?: OrderItemLike[];
};

const isObjectIdText = (value?: string) => Boolean(
  value && /^[a-f\d]{24}$/i.test(value) && Types.ObjectId.isValid(value),
);

const resolveOrderFitTypeLabels = async <T extends OrderLike>(orders: T[]) => {
  const items = orders.flatMap((order) => order.order_list ?? [])
    .filter((item) => isObjectIdText(item.fitType));

  if (!items.length) {
    return orders;
  }

  const productIds = Array.from(new Set(items.map((item) => toIdString(item.productId))))
    .filter((id) => Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));

  if (!productIds.length) {
    return orders;
  }

  const products = await Product.find({ _id: { $in: productIds } }).select('category_id variant._id variant.fitTypeId');
  const categoryIds = Array.from(new Set(products.map((product) => toIdString(product.category_id))))
    .filter((id) => Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));
  const categories = await Category.find({ _id: { $in: categoryIds } }).select('fitTypes');
  const fitTypeLabelByCategory = new Map<string, string>();

  categories.forEach((category) => {
    category.fitTypes?.forEach((fitType: ICategoryFitType) => {
      fitTypeLabelByCategory.set(`${toIdString(category._id)}:${toIdString(fitType._id)}`, fitType.label);
    });
  });

  const fitTypeLabelByProductVariant = new Map<string, string>();
  products.forEach((product) => {
    product.variant.forEach((variant: IProductVariant) => {
      const fitTypeId = toIdString(variant.fitTypeId);
      const label = fitTypeLabelByCategory.get(`${toIdString(product.category_id)}:${fitTypeId}`);

      if (label) {
        fitTypeLabelByProductVariant.set(`${toIdString(product._id)}:${toIdString(variant._id)}`, label);
      }
    });
  });

  orders.forEach((order) => {
    order.order_list?.forEach((item) => {
      if (!isObjectIdText(item.fitType)) {
        return;
      }

      const label = fitTypeLabelByProductVariant.get(`${toIdString(item.productId)}:${toIdString(item.variantId)}`);
      if (label) {
        item.fitType = label;
      }
    });
  });

  return orders;
};

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

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const normalizeRawRecord = (value: unknown): Record<string, unknown> => (
  isRecord(value) ? value : { value }
);

const getNestedDataRecord = (value: Record<string, unknown>) => (
  isRecord(value.data) ? value.data : null
);

const readStringField = (source: Record<string, unknown> | null, keys: string[]) => {
  if (!source) {
    return null;
  }

  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }

  return null;
};

const readNumberField = (source: Record<string, unknown> | null, keys: string[]) => {
  if (!source) {
    return null;
  }

  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const numericValue = Number(value);
      if (Number.isFinite(numericValue)) {
        return numericValue;
      }
    }
  }

  return null;
};

const readDateField = (source: Record<string, unknown> | null, keys: string[]) => {
  const value = readStringField(source, keys);
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const readGhnString = (payload: Record<string, unknown>, keys: string[]) =>
  readStringField(getNestedDataRecord(payload), keys) ?? readStringField(payload, keys);

const readGhnNumber = (payload: Record<string, unknown>, keys: string[]) =>
  readNumberField(getNestedDataRecord(payload), keys) ?? readNumberField(payload, keys);

const readGhnDate = (payload: Record<string, unknown>, keys: string[]) =>
  readDateField(getNestedDataRecord(payload), keys) ?? readDateField(payload, keys);

const normalizeGhnStatus = (value: string | null) => (
  value
    ?.trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_') ?? null
);

const mapGhnStatusToShippingStatus = (value: string | null): SimulatedShippingWebhookInput['status'] | null => {
  const status = normalizeGhnStatus(value);
  if (!status) {
    return null;
  }

  if (['ready_to_pick', 'ready_to_pickup', 'created'].includes(status)) {
    return 'ready';
  }

  if (['picking', 'money_collect_picking'].includes(status)) {
    return 'picking';
  }

  if (['picked', 'storing'].includes(status)) {
    return 'picked';
  }

  if (['shipping', 'transporting', 'sorting', 'delivering', 'money_collect_delivering'].includes(status)) {
    return 'shipping';
  }

  if (['delivered', 'delivery_success', 'success'].includes(status)) {
    return 'delivered';
  }

  if ([
    'delivery_fail',
    'waiting_to_return',
    'return',
    'return_transporting',
    'return_sorting',
    'returning',
    'return_fail',
    'returned',
    'exception',
    'damage',
    'lost',
  ].includes(status)) {
    return 'failed';
  }

  if (['cancel', 'cancelled', 'canceled'].includes(status)) {
    return 'cancelled';
  }

  return null;
};

const parseGhnWebhookPayload = (
  value: unknown,
  overrides: Partial<SimulatedShippingWebhookInput> = {},
): SimulatedShippingWebhookInput => {
  const rawPayload = normalizeRawRecord(value);
  const rawStatus = readGhnString(rawPayload, [
    'status',
    'Status',
    'converted_status',
    'convertedStatus',
    'ConvertedStatus',
    'order_status',
    'orderStatus',
  ]);
  const status = mapGhnStatusToShippingStatus(rawStatus);

  if (!status) {
    throw new SalesServiceError('Cannot map GHN shipment status', 400);
  }

  return {
    provider: 'GHN',
    orderCode: readGhnString(rawPayload, [
      'client_order_code',
      'clientOrderCode',
      'ClientOrderCode',
      'client_order_id',
    ]) ?? undefined,
    trackingCode: readGhnString(rawPayload, [
      'order_code',
      'orderCode',
      'OrderCode',
      'tracking_code',
      'trackingCode',
    ]) ?? undefined,
    status,
    reason: `GHN reported ${rawStatus ?? status}`,
    deliveredAt: status === 'delivered'
      ? readGhnDate(rawPayload, ['finish_date', 'delivered_at', 'deliveredAt', 'updated_date', 'updatedAt'])
      : null,
    rawPayload,
    ...overrides,
  };
};

const assertTextMaxLength = (value: string, fieldName: string, maxLength = 500) => {
  if (value.length > maxLength) {
    throw new SalesServiceError(`${fieldName} cannot exceed ${maxLength} characters`, 400);
  }
};

const normalizeCancelReason = (value: unknown) => {
  const reason = trimOptional(value);

  if (reason) {
    assertTextMaxLength(reason, 'Cancel reason');
  }

  return reason;
};

const normalizeRequiredReturnReason = (value: unknown) => {
  const reason = trimOptional(value);

  if (!reason) {
    throw new SalesServiceError('Return reason is required', 400);
  }

  assertTextMaxLength(reason, 'Return reason');
  return reason;
};

const normalizeEvidenceImageUrls = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [];
  }

  const urls = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);

  const uniqueUrls = Array.from(new Set(urls));
  uniqueUrls.forEach((url) => {
    assertTextMaxLength(url, 'Evidence image URL');
    if (!/^https?:\/\//i.test(url)) {
      throw new SalesServiceError('Evidence image URLs must start with http:// or https://', 400);
    }
  });

  return uniqueUrls.slice(0, MAX_ORDER_EVIDENCE_IMAGES);
};

const normalizeBase64Image = (imageBase64: string, fallbackMimeType?: string) => {
  const dataUriMatch = imageBase64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s);
  const mimeType = (dataUriMatch?.[1] || fallbackMimeType || 'image/jpeg').toLowerCase();
  const cleanBase64 = (dataUriMatch?.[2] || imageBase64).replace(/\s/g, '');

  return { mimeType, cleanBase64 };
};

const uploadEvidenceAttachments = async (
  orderId: string,
  kind: 'cancel' | 'return',
  value: unknown,
) => {
  if (!Array.isArray(value) || value.length === 0) {
    return [];
  }

  const attachments = value.slice(0, MAX_ORDER_EVIDENCE_IMAGES) as OrderEvidenceImageInput[];
  const allowedMimeTypes = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
  const folder = process.env.CLOUDINARY_ORDER_EVIDENCE_FOLDER?.trim() || 'fashion-system/order-evidence';
  const safeOrderId = orderId.replace(/[^a-zA-Z0-9]/g, '');

  const uploadResults = await Promise.all(
    attachments.map(async (attachment, index) => {
      if (!attachment || typeof attachment.imageBase64 !== 'string') {
        throw new SalesServiceError('Evidence image payload is invalid', 400);
      }

      const { mimeType, cleanBase64 } = normalizeBase64Image(attachment.imageBase64, attachment.mimeType);
      if (!allowedMimeTypes.has(mimeType)) {
        throw new SalesServiceError('Evidence images must be JPG, PNG, or WEBP', 400);
      }

      const imageBuffer = Buffer.from(cleanBase64, 'base64');
      if (!imageBuffer.length || imageBuffer.length > MAX_ORDER_EVIDENCE_IMAGE_BYTES) {
        throw new SalesServiceError('Each evidence image must be at most 3MB', 400);
      }

      const result = await uploadImageToCloudinary({
        fileDataUri: `data:${mimeType};base64,${cleanBase64}`,
        folder,
        publicId: `${safeOrderId}-${kind}-${Date.now()}-${index + 1}`,
      });

      return result.secureUrl;
    }),
  );

  return uploadResults;
};

const resolveEvidenceImageUrls = async (
  orderId: string,
  kind: 'cancel' | 'return',
  input?: {
    imageUrls?: string[];
    imageAttachments?: OrderEvidenceImageInput[];
  },
) => {
  const imageUrls = normalizeEvidenceImageUrls(input?.imageUrls);
  const uploadedUrls = await uploadEvidenceAttachments(orderId, kind, input?.imageAttachments);

  return Array.from(new Set([...imageUrls, ...uploadedUrls])).slice(0, MAX_ORDER_EVIDENCE_IMAGES);
};

const normalizeReturnReviewReason = (
  value: unknown,
  decision: ReviewReturnRequestInput['decision'],
) => {
  const reason = trimOptional(value);

  if (decision === 'rejected' && !reason) {
    throw new SalesServiceError('Return rejection reason is required', 400);
  }

  if (reason) {
    assertTextMaxLength(reason, 'Return review reason');
  }

  return reason;
};

const assertReturnReviewDecision: (
  value: unknown,
) => asserts value is ReviewReturnRequestInput['decision'] = (
  value: unknown,
) => {
  if (value !== 'approved' && value !== 'rejected') {
    throw new SalesServiceError('Invalid return review decision', 400);
  }
};

const getDeliveredAt = (order: IOrder) => order.deliveredAt ?? order.updatedAt ?? null;

const assertReturnWindowIsOpen = (order: IOrder) => {
  const deliveredAt = getDeliveredAt(order);

  if (!deliveredAt) {
    throw new SalesServiceError('Delivery time is required before requesting return', 400);
  }

  if (Date.now() - deliveredAt.getTime() > RETURN_WINDOW_MS) {
    throw new SalesServiceError(
      `Return requests are only available within ${RETURN_WINDOW_DAYS} days after delivery`,
      400,
    );
  }
};

const toShippingAddressSnapshot = (address: ShippingAddressInput): ShippingAddressInput => {
  const provinceId = toNullablePositiveInteger(address.provinceId);
  const districtId = toNullablePositiveInteger(address.districtId);
  const resolvedGhnFields = shippingAreaMappingService.resolveStoredGhnFields(address);
  const requireAddressText = (value: unknown, fieldLabel: string) => {
    const normalized = trimOptional(value);

    if (!normalized) {
      throw new SalesServiceError(`Shipping address is missing ${fieldLabel}`, 400);
    }

    return normalized;
  };
  // Tài khoản được tạo trước khi bổ sung mã hành chính có thể chưa có wardCode.
  // Mapping theo tên địa phương vẫn đủ để khôi phục mã và tính phí vận chuyển.
  const wardCode = trimOptional(address.wardCode)
    ?? trimOptional(resolvedGhnFields.mapping?.wardCode)
    ?? trimOptional(resolvedGhnFields.ghnWardCode)
    ?? 'LEGACY';

  return {
    customerName: requireAddressText(address.customerName, 'customer name'),
    province: requireAddressText(address.province, 'province'),
    provinceCode: trimOptional(address.provinceCode)
      ?? trimOptional(resolvedGhnFields.mapping?.provinceCode)
      ?? (provinceId ? String(provinceId) : null),
    provinceId,
    district: trimOptional(address.district),
    districtId,
    ward: requireAddressText(address.ward, 'ward'),
    wardCode,
    streetName: requireAddressText(address.streetName, 'street name'),
    phoneNumber: requireAddressText(address.phoneNumber, 'phone number'),
    ghnProvinceId: resolvedGhnFields.ghnProvinceId,
    ghnDistrictId: resolvedGhnFields.ghnDistrictId,
    ghnWardCode: resolvedGhnFields.ghnWardCode,
    ghnMappingStatus: resolvedGhnFields.ghnMappingStatus,
    ghnMappingConfidence: resolvedGhnFields.ghnMappingConfidence,
    ghnMappingVerifiedAt: resolvedGhnFields.ghnMappingVerifiedAt,
  };
};

const withResolvedGhnArea = (
  address: ShippingAddressInput,
  comparison: ShippingComparisonResult,
): ShippingAddressInput => {
  const resolvedArea = comparison.resolvedArea;
  if (!resolvedArea) return address;

  return {
    ...address,
    ghnProvinceId: resolvedArea.provinceId,
    ghnDistrictId: resolvedArea.districtId,
    ghnWardCode: resolvedArea.wardCode,
    ghnMappingStatus: resolvedArea.status,
    ghnMappingConfidence: resolvedArea.confidence,
    ghnMappingVerifiedAt: resolvedArea.verifiedAt,
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

type SessionOptions = {
  session?: ClientSession;
};

const runWithMongoTransaction = async <T>(
  operation: (options: SessionOptions) => Promise<T>,
) => {
  const session = await mongoose.startSession();

  try {
    let result: T | undefined;

    await session.withTransaction(async () => {
      result = await operation({ session });
    });

    if (result === undefined) {
      throw new SalesServiceError('Transaction did not produce a result', 500);
    }

    return result;
  } finally {
    await session.endSession();
  }
};

export const calculateLoyaltyPointsForOrder = (order: IOrder) => {
  const totalAmount = Math.max(0, Number(order.totalAmount) || 0);
  const rule = order.loyaltyRuleSnapshot;
  if (!rule) return Math.floor(totalAmount / 1000);
  if (totalAmount < rule.minOrderAmount) return 0;

  const rawPoints = (totalAmount / rule.spendAmount) * rule.pointsEarned;
  const round = rule.roundMode === 'ceil' ? Math.ceil : rule.roundMode === 'round' ? Math.round : Math.floor;
  return Math.max(0, round(rawPoints));
};

const createLoyaltyPointHistory = async (
  payload: {
    userId: Types.ObjectId;
    orderId: Types.ObjectId;
    type: 'earn' | 'adjust';
    delta: number;
    balanceAfter: number;
    reason: string;
    actorRole?: 'system' | 'user' | 'admin' | 'staff';
  },
  options: SessionOptions = {},
) => {
  const historyPayload = {
    ...payload,
    actorRole: payload.actorRole ?? 'system',
  };

  if (options.session) {
    await LoyaltyPointHistory.create([historyPayload], { session: options.session });
    return;
  }

  await LoyaltyPointHistory.create(historyPayload);
};

const awardLoyaltyPointsForDeliveredOrder = async (
  order: IOrder,
  options: SessionOptions = {},
) => {
  const points = calculateLoyaltyPointsForOrder(order);
  if (points <= 0 || (order.loyaltyPointsAwarded ?? 0) > 0) {
    return order;
  }

  const orderObjectId = toObjectId(toIdString(order._id), 'orderId');
  const userObjectId = toObjectId(toIdString(order.user_id), 'userId');
  const updatedOrder = await Order.findOneAndUpdate(
    {
      _id: orderObjectId,
      status: { $in: ['delivered', 'completed'] },
      $or: [
        { loyaltyPointsAwarded: { $exists: false } },
        { loyaltyPointsAwarded: { $lte: 0 } },
      ],
    },
    { $set: { loyaltyPointsAwarded: points } },
    {
      returnDocument: 'after',
      runValidators: true,
      ...(options.session ? { session: options.session } : {}),
    },
  );

  if (!updatedOrder) {
    return order;
  }

  const updatedUser = await User.findOneAndUpdate(
    { _id: userObjectId },
    { $inc: { loyaltyPoint: points } },
    {
      returnDocument: 'after',
      runValidators: true,
      ...(options.session ? { session: options.session } : {}),
    },
  );

  if (!updatedUser) {
    throw new SalesServiceError('Order user not found while awarding loyalty points', 404);
  }

  await createLoyaltyPointHistory(
    {
      userId: userObjectId,
      orderId: orderObjectId,
      type: 'earn',
      delta: points,
      balanceAfter: updatedUser.loyaltyPoint,
      reason: 'Order delivered',
      actorRole: 'system',
    },
    options,
  );

  return updatedOrder;
};

const clawBackLoyaltyPointsForOrder = async (
  order: IOrder,
  reason: string,
  options: SessionOptions = {},
) => {
  const awardedPoints = Math.max(0, Number(order.loyaltyPointsAwarded) || 0);
  const alreadyClawedBack = Math.max(0, Number(order.loyaltyPointsClawedBack) || 0);
  const pointsToClawBack = Math.max(0, awardedPoints - alreadyClawedBack);

  if (pointsToClawBack <= 0) {
    return order;
  }

  const orderObjectId = toObjectId(toIdString(order._id), 'orderId');
  const userObjectId = toObjectId(toIdString(order.user_id), 'userId');
  const updatedOrder = await Order.findOneAndUpdate(
    {
      _id: orderObjectId,
      loyaltyPointsAwarded: awardedPoints,
      $or: [
        { loyaltyPointsClawedBack: { $exists: false } },
        { loyaltyPointsClawedBack: { $lt: awardedPoints } },
      ],
    },
    { $inc: { loyaltyPointsClawedBack: pointsToClawBack } },
    {
      returnDocument: 'after',
      runValidators: true,
      ...(options.session ? { session: options.session } : {}),
    },
  );

  if (!updatedOrder) {
    return order;
  }

  const updatedUser = await User.findOneAndUpdate(
    { _id: userObjectId },
    [
      {
        $set: {
          loyaltyPoint: {
            $max: [0, { $subtract: ['$loyaltyPoint', pointsToClawBack] }],
          },
        },
      },
    ],
    {
      returnDocument: 'after',
      updatePipeline: true,
      ...(options.session ? { session: options.session } : {}),
    },
  );

  if (!updatedUser) {
    throw new SalesServiceError('Order user not found while clawing back loyalty points', 404);
  }

  await createLoyaltyPointHistory(
    {
      userId: userObjectId,
      orderId: orderObjectId,
      type: 'adjust',
      delta: -pointsToClawBack,
      balanceAfter: updatedUser.loyaltyPoint,
      reason,
      actorRole: 'system',
    },
    options,
  );

  return updatedOrder;
};

const rollbackCouponUsageForCancelledOrder = async (
  order: IOrder,
  options: SessionOptions = {},
) => {
  const couponIds = order.couponIds?.length
    ? order.couponIds.map((couponId) => toIdString(couponId))
    : order.couponId ? [toIdString(order.couponId)] : [];
  if (!couponIds.length) {
    return;
  }

  await couponService.rollbackRecordedCouponUsage(toIdString(order._id), options);
  for (const couponId of couponIds) {
    await couponService.rollbackCouponUsageReservation(
      couponId,
      toIdString(order.user_id),
      options,
    );
  }
};

const saveDeliveredOrderWithLoyaltyAward = async (order: IOrder): Promise<IOrder> => {
  const savedOrder = await mongoose.connection.transaction(async (session) => {
    ensureDeliveredInvoiceCode(order);
    const persistedOrder = await order.save({ session });
    return awardLoyaltyPointsForDeliveredOrder(persistedOrder, { session });
  });

  if (!savedOrder) {
    throw new SalesServiceError('Failed to save delivered order', 500);
  }

  return savedOrder;
};

const saveOrderWithLoyaltyClawback = async (order: IOrder, reason: string) => {
  const savedOrder = await mongoose.connection.transaction(async (session) => {
    const persistedOrder = await order.save({ session });
    return clawBackLoyaltyPointsForOrder(persistedOrder, reason, { session });
  });

  if (!savedOrder) {
    throw new SalesServiceError('Failed to save order loyalty adjustment', 500);
  }

  return savedOrder;
};

const previewCheckout = async (userId: string, input: PreviewCheckoutInput) => {
  assertSupportedPaymentMethod(input.paymentMethod ?? 'COD');
  const shippingAddress = await resolveCheckoutShippingAddress(userId, input, { required: false });

  const pricing = await promotionPricingService.calculateCheckout({
    userId,
    cartItemIds: input.cartItemIds,
    couponCode: input.couponCode,
    couponCodes: input.couponCodes,
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
    coupons: (pricing.appliedCoupons ?? []).map(mapAppliedCouponForCustomer),
    campaign: pricing.appliedCampaign ?? null,
    appliedMembership: pricing.appliedMembership,
  };
};

const createOrder = async (userId: string, input: CreateOrderInput) => {
  if (input.idempotencyKey) {
    const existingOrder = await Order.findOne({
      user_id: toObjectId(userId, 'userId'),
      idempotencyKey: input.idempotencyKey,
    });
    if (existingOrder) return existingOrder;
  }

  assertSupportedPaymentMethod(input.paymentMethod);
  const normalizedQuoteVersion = requireCheckoutQuoteVersion(input.quoteVersion);
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
    couponCodes: input.couponCodes,
    paymentMethod: input.paymentMethod,
    shippingAddress,
  });
  if (pricing.shippingComparison.quoteVersion !== normalizedQuoteVersion) {
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
  const appliedCoupons = pricing.appliedCoupons ?? (pricing.appliedCoupon ? [pricing.appliedCoupon] : []);
  const loyaltyRuleSnapshot = await loyaltyRuleService.getActiveRuleSnapshot();
  let createdOrder: IOrder | null = null;

  try {
    createdOrder = await runWithMongoTransaction(async ({ session }) => {
      const sessionOptions = session ? { session } : {};

      for (const appliedCoupon of appliedCoupons) {
        await couponService.reserveCouponUsage(userId, appliedCoupon, sessionOptions);
      }
      const reservations = await inventoryService.reserveInventory(
        {
          userId,
          ttlMinutes: 15,
          items: orderItems.map((item) => ({
            productId: toIdString(item.productId),
            variantId: toIdString(item.variantId),
            colorVariantId: toIdString(item.colorVariantId),
            size: item.size,
            quantity: item.quantity,
          })),
        },
        sessionOptions,
      );
      const reservationIds = reservations.map((reservation) => toIdString(reservation._id));

      for (const appliedCoupon of appliedCoupons) {
        await couponService.recordCouponUsage(
          { userId, orderId: orderId.toString(), appliedCoupon },
          sessionOptions,
        );
      }

      const orderPayload = {
        _id: orderId,
        idempotencyKey: input.idempotencyKey ?? null,
        orderCode: generateOrderCode(),
        user_id: toObjectId(userId, 'userId'),
        order_list: orderItems,
        subTotal,
        shippingFee,
        couponCode: pricing.appliedCoupon?.code ?? null,
        couponId: pricing.appliedCoupon?.coupon._id ?? null,
        couponCodes: appliedCoupons.map((coupon) => coupon.code),
        couponIds: appliedCoupons.map((coupon) => coupon.coupon._id),
        promotionCampaignId: pricing.appliedCampaign?.campaignId
          ? toObjectId(pricing.appliedCampaign.campaignId, 'promotion campaign id')
          : null,
        couponDiscountAmount,
        shippingDiscountAmount,
        appliedMembershipTierId: pricing.appliedMembership?.tierId
          ? toObjectId(pricing.appliedMembership.tierId, 'membership tier id')
          : null,
        appliedMembershipDiscountPercent: pricing.appliedMembership?.discountPercent ?? null,
        membershipDiscountAmount,
        loyaltyRuleSnapshot: {
          ...loyaltyRuleSnapshot,
          ruleId: loyaltyRuleSnapshot.ruleId
            ? toObjectId(loyaltyRuleSnapshot.ruleId, 'loyalty rule id')
            : null,
        },
        taxAmount,
        totalAmount,
        status: 'confirmed',
        paymentMethod: input.paymentMethod,
        paymentMethodId: selectedPaymentMethod?._id ?? null,
        paymentStatus: 'pending',
        paymentDeadlineAt: isOnlinePaymentMethod(input.paymentMethod)
          ? getOrderPaymentDeadlineAt()
          : null,
        paymentDeadlineWarningSentAt: null,
        shipping: {
          ...toOrderShippingSnapshot(pricing.shippingQuote),
          ...toShippingComparisonSnapshot(pricing.shippingComparison),
        },
        shippingAddress: withResolvedGhnArea(shippingAddress!, pricing.shippingComparison),
        orderNote: input.orderNote?.trim() || null,
      };
      const [order] = session
        ? await Order.create([orderPayload], { session })
        : await Order.create([orderPayload]);

      // Create a pending transaction for online payment methods inside the order transaction.
      if (isOnlinePaymentMethod(input.paymentMethod)) {
        await transactionService.createPendingTransaction({
          userId,
          orderId: orderId.toString(),
          amount: totalAmount,
          paymentMethod: input.paymentMethod,
          paymentMethodId: selectedPaymentMethod?._id?.toString(),
          gatewayProvider: getGatewayProvider(input.paymentMethod),
          session,
        });
      }

      await inventoryService.commitReservations({ reservationIds }, sessionOptions);

      await Promise.all(
        orderItems.map((item) =>
          session
            ? Product.updateOne(
                { _id: item.productId },
                { $inc: { sold_quantity: item.quantity } },
                { session },
              )
            : Product.updateOne(
                { _id: item.productId },
                { $inc: { sold_quantity: item.quantity } },
              ),
        ),
      );

      return order;
    });
  } catch (error) {
    const duplicateKeyError = typeof error === 'object' && error !== null && 'code' in error
      && (error as { code?: number }).code === 11000;
    if (!duplicateKeyError || !input.idempotencyKey) throw error;

    const existingOrder = await Order.findOne({
      user_id: toObjectId(userId, 'userId'),
      idempotencyKey: input.idempotencyKey,
    });
    if (!existingOrder) throw error;
    createdOrder = existingOrder;
  }

  if (!createdOrder) {
    throw new SalesServiceError('Failed to create order', 500);
  }
  const finalizedOrder = createdOrder;
  const persistedOrderItems = finalizedOrder.order_list?.length
    ? finalizedOrder.order_list
    : orderItems.map((item, index) => ({
        ...item,
        _id: `line-${index + 1}`,
      }));

  await runBestEffort(
    'Failed to delete cart items after order creation',
    cartService.deleteCartItems(userId, input.cartItemIds),
  );
  const attributionOrder = finalizedOrder.order_list?.length
    ? finalizedOrder
    : Object.assign(finalizedOrder, { order_list: persistedOrderItems });
  await recordRecommendationOrderLifecycle(attributionOrder, 'order_created');
  await recordOrderCreatedNotification({
    userId,
    orderId: finalizedOrder._id.toString(),
    orderCode: finalizedOrder.orderCode,
    imageUrl: persistedOrderItems[0]?.image ?? null,
  });

  return finalizedOrder;
};

const getMyOrders = async (userId: string, query: OrderListQueryInput) => {
  const { page, limit } = clampPagination(query);
  const filter = {
    ...buildOrderFilter(query),
    user_id: toObjectId(userId, 'userId'),
  };

  const [items, totalItems, statusSummary, operationalSummary] = await Promise.all([
    Order.find(filter)
      .sort(getOrderSort(query, 'created_desc'))
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
    buildStatusSummary(filter),
    buildOperationalSummary(filter),
  ]);
  const resolvedItems = await resolveOrderFitTypeLabels(items);

  return {
    items: resolvedItems,
    statusSummary,
    operationalSummary,
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

  const [items, totalItems, statusSummary, operationalSummary] = await Promise.all([
    Order.find(filter)
      .sort(getOrderSort(query, 'created_asc'))
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
    buildStatusSummary(filter),
    buildOperationalSummary(filter),
  ]);
  const resolvedItems = await resolveOrderFitTypeLabels(items);

  return {
    items: resolvedItems,
    statusSummary,
    operationalSummary,
    pagination: {
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
    },
  };
};

const getOrdersForExport = async (query: OrderListQueryInput) => {
  const filter = buildOrderFilter(query);
  const [items, totalItems] = await Promise.all([
    Order.find(filter)
      .sort(getOrderSort(query, 'created_asc'))
      .limit(MAX_ORDER_EXPORT_ROWS)
      .lean(),
    Order.countDocuments(filter),
  ]);

  return {
    items,
    totalItems,
    truncated: totalItems > items.length,
  };
};

const getOrderById = async (userId: string, role: string | undefined, id: string) => {
  const order = await getOrderByIdOrThrow(id);
  assertCanReadOrder(order, userId, role);

  const [resolvedOrder] = await resolveOrderFitTypeLabels([order.toObject()]);
  return resolvedOrder;
};

const getOrderTransactions = async (userId: string, role: string | undefined, id: string) => {
  const order = await getOrderByIdOrThrow(id);
  assertCanReadOrder(order, userId, role);

  return Transaction.find({ order_id: order._id })
    .sort({ attemptNo: -1, createdAt: -1 })
    .lean();
};

const adjustOrderPaymentStatus = async (
  id: string,
  input: AdjustOrderPaymentStatusInput,
) => {
  const order = await getOrderByIdOrThrow(id);
  const before = createOrderChangeSnapshot(order);

  if (order.paymentStatus === input.paymentStatus) {
    return order;
  }

  if (order.paymentStatus === 'refunded') {
    throw new SalesServiceError('Refunded payment status is final', 409);
  }

  if (order.paymentStatus === 'paid' && input.paymentStatus !== 'refunded') {
    throw new SalesServiceError('Paid payment status cannot be downgraded', 409);
  }

  if (input.paymentStatus === 'refunded' && (
    order.paymentStatus !== 'paid' || !['cancelled', 'returned'].includes(order.status)
  )) {
    throw new SalesServiceError(
      'Payment can only be marked refunded after a paid order is cancelled or returned',
      409,
    );
  }

  order.paymentStatus = input.paymentStatus;
  const updatedOrder = await order.save();

  await transactionService.createManualAdjustmentTransaction({
    userId: updatedOrder.user_id.toString(),
    orderId: updatedOrder._id.toString(),
    amount: updatedOrder.totalAmount,
    paymentMethod: updatedOrder.paymentMethod,
    paymentMethodId: updatedOrder.paymentMethodId?.toString() ?? null,
    status: toManualTransactionStatus(input.paymentStatus),
    reason: input.reason,
    actorId: input.actorId,
  });

  await triggerOrderPaymentChange(updatedOrder, before);
  return updatedOrder;
};

const markVNPayRefundCompleted = async (id: string) => {
  const order = await getOrderByIdOrThrow(id);
  const before = createOrderChangeSnapshot(order);

  if (order.paymentStatus === 'refunded') {
    return order;
  }

  if (order.paymentMethod !== 'VNPAY' || order.paymentStatus !== 'paid') {
    throw new SalesServiceError('Only paid VNPay orders can be gateway-refunded', 409);
  }

  if (!['cancelled', 'returned'].includes(order.status)) {
    throw new SalesServiceError('Order must be cancelled or returned before refund completion', 409);
  }

  order.paymentStatus = 'refunded';
  const updatedOrder = await order.save();
  await triggerOrderPaymentChange(updatedOrder, before);
  return updatedOrder;
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

  await inventoryService.restoreImportRemainingQuantities(
    order.order_list.map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      colorVariantId: item.colorVariantId,
      size: item.size,
      quantity: item.quantity,
    })),
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

const cancelOrderForPaymentDeadline = async (orderId: string, now = new Date()) => {
  const cancellationReason = 'Tự động hủy do quá hạn thanh toán 3 ngày';
  const cancelledOrder = await Order.findOneAndUpdate(
    {
      _id: orderId,
      status: 'confirmed',
      paymentMethod: { $in: ONLINE_PAYMENT_METHODS },
      paymentStatus: { $in: ['pending', 'failed'] },
      paymentDeadlineAt: { $lte: now },
    },
    {
      $set: {
        status: 'cancelled',
        paymentStatus: 'failed',
        cancellation: {
          kind: 'payment-timeout',
          reason: cancellationReason,
          cancelledAt: now,
          cancelledBy: null,
          actorRole: 'system',
        },
      },
    },
    { returnDocument: 'after', runValidators: true },
  );

  if (!cancelledOrder) return null;

  await restockCommittedOrder(cancelledOrder);
  await rollbackCouponUsageForCancelledOrder(cancelledOrder);
  const finalOrder = await clawBackLoyaltyPointsForOrder(
    cancelledOrder,
    'Order cancelled due to payment deadline exceeded',
  );
  await recordRecommendationOrderLifecycle(finalOrder, 'order_cancelled');
  return finalOrder;
};

const cancelOrder = async (
  userId: string,
  role: string | undefined,
  id: string,
  input: CancelOrderInput = {},
) => {
  const order = await getOrderByIdOrThrow(id);
  assertCanReadOrder(order, userId, role);
  const before = createOrderChangeSnapshot(order);

  if (order.status === 'cancelled') {
    throw new SalesServiceError('Order is already cancelled', 400);
  }

  assertOrderStatusTransition(order.status, 'cancelled');

  const evidenceImageUrls = await resolveEvidenceImageUrls(order._id.toString(), 'cancel', input);
  const cancellation = {
    reason: normalizeCancelReason(input?.reason),
    ...(evidenceImageUrls.length ? { imageUrls: evidenceImageUrls } : {}),
    cancelledAt: new Date(),
    cancelledBy: toObjectId(userId, 'userId'),
    actorRole: role === 'admin' || role === 'staff' ? role : 'user',
  };
  const cancelledOrder = await Order.findOneAndUpdate(
    {
      _id: order._id,
      status: order.status,
    },
    {
      $set: {
        status: 'cancelled',
        cancellation,
      },
    },
    {
      returnDocument: 'after',
      runValidators: true,
    },
  );

  if (!cancelledOrder) {
    throw new SalesServiceError('Order status changed. Please reload and try again.', 409);
  }

  await restockCommittedOrder(cancelledOrder);
  const ghnCancellation = await cancelLinkedGhnShipmentBestEffort(cancelledOrder).catch((error) => {
    logBestEffortFailure('Failed to cancel linked GHN shipment after order cancellation', error);
    return null;
  });
  if (ghnCancellation) {
    await cancelledOrder.save();
  }

  await rollbackCouponUsageForCancelledOrder(cancelledOrder);

  const finalOrder = await clawBackLoyaltyPointsForOrder(cancelledOrder, 'Order cancelled after delivery');
  await triggerOrderStatusChange(finalOrder, before, 'status_update', 'cancelled');
  return finalOrder;
};

const confirmOrderReceived = async (userId: string, id: string) => {
  const order = await getOrderByIdOrThrow(id);
  assertCanReadOrder(order, userId);

  if (order.status === 'completed') {
    if (!order.invoiceCode) {
      ensureDeliveredInvoiceCode(order);
      return order.save();
    }
    return order;
  }

  if (order.status !== 'delivered') {
    throw new SalesServiceError('Order can only be confirmed received after it is delivered', 400);
  }

  assertOrderStatusTransition(order.status, 'completed');
  assertPaymentAllowsOrderStatus(order, 'completed');
  const before = createOrderChangeSnapshot(order);
  const receivedAt = new Date();
  order.status = 'completed';
  order.receivedAt = order.receivedAt ?? receivedAt;
  order.deliveredAt = order.deliveredAt ?? receivedAt;

  if (order.paymentMethod === 'COD') {
    order.paymentStatus = 'paid';
  }

  order.shipping = {
    ...(order.shipping ?? {}),
    status: 'delivered',
  };

  const savedOrder = await saveDeliveredOrderWithLoyaltyAward(order);
  await triggerOrderStatusChange(savedOrder, before, 'status_update');
  return savedOrder;
};

const requestReturn = async (userId: string, id: string, input: RequestReturnInput) => {
  const order = await getOrderByIdOrThrow(id);
  assertCanReadOrder(order, userId);

  if (order.status === 'return_requested') {
    return order;
  }

  if (order.status !== 'delivered' && order.status !== 'completed') {
    throw new SalesServiceError('Order can only request return after it is delivered', 400);
  }

  const previousOrderStatus = order.status;
  assertReturnWindowIsOpen(order);
  assertOrderStatusTransition(order.status, 'return_requested');
  assertPaymentAllowsOrderStatus(order, 'return_requested');
  const evidenceImageUrls = await resolveEvidenceImageUrls(order._id.toString(), 'return', input);
  order.status = 'return_requested';
  order.returnRequest = {
    reason: normalizeRequiredReturnReason(input?.reason),
    ...(evidenceImageUrls.length ? { imageUrls: evidenceImageUrls } : {}),
    status: 'requested',
    previousOrderStatus,
    requestedAt: new Date(),
    reviewedAt: null,
    reviewedBy: null,
    reviewReason: null,
  };

  return order.save();
};

const reviewReturnRequest = async (
  id: string,
  reviewerId: string,
  input: ReviewReturnRequestInput,
) => {
  assertReturnReviewDecision(input.decision);

  const order = await getOrderByIdOrThrow(id);
  if (order.status !== 'return_requested' || order.returnRequest?.status !== 'requested') {
    throw new SalesServiceError('Order does not have a pending return request', 400);
  }

  const reviewReason = normalizeReturnReviewReason(input.reason, input.decision);
  const reviewedAt = new Date();
  const reviewedBy = toObjectId(reviewerId, 'reviewerId');

  if (input.decision === 'approved') {
    assertOrderStatusTransition(order.status, 'return_approved');
    assertPaymentAllowsOrderStatus(order, 'return_approved');
    order.status = 'return_approved';
  } else {
    order.status = order.returnRequest.previousOrderStatus === 'completed' ? 'completed' : 'delivered';
    ensureDeliveredInvoiceCode(order);
  }

  order.returnRequest = {
    reason: order.returnRequest.reason,
    ...(order.returnRequest.imageUrls?.length ? { imageUrls: order.returnRequest.imageUrls } : {}),
    status: input.decision,
    previousOrderStatus: order.returnRequest.previousOrderStatus ?? null,
    requestedAt: order.returnRequest.requestedAt,
    reviewedAt,
    reviewedBy,
    reviewReason,
  };

  return order.save();
};

const updateOrderStatus = async (
  id: string,
  input: UpdateOrderStatusInput,
) => {
  if (input.status === 'cancelled') {
    const order = await getOrderByIdOrThrow(id);
    return cancelOrder(toIdString(order.user_id), 'admin', id, input);
  }

  const order = await getOrderByIdOrThrow(id);
  if (input.status === 'return_requested' || input.status === 'return_approved') {
    throw new SalesServiceError('Use the return request review workflow for return orders', 400);
  }

  if (order.status === input.status) {
    return order;
  }

  assertOrderStatusTransition(order.status, input.status);

  assertPaymentAllowsOrderStatus(order, input.status);
  const before = createOrderChangeSnapshot(order);

  order.status = input.status;

  if (input.status === 'delivered') {
    order.deliveredAt = new Date();
    order.shipping = {
      ...(order.shipping ?? {}),
      status: 'delivered',
    };
  }

  if (input.status === 'completed') {
    const completedAt = new Date();
    order.receivedAt = order.receivedAt ?? completedAt;
    order.deliveredAt = order.deliveredAt ?? completedAt;
    order.shipping = {
      ...(order.shipping ?? {}),
      status: 'delivered',
    };
  }

  if ((input.status === 'delivered' || input.status === 'completed') && order.paymentMethod === 'COD') {
    order.paymentStatus = 'paid';
  }

  if (input.status === 'delivered' || input.status === 'completed') {
    const savedOrder = await saveDeliveredOrderWithLoyaltyAward(order);
    await triggerOrderStatusChange(
      savedOrder,
      before,
      'status_update',
      input.status === 'delivered' ? 'delivered' : undefined,
    );
    return savedOrder;
  }

  if (input.status === 'returned') {
    const savedOrder = await saveOrderWithLoyaltyClawback(order, 'Returned merchandise received');
    await triggerOrderStatusChange(savedOrder, before, 'status_update');
    return savedOrder;
  }

  const savedOrder = await order.save();
  await triggerOrderStatusChange(savedOrder, before, 'status_update');
  return savedOrder;
};

const getOrderGhnDestination = (order: IOrder) => {
  const toDistrictId = toNullablePositiveInteger(
    order.shippingAddress?.ghnDistrictId ?? order.shippingAddress?.districtId,
  );
  const toWardCode = trimOptional(order.shippingAddress?.ghnWardCode ?? order.shippingAddress?.wardCode);

  if (!toDistrictId || !toWardCode) {
    throw new SalesServiceError('Order shipping address is missing GHN district or ward code', 400);
  }

  return { toDistrictId, toWardCode };
};

const getOrderPackageMetrics = (order: IOrder) => (
  order.order_list.reduce(
    (metrics, item) => {
      const quantity = Math.max(1, item.quantity);

      return {
        weight: metrics.weight + DEFAULT_GHN_ITEM_WEIGHT_GRAMS * quantity,
        length: DEFAULT_GHN_PACKAGE_LENGTH_CM,
        width: DEFAULT_GHN_PACKAGE_WIDTH_CM,
        height: Math.max(metrics.height, DEFAULT_GHN_PACKAGE_HEIGHT_CM),
        insuranceValue: metrics.insuranceValue + Math.max(0, item.priceAtPurchased) * quantity,
      };
    },
    {
      weight: 0,
      length: DEFAULT_GHN_PACKAGE_LENGTH_CM,
      width: DEFAULT_GHN_PACKAGE_WIDTH_CM,
      height: DEFAULT_GHN_PACKAGE_HEIGHT_CM,
      insuranceValue: 0,
    },
  )
);

const getGhnShipmentTrackingCode = (payload: Record<string, unknown>) =>
  readGhnString(payload, ['order_code', 'orderCode', 'OrderCode']);

const getGhnShipmentFee = (payload: Record<string, unknown>) =>
  readGhnNumber(payload, ['total_fee', 'totalFee', 'fee', 'main_service', 'service_fee']);

const getGhnExpectedDeliveryDate = (payload: Record<string, unknown>) =>
  readGhnDate(payload, ['expected_delivery_time', 'expectedDeliveryTime', 'leadtime', 'lead_time']);

const canCancelLinkedGhnShipment = (order: IOrder) => (
  order.shipping?.provider === 'GHN' &&
  Boolean(order.shipping?.trackingCode) &&
  !['delivered', 'cancelled'].includes(order.shipping?.status ?? '') &&
  (order.status === 'packed' || order.status === 'cancelled')
);

const cancelLinkedGhnShipmentBestEffort = async (order: IOrder) => {
  const trackingCode = order.shipping?.trackingCode?.trim();
  if (!trackingCode || !canCancelLinkedGhnShipment(order)) {
    return null;
  }

  const cancellationPayload = normalizeRawRecord(await GHNService.cancelOrder([trackingCode]));
  order.shipping = {
    ...(order.shipping ?? {}),
    status: 'cancelled',
    rawShipment: {
      previous: order.shipping?.rawShipment ?? null,
      cancellation: cancellationPayload,
    },
  };

  return cancellationPayload;
};

const createGhnShipment = async (id: string) => {
  const order = await getOrderByIdOrThrow(id);

  if (order.status !== 'packed') {
    throw new SalesServiceError('Order must be packed before creating a GHN shipment', 400);
  }

  assertPaymentAllowsOrderStatus(order, 'shipping');

  if (
    order.shipping?.provider === 'GHN' &&
    order.shipping?.trackingCode &&
    order.shipping?.status !== 'cancelled'
  ) {
    throw new SalesServiceError('GHN shipment already exists for this order', 400);
  }

  if (
    order.shippingAddress?.ghnMappingStatus !== 'mapped'
    || !order.shippingAddress?.ghnMappingConfidence
    || !order.shippingAddress?.ghnMappingVerifiedAt
  ) {
    throw new SalesServiceError(
      'Địa chỉ chưa có mapping GHN đã xác minh. Hãy xử lý trong hàng chờ mapping trước khi tạo vận đơn.',
      409,
      { errorCode: 'GHN_MAPPING_REQUIRED' },
    );
  }

  const { toDistrictId, toWardCode } = getOrderGhnDestination(order);
  const metrics = getOrderPackageMetrics(order);
  const orderItems = order.order_list as IOrder['order_list'];
  const rawShipment = normalizeRawRecord(await GHNService.createShippingOrder({
    clientOrderCode: order.orderCode,
    toName: order.shippingAddress.customerName,
    toPhone: order.shippingAddress.phoneNumber,
    toAddress: order.shippingAddress.streetName,
    toWardCode,
    toDistrictId,
    codAmount: order.paymentMethod === 'COD' && order.paymentStatus !== 'paid'
      ? Math.max(0, Math.round(order.totalAmount))
      : 0,
    content: orderItems.map((item) => item.name).join(', ').slice(0, 200),
    weight: Math.max(1, metrics.weight),
    length: metrics.length,
    width: metrics.width,
    height: metrics.height,
    insuranceValue: Math.max(0, Math.round(metrics.insuranceValue)),
    serviceId: order.shipping?.serviceId ?? undefined,
    serviceTypeId: order.shipping?.serviceTypeId ?? DEFAULT_GHN_SERVICE_TYPE_ID,
    items: orderItems.map((item) => ({
      name: item.name,
      quantity: Math.max(1, item.quantity),
      price: Math.max(0, Math.round(item.priceAtPurchased)),
    })),
  }));
  const trackingCode = getGhnShipmentTrackingCode(rawShipment);

  if (!trackingCode) {
    throw new SalesServiceError('GHN did not return an order code', 502);
  }

  order.shipping = {
    ...(order.shipping ?? {}),
    provider: 'GHN',
    serviceTypeId: order.shipping?.serviceTypeId ?? DEFAULT_GHN_SERVICE_TYPE_ID,
    actualProviderCost: getGhnShipmentFee(rawShipment) ?? order.shipping?.actualProviderCost ?? null,
    status: 'ready',
    trackingCode,
    estimatedDeliveryDate: getGhnExpectedDeliveryDate(rawShipment) ?? order.shipping?.estimatedDeliveryDate ?? null,
    rawShipment,
  };

  return order.save();
};

const cancelGhnShipment = async (id: string) => {
  const order = await getOrderByIdOrThrow(id);
  if (!order.shipping?.trackingCode || order.shipping.provider !== 'GHN') {
    throw new SalesServiceError('Order does not have a GHN shipment', 400);
  }

  if (!canCancelLinkedGhnShipment(order)) {
    throw new SalesServiceError('GHN shipment can only be cancelled before delivery starts', 400);
  }

  await cancelLinkedGhnShipmentBestEffort(order);
  return order.save();
};

const syncGhnShipment = async (id: string) => {
  const order = await getOrderByIdOrThrow(id);
  const trackingCode = order.shipping?.trackingCode?.trim();

  if (order.shipping?.provider !== 'GHN' || !trackingCode) {
    throw new SalesServiceError('Order does not have a GHN shipment', 400);
  }

  const detailPayload = normalizeRawRecord(await GHNService.getOrderDetail(trackingCode));
  const input = parseGhnWebhookPayload(detailPayload, { orderId: id });

  return applyShippingWebhook(input);
};

const updateOrderShipping = async (id: string, input: UpdateOrderShippingInput) => {
  const order = await getOrderByIdOrThrow(id);
  const before = createOrderChangeSnapshot(order);
  const currentCustomerFee = order.shipping?.customerFee ?? order.shippingFee ?? null;
  const nextCustomerFee = input.customerFee ?? currentCustomerFee;
  const changesCustomerTotal = typeof input.customerFee === 'number' &&
    Number.isFinite(input.customerFee) &&
    input.customerFee !== currentCustomerFee;

  if (changesCustomerTotal) {
    const canChangeCodTotal = order.paymentMethod === 'COD' &&
      order.paymentStatus === 'pending' &&
      ['confirmed', 'packed'].includes(order.status) &&
      !order.shipping?.trackingCode;

    if (!canChangeCodTotal) {
      throw new SalesServiceError(
        'Customer shipping fee cannot be changed after online checkout, payment, or shipment creation',
        409,
      );
    }
  }

  order.shipping = {
    provider: input.provider ?? order.shipping?.provider ?? null,
    serviceId: input.serviceId ?? order.shipping?.serviceId ?? null,
    serviceTypeId: input.serviceTypeId ?? order.shipping?.serviceTypeId ?? null,
    customerFee: nextCustomerFee,
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
    lastWebhookEventId: order.shipping?.lastWebhookEventId ?? null,
  };

  if (typeof nextCustomerFee === 'number' && Number.isFinite(nextCustomerFee)) {
    order.shippingFee = nextCustomerFee;
    order.totalAmount = Math.max(
      0,
      order.subTotal +
        order.shippingFee +
        order.taxAmount -
        order.couponDiscountAmount -
        order.shippingDiscountAmount -
        order.membershipDiscountAmount,
    );
  }

  const savedOrder = await order.save();
  const milestone = (SHIPPING_MILESTONE_STATUSES as readonly string[]).includes(savedOrder.shipping?.status ?? '')
    ? savedOrder.shipping.status as OrderShippingMilestone
    : undefined;
  await triggerOrderStatusChange(savedOrder, before, 'shipping_update', milestone);
  return savedOrder;
};

const updateOrderGhnMapping = async (
  id: string,
  input: UpdateOrderGhnMappingInput,
  actorId?: string | null,
) => {
  const order = await getOrderByIdOrThrow(id);
  if (order.shipping?.trackingCode) {
    throw new SalesServiceError('Không thể đổi mapping sau khi đã tạo vận đơn', 409);
  }

  const ghnProvinceId = toNullablePositiveInteger(input.ghnProvinceId);
  const ghnDistrictId = toNullablePositiveInteger(input.ghnDistrictId);
  const ghnWardCode = trimOptional(input.ghnWardCode);
  if (!ghnProvinceId || !ghnDistrictId || !ghnWardCode) {
    throw new SalesServiceError('Thông tin mapping GHN không hợp lệ', 400);
  }

  const verifiedAt = new Date();
  const confidence = input.confidence ?? 'manual';
  if (!(['exact', 'manual', 'legacy'] as const).includes(confidence)) {
    throw new SalesServiceError('Độ tin cậy mapping GHN không hợp lệ', 400);
  }
  order.shippingAddress.ghnProvinceId = ghnProvinceId;
  order.shippingAddress.ghnDistrictId = ghnDistrictId;
  order.shippingAddress.ghnWardCode = ghnWardCode;
  order.shippingAddress.ghnMappingStatus = 'mapped';
  order.shippingAddress.ghnMappingConfidence = confidence;
  order.shippingAddress.ghnMappingVerifiedAt = verifiedAt;
  if (order.shipping?.status === 'fallback') {
    order.shipping.status = 'mapping_resolved';
  }

  if (input.applyToFutureAddresses !== false) {
    await shippingAreaMappingService.upsertMappings({
      actorId,
      backfill: true,
      mappings: [{
        provinceCode: order.shippingAddress.provinceCode ?? String(order.shippingAddress.provinceId ?? ''),
        provinceName: order.shippingAddress.province,
        wardCode: order.shippingAddress.wardCode,
        wardName: order.shippingAddress.ward,
        ghnProvinceId,
        ghnDistrictId,
        ghnWardCode,
        confidence,
        status: 'verified',
        verifiedAt,
        note: input.note,
      }],
    });
  }

  return order.save();
};

const getOrderForShippingWebhook = async (input: SimulatedShippingWebhookInput) => {
  if (input.orderId?.trim()) {
    return getOrderByIdOrThrow(input.orderId.trim());
  }

  const trackingCode = input.trackingCode?.trim();
  if (trackingCode) {
    const order = await Order.findOne({ 'shipping.trackingCode': trackingCode });
    if (order) {
      return order;
    }
  }

  const orderCode = input.orderCode?.trim().toUpperCase();
  if (orderCode) {
    const order = await Order.findOne({ orderCode });
    if (!order) {
      throw new SalesServiceError('Order not found for order code', 404);
    }

    return order;
  }

  if (trackingCode) {
    throw new SalesServiceError('Order not found for tracking code', 404);
  }

  throw new SalesServiceError('orderId, trackingCode or orderCode is required', 400);
};

const createWebhookOrderSnapshot = createOrderChangeSnapshot;

const createShippingWebhookEventId = (input: SimulatedShippingWebhookInput) => crypto
  .createHash('sha256')
  .update(JSON.stringify({
    provider: input.provider ?? null,
    orderId: input.orderId ?? null,
    orderCode: input.orderCode ?? null,
    trackingCode: input.trackingCode ?? null,
    status: input.status,
    deliveredAt: input.deliveredAt?.toISOString() ?? null,
    rawPayload: input.rawPayload ?? null,
  }))
  .digest('hex');

const isShippingWebhookAlreadyApplied = (
  order: IOrder,
  input: SimulatedShippingWebhookInput,
  eventId: string,
) => {
  if (order.shipping?.lastWebhookEventId === eventId) return true;
  if (order.shipping?.status !== input.status) return false;
  if (input.trackingCode?.trim() && order.shipping?.trackingCode !== input.trackingCode.trim()) return false;
  if (input.provider?.trim() && order.shipping?.provider !== input.provider.trim()) return false;
  if (input.status === 'delivered') return order.status === 'delivered' || order.status === 'completed';
  if (input.status === 'cancelled') return order.status === 'cancelled';
  if (['picked', 'shipping', 'failed'].includes(input.status)) return order.status === 'shipping';
  return order.status === 'packed' || order.status === 'shipping';
};

const applyShippingWebhook = async (input: SimulatedShippingWebhookInput) => {
  if (!(SHIPPING_WEBHOOK_STATUSES as readonly string[]).includes(input.status)) {
    throw new SalesServiceError('Invalid shipping webhook status', 400);
  }

  const order = await getOrderForShippingWebhook(input);
  const before = createWebhookOrderSnapshot(order);
  const webhookReason = input.reason?.trim() || `Shipping partner reported ${input.status}`;
  const webhookEventId = createShippingWebhookEventId(input);
  if (isShippingWebhookAlreadyApplied(order, input, webhookEventId)) {
    return { before, order, reason: webhookReason, duplicate: true };
  }
  let shouldRestockAfterSave = false;
  const nextShipping = {
    ...(order.shipping ?? {}),
    provider: input.provider ?? order.shipping?.provider ?? null,
    trackingCode: input.trackingCode ?? order.shipping?.trackingCode ?? null,
    status: input.status,
    rawShipment: input.rawPayload ?? order.shipping?.rawShipment ?? null,
    lastWebhookEventId: webhookEventId,
  };

  if (input.status === 'ready' || input.status === 'picking') {
    if (order.status !== 'packed' && order.status !== 'shipping') {
      throw new SalesServiceError('Order must be packed before shipping partner can process it', 400);
    }
    order.shipping = nextShipping;
  }

  if (input.status === 'picked' || input.status === 'shipping') {
    if (order.status !== 'packed' && order.status !== 'shipping') {
      throw new SalesServiceError('Order must be packed before it can be shipped', 400);
    }

    if (order.status === 'packed') {
      assertOrderStatusTransition(order.status, 'shipping');
      assertPaymentAllowsOrderStatus(order, 'shipping');
      order.status = 'shipping';
    }

    order.shipping = nextShipping;
  }

  if (input.status === 'failed') {
    if (order.status !== 'packed' && order.status !== 'shipping') {
      throw new SalesServiceError('Delivery can only fail while order is shipping', 400);
    }

    if (order.status === 'packed') {
      assertOrderStatusTransition(order.status, 'shipping');
      assertPaymentAllowsOrderStatus(order, 'shipping');
      order.status = 'shipping';
    }

    order.shipping = nextShipping;
  }

  if (input.status === 'delivered') {
    if (order.status !== 'packed' && order.status !== 'shipping') {
      throw new SalesServiceError('Order can only be delivered while it is shipping', 400);
    }

    if (order.status === 'packed') {
      assertOrderStatusTransition(order.status, 'shipping');
      assertPaymentAllowsOrderStatus(order, 'shipping');
      order.status = 'shipping';
    }

    assertOrderStatusTransition(order.status, 'delivered');
    assertPaymentAllowsOrderStatus(order, 'delivered');
    order.status = 'delivered';
    order.deliveredAt = input.deliveredAt ?? new Date();

    if (order.paymentMethod === 'COD') {
      order.paymentStatus = 'paid';
    }

    order.shipping = nextShipping;
  }

  if (input.status === 'cancelled') {
    if (order.status !== 'packed' && order.status !== 'shipping' && order.status !== 'cancelled') {
      throw new SalesServiceError('Shipment can only be cancelled after the order is packed', 400);
    }
    order.shipping = nextShipping;

    if (order.status !== 'cancelled') {
      order.status = 'cancelled';
      order.cancellation = {
        reason: normalizeCancelReason(webhookReason),
        cancelledAt: new Date(),
        cancelledBy: null,
        actorRole: 'system',
      };
      shouldRestockAfterSave = true;
    }
  }

  const savedOrder = input.status === 'delivered'
    ? await saveDeliveredOrderWithLoyaltyAward(order)
    : await order.save();
  if (shouldRestockAfterSave) {
    await restockCommittedOrder(savedOrder);
    await rollbackCouponUsageForCancelledOrder(savedOrder);
  }

  const finalOrder = input.status === 'cancelled'
    ? await clawBackLoyaltyPointsForOrder(savedOrder, 'Order cancelled after delivery')
    : savedOrder;

  const milestone = (SHIPPING_MILESTONE_STATUSES as readonly string[]).includes(input.status)
    ? input.status as OrderShippingMilestone
    : undefined;
  await triggerOrderStatusChange(finalOrder, before, 'shipping_update', milestone);

  return {
    before,
    order: finalOrder,
    reason: webhookReason,
  };
};

const applyGhnShippingWebhook = async (payload: unknown) => (
  applyShippingWebhook(parseGhnWebhookPayload(payload))
);

const autoCompleteDeliveredOrders = async (now = new Date()) => {
  const cutoff = new Date(now.getTime() - AUTO_COMPLETE_DELIVERED_AFTER_MS);
  const orders = await Order.find({
    status: 'delivered',
    deliveredAt: { $lte: cutoff },
  }).limit(AUTO_COMPLETE_BATCH_SIZE) as IOrder[];

  const completedOrderIds: string[] = [];
  const failures: Array<{ orderId: string; message: string }> = [];

  for (const order of orders) {
    const before = createOrderChangeSnapshot(order);
    try {
      order.status = 'completed';
      order.receivedAt = order.receivedAt ?? now;
      if (order.paymentMethod === 'COD') {
        order.paymentStatus = 'paid';
      }
      order.shipping = {
        ...(order.shipping ?? {}),
        status: 'delivered',
      };

      const savedOrder = await saveDeliveredOrderWithLoyaltyAward(order);
      await triggerOrderStatusChange(savedOrder, before, 'status_update');
      completedOrderIds.push(toIdString(savedOrder._id));
    } catch (error) {
      failures.push({
        orderId: toIdString(order._id),
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    cutoff,
    scannedCount: orders.length,
    completedCount: completedOrderIds.length,
    failedCount: failures.length,
    completedOrderIds,
    failures,
  };
};

export const orderService = {
  previewCheckout,
  createOrder,
  getMyOrders,
  getOrders,
  getOrdersForExport,
  getOrderById,
  getOrderTransactions,
  adjustOrderPaymentStatus,
  markVNPayRefundCompleted,
  recordRecommendationPaymentCompleted,
  cancelOrder,
  confirmOrderReceived,
  requestReturn,
  reviewReturnRequest,
  applyGhnShippingWebhook,
  applyShippingWebhook,
  cancelGhnShipment,
  createGhnShipment,
  syncGhnShipment,
  updateOrderStatus,
  updateOrderGhnMapping,
  updateOrderShipping,
  cancelOrderForPaymentDeadline,
  autoCompleteDeliveredOrders,
};
