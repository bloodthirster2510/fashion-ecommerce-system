import type { Request, Response } from 'express';
import { created, error as errorResponse, ok } from '../../utils/response';
import type { OrderPaymentMethod, OrderPaymentStatus, OrderStatus } from '../../database/models';
import { auditLogService } from '../audit-logs/audit-log.service';
import { SalesServiceError } from '../sales/sales.helpers';
import { orderService } from './order.service';
import type {
  CreateOrderInput,
  OrderListQueryInput,
  PreviewCheckoutInput,
  UpdateOrderShippingInput,
  UpdateOrderStatusInput,
} from './order.types';

const ORDER_STATUSES: OrderStatus[] = [
  'confirmed',
  'packed',
  'shipping',
  'delivered',
  'cancelled',
  'return_requested',
  'returned',
];
const PAYMENT_METHODS: OrderPaymentMethod[] = ['COD', 'VNPAY', 'MOMO', 'CARD', 'BANK'];
const PAYMENT_STATUSES: OrderPaymentStatus[] = ['pending', 'paid', 'failed', 'refunded'];

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

const parseOrderListQuery = (req: Request): OrderListQueryInput => ({
  status: parseStatus(req.query.status),
  statuses: parseStatuses(req.query.statuses),
  paymentMethod: parsePaymentMethod(req.query.paymentMethod),
  paymentStatus: parsePaymentStatus(req.query.paymentStatus),
  keyword: parseString(req.query.keyword),
  from: parseDate(req.query.from, 'from'),
  to: parseDate(req.query.to, 'to'),
  page: parsePositiveInteger(req.query.page, 'page'),
  limit: parsePositiveInteger(req.query.limit, 'limit'),
});

const getUserId = (req: Request) => req.user!.userId;
const getUserRole = (req: Request) => req.user?.role;

const createOrder = async (req: Request, res: Response) => {
  try {
    const input = req.body as CreateOrderInput;

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
    const order = await orderService.cancelOrder(getUserId(req), getUserRole(req), req.params.id as string);
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
    const beforeOrder = await orderService.getOrderById(getUserId(req), getUserRole(req), req.params.id as string);
    const order = await orderService.requestReturn(getUserId(req), req.params.id as string);

    await auditLogService.recordAuditLogBestEffort({
      actorId: req.user?.userId ?? null,
      actorRole: 'user',
      action: 'order.status_update',
      targetType: 'Order',
      targetId: order._id.toString(),
      reason: typeof req.body?.reason === 'string' ? req.body.reason : 'Customer requested return',
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

    const beforeOrder = await orderService.getOrderById(getUserId(req), getUserRole(req), req.params.id as string);
    const order = await orderService.updateOrderStatus(req.params.id as string, input);
    await auditLogService.recordAuditLogBestEffort({
      actorId: req.user?.userId ?? null,
      actorRole: req.user?.role === 'admin' ? 'admin' : 'staff',
      action: 'order.status_update',
      targetType: 'Order',
      targetId: order._id.toString(),
      reason: typeof req.body?.reason === 'string' ? req.body.reason : null,
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
      },
    });
    return ok(res, order);
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

export {
  cancelOrder,
  confirmOrderReceived,
  createOrder,
  getMyOrders,
  getOrderById,
  getOrderTransactions,
  getOrders,
  previewCheckout,
  requestReturn,
  updateOrderShipping,
  updateOrderStatus,
};
