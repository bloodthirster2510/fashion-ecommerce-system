import crypto from 'crypto';
import type { Request, Response } from 'express';
import { created, error as errorResponse, ok } from '../../utils/response';
import type { OrderPaymentMethod, OrderPaymentStatus, OrderStatus } from '../../database/models';
import { auditLogService } from '../audit-logs/audit-log.service';
import { SalesServiceError } from '../sales/sales.helpers';
import { orderService } from './order.service';
import {
  ORDER_QUEUE_KEYS,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  type OrderQueueKey,
} from './order.constants';
import type {
  BulkOrderGhnAction,
  BulkOrderGhnInput,
  BulkUpdateOrderStatusInput,
  CancelOrderInput,
  CreateOrderInput,
  OrderListQueryInput,
  OrderListSort,
  PreviewCheckoutInput,
  RequestReturnInput,
  ReviewReturnRequestInput,
  SimulatedShippingWebhookInput,
  UpdateOrderGhnMappingInput,
  UpdateOrderShippingInput,
  UpdateOrderStatusInput,
} from './order.types';

const ORDER_LIST_SORTS = [
  'created_desc',
  'created_asc',
  'total_desc',
  'total_asc',
  'payment_deadline_asc',
] as const;
const MAX_BULK_ORDER_COUNT = 100;
const MAX_BULK_GHN_ORDER_COUNT = 20;

const hasStatusCode = (value: unknown): value is { statusCode: number } => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'statusCode' in value &&
    typeof value.statusCode === 'number'
  );
};

const hasErrorCode = (value: unknown): value is { errorCode?: string; data?: Record<string, unknown> } => {
  return typeof value === 'object' && value !== null;
};

const getErrorResponse = (e: unknown) => {
  if (e instanceof SalesServiceError || hasStatusCode(e)) {
    return {
      statusCode: e.statusCode,
      message: e instanceof Error ? e.message : 'An error occurred',
      errorCode: hasErrorCode(e) ? e.errorCode : undefined,
      data: hasErrorCode(e) ? e.data : undefined,
    };
  }

  return {
    statusCode: 500,
    message: e instanceof Error ? e.message : 'An error occurred',
    errorCode: undefined,
    data: undefined,
  };
};

