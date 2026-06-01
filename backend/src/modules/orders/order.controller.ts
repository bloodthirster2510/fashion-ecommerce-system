import type { Request, Response } from 'express';
import { created, error as errorResponse, ok } from '../../utils/response';
import type { OrderPaymentMethod, OrderStatus } from '../../database/models';
import { SalesServiceError } from '../sales/sales.helpers';
import { orderService } from './order.service';
import type {
  CreateOrderInput,
  OrderListQueryInput,
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

const hasStatusCode = (value: unknown): value is { statusCode: number } => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'statusCode' in value &&
    typeof value.statusCode === 'number'
  );
};

const getErrorResponse = (e: unknown) => {
  if (e instanceof SalesServiceError || hasStatusCode(e)) {
    return {
      statusCode: e.statusCode,
      message: e instanceof Error ? e.message : 'An error occurred',
    };
  }

  return {
    statusCode: 500,
    message: e instanceof Error ? e.message : 'An error occurred',
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

const parseOrderListQuery = (req: Request): OrderListQueryInput => ({
  status: parseStatus(req.query.status),
  paymentMethod: parsePaymentMethod(req.query.paymentMethod),
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

    if (!input.cartItemIds?.length || !input.shippingAddress || !input.paymentMethod) {
      return errorResponse(res, 'cartItemIds, shippingAddress, and paymentMethod are required', 400);
    }

    const order = await orderService.createOrder(getUserId(req), input);
    return created(res, order);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const getMyOrders = async (req: Request, res: Response) => {
  try {
    const orders = await orderService.getMyOrders(getUserId(req), parseOrderListQuery(req));
    return ok(res, orders);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const getOrders = async (req: Request, res: Response) => {
  try {
    const orders = await orderService.getOrders(parseOrderListQuery(req));
    return ok(res, orders);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const getOrderById = async (req: Request, res: Response) => {
  try {
    const order = await orderService.getOrderById(getUserId(req), getUserRole(req), req.params.id as string);
    return ok(res, order);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const cancelOrder = async (req: Request, res: Response) => {
  try {
    const order = await orderService.cancelOrder(getUserId(req), getUserRole(req), req.params.id as string);
    return ok(res, order);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const input = req.body as UpdateOrderStatusInput;

    if (!parseStatus(input.status)) {
      return errorResponse(res, 'status is required', 400);
    }

    const order = await orderService.updateOrderStatus(req.params.id as string, input);
    return ok(res, order);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const updateOrderShipping = async (req: Request, res: Response) => {
  try {
    const body = req.body as UpdateOrderShippingInput & { estimatedDeliveryDate?: string | Date | null };
    const order = await orderService.updateOrderShipping(req.params.id as string, {
      provider: body.provider,
      trackingCode: body.trackingCode,
      labelUrl: body.labelUrl,
      estimatedDeliveryDate: body.estimatedDeliveryDate
        ? new Date(body.estimatedDeliveryDate)
        : body.estimatedDeliveryDate,
    });

    return ok(res, order);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

export {
  cancelOrder,
  createOrder,
  getMyOrders,
  getOrderById,
  getOrders,
  updateOrderShipping,
  updateOrderStatus,
};