const parseString = (value: unknown) => {
  if (Array.isArray(value)) {
    return parseString(value[0]);
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue || undefined;
};

const parseStringList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap(parseStringList);
  }

  if (typeof value !== 'string') {
    return [];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const parseOptionalBoolean = (value: unknown, fieldName: string) => {
  const normalized = parseString(value)?.toLowerCase();
  if (!normalized) return undefined;
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  throw new SalesServiceError(`Invalid ${fieldName}`, 400);
};

const parsePositiveInteger = (value: unknown, fieldName: string) => {
  const stringValue = parseString(value);

  if (!stringValue) {
    return undefined;
  }

  const numericValue = Number(stringValue);

  if (!Number.isInteger(numericValue) || numericValue < 1) {
    throw new SalesServiceError(`Invalid ${fieldName}`, 400);
  }

  return numericValue;
};

const parseDate = (value: unknown, fieldName: string) => {
  const stringValue = parseString(value);

  if (!stringValue) {
    return undefined;
  }

  const date = new Date(stringValue);
  if (Number.isNaN(date.getTime())) {
    throw new SalesServiceError(`Invalid ${fieldName}`, 400);
  }

  return date;
};

const parseDateTo = (value: unknown, fieldName: string) => {
  const stringValue = parseString(value);
  const date = parseDate(value, fieldName);

  if (date && stringValue && /^\d{4}-\d{2}-\d{2}$/.test(stringValue)) {
    date.setUTCHours(23, 59, 59, 999);
  }

  return date;
};

const parseStatus = (value: unknown) => {
  const status = parseString(value);

  if (!status) {
    return undefined;
  }

  if (!ORDER_STATUSES.includes(status as OrderStatus)) {
    throw new SalesServiceError('Invalid order status', 400);
  }

  return status as OrderStatus;
};

const parseStatuses = (value: unknown) => {
  const statuses = parseStringList(value);

  if (statuses.length === 0) {
    return undefined;
  }

  const uniqueStatuses = Array.from(new Set(statuses));
  uniqueStatuses.forEach((status) => {
    if (!ORDER_STATUSES.includes(status as OrderStatus)) {
      throw new SalesServiceError('Invalid order status', 400);
    }
  });

  return uniqueStatuses as OrderStatus[];
};

const parseOrderQueue = (value: unknown) => {
  const queue = parseString(value);

  if (!queue) {
    return undefined;
  }

  if (!ORDER_QUEUE_KEYS.includes(queue as OrderQueueKey)) {
    throw new SalesServiceError('Invalid order queue', 400);
  }

  return queue as OrderQueueKey;
};

const parsePaymentMethod = (value: unknown) => {
  const paymentMethod = parseString(value);

  if (!paymentMethod) {
    return undefined;
  }

  if (!PAYMENT_METHODS.includes(paymentMethod as OrderPaymentMethod)) {
    throw new SalesServiceError('Invalid payment method', 400);
  }

  return paymentMethod as OrderPaymentMethod;
};

const parsePaymentMethods = (value: unknown) => {
  const paymentMethods = parseStringList(value);

  if (paymentMethods.length === 0) {
    return undefined;
  }

  const uniquePaymentMethods = Array.from(new Set(paymentMethods));
  uniquePaymentMethods.forEach((paymentMethod) => {
    if (!PAYMENT_METHODS.includes(paymentMethod as OrderPaymentMethod)) {
      throw new SalesServiceError('Invalid payment method', 400);
    }
  });

  return uniquePaymentMethods as OrderPaymentMethod[];
};

const parsePaymentStatus = (value: unknown) => {
  const paymentStatus = parseString(value);

  if (!paymentStatus) {
    return undefined;
  }

  if (!PAYMENT_STATUSES.includes(paymentStatus as OrderPaymentStatus)) {
    throw new SalesServiceError('Invalid payment status', 400);
  }

  return paymentStatus as OrderPaymentStatus;
};

const parsePaymentStatuses = (value: unknown) => {
  const paymentStatuses = parseStringList(value);

  if (paymentStatuses.length === 0) {
    return undefined;
  }

  const uniquePaymentStatuses = Array.from(new Set(paymentStatuses));
  uniquePaymentStatuses.forEach((paymentStatus) => {
    if (!PAYMENT_STATUSES.includes(paymentStatus as OrderPaymentStatus)) {
      throw new SalesServiceError('Invalid payment status', 400);
    }
  });

  return uniquePaymentStatuses as OrderPaymentStatus[];
};

const parseOrderListSort = (value: unknown): OrderListQueryInput['sort'] => {
  const sort = parseString(value);

  if (!sort) {
    return undefined;
  }

  if (!ORDER_LIST_SORTS.includes(sort as OrderListSort)) {
    throw new SalesServiceError('Invalid order sort', 400);
  }

  return sort as OrderListSort;
};

const parseOrderListQuery = (req: Request): OrderListQueryInput => ({
  queue: parseOrderQueue(req.query.queue),
  status: parseStatus(req.query.status),
  statuses: parseStatuses(req.query.statuses),
  paymentMethod: parsePaymentMethod(req.query.paymentMethod),
  paymentMethods: parsePaymentMethods(req.query.paymentMethods),
  paymentStatus: parsePaymentStatus(req.query.paymentStatus),
  paymentStatuses: parsePaymentStatuses(req.query.paymentStatuses),
  keyword: parseString(req.query.keyword),
  from: parseDate(req.query.dateFrom ?? req.query.from, 'dateFrom'),
  to: parseDateTo(req.query.dateTo ?? req.query.to, 'dateTo'),
  paymentDeadlineBefore: parseDate(req.query.paymentDeadlineBefore, 'paymentDeadlineBefore'),
  shippingFallback: parseOptionalBoolean(req.query.shippingFallback, 'shippingFallback'),
  sort: parseOrderListSort(req.query.sort),
  page: parsePositiveInteger(req.query.page, 'page'),
  limit: parsePositiveInteger(req.query.limit, 'limit'),
});

const parseBulkOrderIds = (value: unknown, maxOrderCount = MAX_BULK_ORDER_COUNT) => {
  if (!Array.isArray(value)) {
    throw new SalesServiceError('orderIds must be an array', 400);
  }

  const orderIds = Array.from(new Set(
    value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean),
  ));

  if (orderIds.length === 0) {
    throw new SalesServiceError('At least one orderId is required', 400);
  }

  if (orderIds.length > maxOrderCount) {
    throw new SalesServiceError(`A batch cannot exceed ${maxOrderCount} orders`, 400);
  }

  return orderIds;
};

const parseRequiredReason = (value: unknown) => {
  const reason = parseString(value);
  if (!reason) {
    throw new SalesServiceError('reason is required', 400);
  }
  if (reason.length > 500) {
    throw new SalesServiceError('reason cannot exceed 500 characters', 400);
  }
  return reason;
};

const parseBulkGhnAction = (value: unknown): BulkOrderGhnAction => {
  const action = parseString(value);
  if (action !== 'create' && action !== 'sync') {
    throw new SalesServiceError('action must be create or sync', 400);
  }
  return action;
};

const getUserId = (req: Request) => req.user!.userId;
const getUserRole = (req: Request) => req.user?.role;
const getRequiredWebhookSecret = (envName: 'SHIPPING_WEBHOOK_SECRET' | 'GHN_WEBHOOK_SECRET') => {
  const secret = process.env[envName]?.trim();

  if (!secret) {
    throw new SalesServiceError(`${envName} is not configured`, 503);
  }

  return secret;
};

const timingSafeSecretEqual = (receivedSecret: string | undefined, expectedSecret: string) => {
  if (!receivedSecret) {
    return false;
  }

  const receivedBuffer = Buffer.from(receivedSecret);
  const expectedBuffer = Buffer.from(expectedSecret);

  if (receivedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
};

const parseShippingWebhookInput = (
  value: unknown,
  overrides: Partial<SimulatedShippingWebhookInput> = {},
): SimulatedShippingWebhookInput => {
  const body = typeof value === 'object' && value !== null
    ? value as Record<string, unknown>
    : {};
  const status = parseString(body.status);
  const deliveredAt = parseDate(body.deliveredAt, 'deliveredAt');

  if (!status) {
    throw new SalesServiceError('status is required', 400);
  }

  return {
    orderId: parseString(body.orderId),
    trackingCode: parseString(body.trackingCode),
    status: status as SimulatedShippingWebhookInput['status'],
    reason: parseString(body.reason),
    provider: parseString(body.provider) ?? null,
    deliveredAt: deliveredAt ?? null,
    rawPayload: body,
    ...overrides,
  };
};

const recordShippingWebhookAudit = async ({
  actorId,
  actorRole,
  source,
  result,
}: {
  actorId?: string | null;
  actorRole: 'admin' | 'staff' | 'system';
  source: 'external_webhook' | 'admin_simulation';
  result: Awaited<ReturnType<typeof orderService.applyShippingWebhook>>;
}) => {
  await auditLogService.recordAuditLogBestEffort({
    actorId: actorId ?? null,
    actorRole,
    action: 'order.shipping_webhook',
    targetType: 'Order',
    targetId: result.order._id.toString(),
    reason: result.reason,
    before: result.before,
    after: {
      status: result.order.status,
      paymentStatus: result.order.paymentStatus,
      deliveredAt: result.order.deliveredAt ?? null,
      shipping: result.order.shipping ?? null,
    },
    metadata: {
      orderCode: result.order.orderCode,
      webhookSource: source,
      shippingStatus: result.order.shipping?.status ?? null,
      trackingCode: result.order.shipping?.trackingCode ?? null,
    },
  });
};

const recordOrderShippingUpdateAudit = async ({
  req,
  beforeOrder,
  order,
  reason,
  metadata,
}: {
  req: Request;
  beforeOrder: Awaited<ReturnType<typeof orderService.getOrderById>>;
  order: Awaited<ReturnType<typeof orderService.updateOrderShipping>>;
  reason: string;
  metadata?: Record<string, unknown>;
}) => {
  await auditLogService.recordAuditLogBestEffort({
    actorId: req.user?.userId ?? null,
    actorRole: req.user?.role === 'admin' ? 'admin' : 'staff',
    action: 'order.shipping_update',
    targetType: 'Order',
    targetId: order._id.toString(),
    reason,
    before: {
      shipping: beforeOrder.shipping ?? null,
    },
    after: {
      shipping: order.shipping ?? null,
    },
    metadata: {
      orderCode: order.orderCode,
      provider: order.shipping?.provider ?? null,
      trackingCode: order.shipping?.trackingCode ?? null,
      shippingStatus: order.shipping?.status ?? null,
      ...metadata,
    },
  });
};

const applyAdminOrderStatusUpdate = async ({
  req,
  orderId,
  input,
  metadata,
}: {
  req: Request;
  orderId: string;
  input: UpdateOrderStatusInput;
  metadata?: Record<string, unknown>;
}) => {
  const beforeOrder = await orderService.getOrderById(getUserId(req), getUserRole(req), orderId);
  const order = input.status === 'cancelled'
    ? await orderService.cancelOrder(
      getUserId(req),
      getUserRole(req),
      orderId,
      input as CancelOrderInput,
    )
    : await orderService.updateOrderStatus(orderId, input);

  await auditLogService.recordAuditLogBestEffort({
    actorId: req.user?.userId ?? null,
    actorRole: req.user?.role === 'admin' ? 'admin' : 'staff',
    action: 'order.status_update',
    targetType: 'Order',
    targetId: order._id.toString(),
    reason: input.reason ?? null,
    before: {
      status: beforeOrder.status,
      paymentStatus: beforeOrder.paymentStatus,
    },
    after: {
      status: order.status,
      paymentStatus: order.paymentStatus,
    },
    metadata: {
      orderCode: order.orderCode,
      ...metadata,
    },
  });

  return order;
};

const toCsvCell = (value: unknown) => {
  if (value === null || value === undefined) return '""';
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '""';
  }

  const text = value instanceof Date ? value.toISOString() : String(value);
  const formulaSafeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${formulaSafeText.replace(/"/g, '""')}"`;
};

const buildOrdersCsv = (
  orders: Awaited<ReturnType<typeof orderService.getOrdersForExport>>['items'],
) => {
  const headers = [
    'Mã đơn',
    'Mã hóa đơn',
    'Khách hàng',
    'Số điện thoại',
    'Sản phẩm',
    'Ngày tạo',
    'Trạng thái đơn',
    'Kênh thanh toán đơn',
    'Trạng thái thanh toán',
    'Tạm tính',
    'Phí vận chuyển',
    'Giảm giá',
    'Tổng thanh toán',
    'Đơn vị vận chuyển',
    'Mã vận đơn',
    'URL nhãn vận chuyển',
  ];
  const rows = orders.map((order) => {
    const productSummary = order.order_list
      .map((item: { quantity: number; name: string }) => `${item.quantity}x ${item.name}`)
      .join(' | ');
    const totalDiscount = (order.couponDiscountAmount ?? 0)
      + (order.shippingDiscountAmount ?? 0)
      + (order.membershipDiscountAmount ?? 0);

    return [
      order.orderCode,
      order.invoiceCode ?? '',
      order.shippingAddress?.customerName ?? '',
      order.shippingAddress?.phoneNumber ?? '',
      productSummary,
      order.createdAt,
      order.status,
      order.paymentMethod,
      order.paymentStatus,
      order.subTotal,
      order.shippingFee,
      totalDiscount,
      order.totalAmount,
      order.shipping?.provider ?? '',
      order.shipping?.trackingCode ?? '',
      order.shipping?.labelUrl ?? '',
    ].map(toCsvCell).join(',');
  });

  return `\uFEFF${[headers.map(toCsvCell).join(','), ...rows].join('\r\n')}`;
};

const createOrder = async (req: Request, res: Response) => {
  try {
    const idempotencyKey = req.get('Idempotency-Key')?.trim();
    if (idempotencyKey && !/^[A-Za-z0-9_-]{8,100}$/.test(idempotencyKey)) {
      return errorResponse(res, 'Invalid Idempotency-Key', 400);
    }
    const input = { ...req.body, idempotencyKey } as CreateOrderInput;

    if (!input.cartItemIds?.length || !input.paymentMethod) {
      return errorResponse(res, 'cartItemIds and paymentMethod are required', 400);
    }

    const order = await orderService.createOrder(getUserId(req), input);
    return created(res, order);
  } catch (e: unknown) {
    const { statusCode, message, errorCode, data } = getErrorResponse(e);
    return errorResponse(res, message, statusCode, { errorCode, data });
  }
};

const previewCheckout = async (req: Request, res: Response) => {
  try {
    const input = req.body as PreviewCheckoutInput;

    if (!input.cartItemIds?.length) {
      return errorResponse(res, 'cartItemIds are required', 400);
    }

    const preview = await orderService.previewCheckout(getUserId(req), input);
    return ok(res, preview);
  } catch (e: unknown) {
    const { statusCode, message, errorCode, data } = getErrorResponse(e);
    return errorResponse(res, message, statusCode, { errorCode, data });
  }
};

const getMyOrders = async (req: Request, res: Response) => {
  try {
    const orders = await orderService.getMyOrders(getUserId(req), parseOrderListQuery(req));
    return ok(res, orders);
  } catch (e: unknown) {
    const { statusCode, message, errorCode, data } = getErrorResponse(e);
    return errorResponse(res, message, statusCode, { errorCode, data });
  }
};

const getOrders = async (req: Request, res: Response) => {
  try {
    const orders = await orderService.getOrders(parseOrderListQuery(req));
    return ok(res, orders);
  } catch (e: unknown) {
    const { statusCode, message, errorCode, data } = getErrorResponse(e);
    return errorResponse(res, message, statusCode, { errorCode, data });
  }
};

const exportOrdersCsv = async (req: Request, res: Response) => {
  try {
    const result = await orderService.getOrdersForExport(parseOrderListQuery(req));
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="orders-${timestamp}.csv"`);
    res.setHeader('X-Export-Total', String(result.totalItems));
    res.setHeader('X-Export-Truncated', String(result.truncated));
    return res.status(200).send(buildOrdersCsv(result.items));
  } catch (e: unknown) {
    const { statusCode, message, errorCode, data } = getErrorResponse(e);
    return errorResponse(res, message, statusCode, { errorCode, data });
  }
};

const getOrderById = async (req: Request, res: Response) => {
  try {
    const order = await orderService.getOrderById(getUserId(req), getUserRole(req), req.params.id as string);
    return ok(res, order);
  } catch (e: unknown) {
    const { statusCode, message, errorCode, data } = getErrorResponse(e);
    return errorResponse(res, message, statusCode, { errorCode, data });
  }
};

const getOrderTransactions = async (req: Request, res: Response) => {
  try {
    const transactions = await orderService.getOrderTransactions(
      getUserId(req),
      getUserRole(req),
      req.params.id as string,
    );
    return ok(res, transactions);
  } catch (e: unknown) {
    const { statusCode, message, errorCode, data } = getErrorResponse(e);
    return errorResponse(res, message, statusCode, { errorCode, data });
  }
};

const cancelOrder = async (req: Request, res: Response) => {
  try {
    const input = req.body as CancelOrderInput;
    const beforeOrder = await orderService.getOrderById(getUserId(req), getUserRole(req), req.params.id as string);
    const order = await orderService.cancelOrder(getUserId(req), getUserRole(req), req.params.id as string, input);
    const actorRole = req.user?.role === 'admin' || req.user?.role === 'staff' ? req.user.role : 'user';

    await auditLogService.recordAuditLogBestEffort({
      actorId: req.user?.userId ?? null,
      actorRole,
      action: 'order.status_update',
      targetType: 'Order',
      targetId: order._id.toString(),
      reason: order.cancellation?.reason ?? 'Order cancelled',
      before: {
        status: beforeOrder.status,
        paymentStatus: beforeOrder.paymentStatus,
      },
      after: {
        status: order.status,
        paymentStatus: order.paymentStatus,
      },
      metadata: {
        orderCode: order.orderCode,
        cancellationReason: order.cancellation?.reason ?? null,
        cancellationImageCount: order.cancellation?.imageUrls?.length ?? 0,
      },
    });

    return ok(res, order);
  } catch (e: unknown) {
    const { statusCode, message, errorCode, data } = getErrorResponse(e);
    return errorResponse(res, message, statusCode, { errorCode, data });
  }
};

const confirmOrderReceived = async (req: Request, res: Response) => {
  try {
    const beforeOrder = await orderService.getOrderById(getUserId(req), getUserRole(req), req.params.id as string);
    const order = await orderService.confirmOrderReceived(getUserId(req), req.params.id as string);

    await auditLogService.recordAuditLogBestEffort({
      actorId: req.user?.userId ?? null,
      actorRole: 'user',
      action: 'order.status_update',
      targetType: 'Order',
      targetId: order._id.toString(),
      reason: 'Customer confirmed order received',
      before: {
        status: beforeOrder.status,
        paymentStatus: beforeOrder.paymentStatus,
        shippingStatus: beforeOrder.shipping?.status ?? null,
      },
      after: {
        status: order.status,
        paymentStatus: order.paymentStatus,
        shippingStatus: order.shipping?.status ?? null,
      },
      metadata: {
        orderCode: order.orderCode,
      },
    });

    return ok(res, order);
  } catch (e: unknown) {
    const { statusCode, message, errorCode, data } = getErrorResponse(e);
    return errorResponse(res, message, statusCode, { errorCode, data });
  }
};

const requestReturn = async (req: Request, res: Response) => {
  try {
    const input = req.body as RequestReturnInput;
    const beforeOrder = await orderService.getOrderById(getUserId(req), getUserRole(req), req.params.id as string);
    const order = await orderService.requestReturn(getUserId(req), req.params.id as string, input);

    await auditLogService.recordAuditLogBestEffort({
      actorId: req.user?.userId ?? null,
      actorRole: 'user',
      action: 'order.status_update',
      targetType: 'Order',
      targetId: order._id.toString(),
      reason: order.returnRequest?.reason ?? 'Customer requested return',
      before: {
        status: beforeOrder.status,
        paymentStatus: beforeOrder.paymentStatus,
      },
      after: {
        status: order.status,
        paymentStatus: order.paymentStatus,
      },
      metadata: {
        orderCode: order.orderCode,
        returnReason: order.returnRequest?.reason ?? null,
        returnImageCount: order.returnRequest?.imageUrls?.length ?? 0,
      },
    });

    return ok(res, order);
  } catch (e: unknown) {
    const { statusCode, message, errorCode, data } = getErrorResponse(e);
    return errorResponse(res, message, statusCode, { errorCode, data });
  }
};

const reviewReturnRequest = async (req: Request, res: Response) => {
  try {
    const input = req.body as ReviewReturnRequestInput;
    if (input.decision !== 'approved' && input.decision !== 'rejected') {
      return errorResponse(res, 'decision must be approved or rejected', 400);
    }

    const beforeOrder = await orderService.getOrderById(getUserId(req), getUserRole(req), req.params.id as string);
    const order = await orderService.reviewReturnRequest(req.params.id as string, getUserId(req), input);
    const decisionReason = typeof input.reason === 'string' && input.reason.trim()
      ? input.reason.trim()
      : (input.decision === 'approved' ? 'Return request approved' : 'Return request rejected');

    await auditLogService.recordAuditLogBestEffort({
      actorId: req.user?.userId ?? null,
      actorRole: req.user?.role === 'admin' ? 'admin' : 'staff',
      action: 'order.status_update',
      targetType: 'Order',
      targetId: order._id.toString(),
      reason: decisionReason,
      before: {
        status: beforeOrder.status,
        paymentStatus: beforeOrder.paymentStatus,
        returnRequestStatus: beforeOrder.returnRequest?.status ?? null,
      },
      after: {
        status: order.status,
        paymentStatus: order.paymentStatus,
        returnRequestStatus: order.returnRequest?.status ?? null,
      },
      metadata: {
        orderCode: order.orderCode,
        returnDecision: input.decision,
        returnReason: beforeOrder.returnRequest?.reason ?? null,
      },
    });

    return ok(res, order);
  } catch (e: unknown) {
    const { statusCode, message, errorCode, data } = getErrorResponse(e);
    return errorResponse(res, message, statusCode, { errorCode, data });
  }
};

const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const input = req.body as UpdateOrderStatusInput;

    if (!parseStatus(input.status)) {
      return errorResponse(res, 'status is required', 400);
    }

    const order = await applyAdminOrderStatusUpdate({
      req,
      orderId: req.params.id as string,
      input,
    });
    return ok(res, order);
  } catch (e: unknown) {
    const { statusCode, message, errorCode, data } = getErrorResponse(e);
    return errorResponse(res, message, statusCode, { errorCode, data });
  }
};

const bulkUpdateOrderStatus = async (req: Request, res: Response) => {
  try {
    const status = parseStatus(req.body?.status);
    if (!status) {
      throw new SalesServiceError('status is required', 400);
    }

    const input: BulkUpdateOrderStatusInput = {
      orderIds: parseBulkOrderIds(req.body?.orderIds),
      status,
      reason: parseRequiredReason(req.body?.reason),
    };
    const batchId = crypto.randomUUID();
    const results: Array<{
      orderId: string;
      success: boolean;
      order?: unknown;
      message?: string;
      errorCode?: string;
      statusCode?: number;
    }> = [];

    for (const orderId of input.orderIds) {
      try {
        const order = await applyAdminOrderStatusUpdate({
          req,
          orderId,
          input: {
            status: input.status,
            reason: input.reason,
          },
          metadata: { bulk: true, batchId },
        });
        results.push({ orderId, success: true, order });
      } catch (error: unknown) {
        const failure = getErrorResponse(error);
        results.push({
          orderId,
          success: false,
          message: failure.message,
          errorCode: failure.errorCode,
          statusCode: failure.statusCode,
        });
      }
    }

    const succeededCount = results.filter((result) => result.success).length;
    return ok(res, {
      batchId,
      requestedCount: input.orderIds.length,
      succeededCount,
      failedCount: input.orderIds.length - succeededCount,
      results,
    });
  } catch (e: unknown) {
    const { statusCode, message, errorCode, data } = getErrorResponse(e);
    return errorResponse(res, message, statusCode, { errorCode, data });
  }
};

const bulkProcessGhnShipments = async (req: Request, res: Response) => {
  try {
    const input: BulkOrderGhnInput = {
      orderIds: parseBulkOrderIds(req.body?.orderIds, MAX_BULK_GHN_ORDER_COUNT),
      action: parseBulkGhnAction(req.body?.action),
      reason: parseRequiredReason(req.body?.reason),
    };
    const batchId = crypto.randomUUID();
    const results: Array<{
      orderId: string;
      success: boolean;
      order?: unknown;
      message?: string;
      errorCode?: string;
      statusCode?: number;
    }> = [];

    for (const orderId of input.orderIds) {
      try {
        const beforeOrder = await orderService.getOrderById(getUserId(req), getUserRole(req), orderId);
        const order = input.action === 'create'
          ? await orderService.createGhnShipment(orderId)
          : (await orderService.syncGhnShipment(orderId)).order;

        await recordOrderShippingUpdateAudit({
          req,
          beforeOrder,
          order,
          reason: input.reason,
          metadata: {
            bulk: true,
            batchId,
            ghnAction: input.action,
          },
        });
        results.push({ orderId, success: true, order });
      } catch (error: unknown) {
        const failure = getErrorResponse(error);
        results.push({
          orderId,
          success: false,
          message: failure.message,
          errorCode: failure.errorCode,
          statusCode: failure.statusCode,
        });
      }
    }

    const succeededCount = results.filter((result) => result.success).length;
    return ok(res, {
      batchId,
      requestedCount: input.orderIds.length,
      succeededCount,
      failedCount: input.orderIds.length - succeededCount,
      results,
    });
  } catch (e: unknown) {
    const { statusCode, message, errorCode, data } = getErrorResponse(e);
    return errorResponse(res, message, statusCode, { errorCode, data });
  }
};

const updateOrderShipping = async (req: Request, res: Response) => {
  try {
    const body = req.body as UpdateOrderShippingInput & { estimatedDeliveryDate?: string | Date | null };
    const beforeOrder = await orderService.getOrderById(getUserId(req), getUserRole(req), req.params.id as string);
    const order = await orderService.updateOrderShipping(req.params.id as string, {
      provider: body.provider,
      serviceId: body.serviceId,
      serviceTypeId: body.serviceTypeId,
      fee: body.fee,
      customerFee: body.customerFee,
      quotedProviderCost: body.quotedProviderCost,
      actualProviderCost: body.actualProviderCost,
      comparisonStatus: body.comparisonStatus,
      pricingMode: body.pricingMode,
      recommendedOptionKey: body.recommendedOptionKey,
      selectedOptionKey: body.selectedOptionKey,
      quoteVersion: body.quoteVersion,
      options: body.options ?? null,
      status: body.status,
      trackingCode: body.trackingCode,
      labelUrl: body.labelUrl,
      estimatedDeliveryDate: body.estimatedDeliveryDate
        ? new Date(body.estimatedDeliveryDate)
        : body.estimatedDeliveryDate,
      rawQuote: body.rawQuote,
      rawShipment: body.rawShipment,
    });

    await auditLogService.recordAuditLogBestEffort({
      actorId: req.user?.userId ?? null,
      actorRole: req.user?.role === 'admin' ? 'admin' : 'staff',
      action: 'order.shipping_update',
      targetType: 'Order',
      targetId: order._id.toString(),
      reason: typeof req.body?.reason === 'string' ? req.body.reason : null,
      before: {
        shipping: beforeOrder.shipping ?? null,
      },
      after: {
        shipping: order.shipping ?? null,
      },
      metadata: {
        orderCode: order.orderCode,
      },
    });

    return ok(res, order);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const updateOrderGhnMapping = async (req: Request, res: Response) => {
  try {
    const beforeOrder = await orderService.getOrderById(
      getUserId(req),
      getUserRole(req),
      req.params.id as string,
    );
    const body = req.body as UpdateOrderGhnMappingInput;
    const order = await orderService.updateOrderGhnMapping(
      req.params.id as string,
      body,
      req.user?.userId,
    );

    await auditLogService.recordAuditLogBestEffort({
      actorId: req.user?.userId ?? null,
      actorRole: req.user?.role === 'admin' ? 'admin' : 'staff',
      action: 'order.shipping_mapping_update',
      targetType: 'Order',
      targetId: order._id.toString(),
      reason: typeof body.note === 'string' ? body.note : 'Verified GHN address mapping',
      before: {
        shippingAddress: beforeOrder.shippingAddress ?? null,
      },
      after: {
        shippingAddress: order.shippingAddress ?? null,
      },
      metadata: {
        orderCode: order.orderCode,
        applyToFutureAddresses: body.applyToFutureAddresses !== false,
      },
    });

    return ok(res, order);
  } catch (e: unknown) {
    const { statusCode, message, errorCode, data } = getErrorResponse(e);
    return errorResponse(res, message, statusCode, { errorCode, data });
  }
};

const createGhnShipment = async (req: Request, res: Response) => {
  try {
    const beforeOrder = await orderService.getOrderById(getUserId(req), getUserRole(req), req.params.id as string);
    const order = await orderService.createGhnShipment(req.params.id as string);

    await recordOrderShippingUpdateAudit({
      req,
      beforeOrder,
      order,
      reason: 'Created GHN shipment',
    });

    return ok(res, order);
  } catch (e: unknown) {
    const { statusCode, message, errorCode, data } = getErrorResponse(e);
    return errorResponse(res, message, statusCode, { errorCode, data });
  }
};

const cancelGhnShipment = async (req: Request, res: Response) => {
  try {
    const beforeOrder = await orderService.getOrderById(getUserId(req), getUserRole(req), req.params.id as string);
    const order = await orderService.cancelGhnShipment(req.params.id as string);

    await recordOrderShippingUpdateAudit({
      req,
      beforeOrder,
      order,
      reason: typeof req.body?.reason === 'string' && req.body.reason.trim()
        ? req.body.reason.trim()
        : 'Cancelled GHN shipment',
    });

    return ok(res, order);
  } catch (e: unknown) {
    const { statusCode, message, errorCode, data } = getErrorResponse(e);
    return errorResponse(res, message, statusCode, { errorCode, data });
  }
};

const syncGhnShipment = async (req: Request, res: Response) => {
  try {
    const beforeOrder = await orderService.getOrderById(getUserId(req), getUserRole(req), req.params.id as string);
    const result = await orderService.syncGhnShipment(req.params.id as string);

    await recordOrderShippingUpdateAudit({
      req,
      beforeOrder,
      order: result.order,
      reason: result.reason || 'Synced GHN shipment',
    });

    return ok(res, result.order);
  } catch (e: unknown) {
    const { statusCode, message, errorCode, data } = getErrorResponse(e);
    return errorResponse(res, message, statusCode, { errorCode, data });
  }
};

const handleSimulatedShippingWebhook = async (req: Request, res: Response) => {
  try {
    const receivedSecret = parseString(req.headers['x-webhook-secret']);
    if (!timingSafeSecretEqual(receivedSecret, getRequiredWebhookSecret('SHIPPING_WEBHOOK_SECRET'))) {
      return errorResponse(res, 'Invalid shipping webhook secret', 401);
    }

    const input = parseShippingWebhookInput(req.body);
    const result = await orderService.applyShippingWebhook(input);

    await recordShippingWebhookAudit({
      actorRole: 'system',
      source: 'external_webhook',
      result,
    });

    return ok(res, result.order);
  } catch (e: unknown) {
    const { statusCode, message, errorCode, data } = getErrorResponse(e);
    return errorResponse(res, message, statusCode, { errorCode, data });
  }
};

const simulateShippingWebhook = async (req: Request, res: Response) => {
  try {
    const input = parseShippingWebhookInput(req.body, {
      orderId: req.params.id as string,
    });
    const result = await orderService.applyShippingWebhook(input);

    await recordShippingWebhookAudit({
      actorId: req.user?.userId ?? null,
      actorRole: req.user?.role === 'admin' ? 'admin' : 'staff',
      source: 'admin_simulation',
      result,
    });

    return ok(res, result.order);
  } catch (e: unknown) {
    const { statusCode, message, errorCode, data } = getErrorResponse(e);
    return errorResponse(res, message, statusCode, { errorCode, data });
  }
};

const handleGhnShippingWebhook = async (req: Request, res: Response) => {
  try {
    // GHN does not document support for custom headers. A secret query parameter
    // keeps the public callback compatible while still failing closed.
    const receivedSecret = parseString(req.headers['x-webhook-secret'])
      ?? parseString(req.query.token);
    if (!timingSafeSecretEqual(receivedSecret, getRequiredWebhookSecret('GHN_WEBHOOK_SECRET'))) {
      return errorResponse(res, 'Invalid GHN webhook secret', 401);
    }

    const result = await orderService.applyGhnShippingWebhook(req.body);

    await recordShippingWebhookAudit({
      actorRole: 'system',
      source: 'external_webhook',
      result,
    });

    return ok(res, result.order);
  } catch (e: unknown) {
    const { statusCode, message, errorCode, data } = getErrorResponse(e);
    return errorResponse(res, message, statusCode, { errorCode, data });
  }
};

export {
  bulkProcessGhnShipments,
  bulkUpdateOrderStatus,
  cancelOrder,
  cancelGhnShipment,
  confirmOrderReceived,
  createGhnShipment,
  createOrder,
  getMyOrders,
  getOrderById,
  getOrderTransactions,
  getOrders,
  exportOrdersCsv,
  handleGhnShippingWebhook,
  handleSimulatedShippingWebhook,
  previewCheckout,
  requestReturn,
  reviewReturnRequest,
  simulateShippingWebhook,
  syncGhnShipment,
  updateOrderShipping,
  updateOrderGhnMapping,
  updateOrderStatus,
};
