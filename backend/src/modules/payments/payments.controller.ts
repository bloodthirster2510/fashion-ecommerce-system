import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { Order, type OrderPaymentStatus, type TransactionStatus } from '../../database/models';
import { error, ok, serverError } from '../../utils/response';
import { auditLogService } from '../audit-logs/audit-log.service';
import {
  createVNPayPaymentUrl,
  verifyVNPayResponse,
} from './payments.service';
import { paymentExpiryService } from './payment-expiry.service';
import { transactionService } from './transaction.service';

const getErrorMessage = (err: unknown) =>
  err instanceof Error ? err.message : 'Internal Server Error';

const normalizeClientIp = (ip?: string) => {
  if (!ip || ip === '::1') {
    return '127.0.0.1';
  }

  const normalizedIp = ip.startsWith('::ffff:') ? ip.replace('::ffff:', '') : ip;
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;

  return ipv4Regex.test(normalizedIp) ? normalizedIp : '127.0.0.1';
};

const isValidVNPayTransactionRef = (txnRef: string) => /^[A-Za-z0-9]{1,100}$/.test(txnRef);

const getClientIp = (req: Request) => {
  const rawIpAddr =
    req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    '127.0.0.1';
  return normalizeClientIp(rawIpAddr);
};

const canCreatePaymentForOrderStatus = (status: string) =>
  !['cancelled', 'returned'].includes(status);

const ADMIN_PAYMENT_STATUSES: OrderPaymentStatus[] = ['pending', 'paid', 'failed', 'refunded'];

const parseAdminPaymentStatus = (value: unknown) => {
  const status = typeof value === 'string' ? value : '';

  if (!ADMIN_PAYMENT_STATUSES.includes(status as OrderPaymentStatus)) {
    return null;
  }

  return status as OrderPaymentStatus;
};

const parseAdminReason = (value: unknown) => {
  const reason = typeof value === 'string' ? value.trim() : '';
  return reason.length >= 5 ? reason : null;
};

const toManualTransactionStatus = (paymentStatus: OrderPaymentStatus) => {
  if (paymentStatus === 'paid') return 'success' as const;
  if (paymentStatus === 'pending') return 'pending' as const;
  return 'failed' as const;
};

type VNPayResponseResult = ReturnType<typeof verifyVNPayResponse>;

type VNPaySettlementResult = {
  rspCode: '00' | '01' | '02' | '04' | '97';
  message: string;
  orderId?: string;
  orderCode?: string;
  transactionId?: string;
  transactionStatus?: TransactionStatus;
  paymentStatus?: OrderPaymentStatus;
};

const settleVNPayPayment = async (result: VNPayResponseResult): Promise<VNPaySettlementResult> => {
  if (!result.isValidSignature) {
    return { rspCode: '97', message: 'Invalid signature' };
  }

  const txnRef = String(result.orderId || '').toUpperCase();
  if (!txnRef) {
    return { rspCode: '01', message: 'Order not found' };
  }

  let transaction = await transactionService.findByTxnRef(txnRef);
  let order = transaction
    ? await Order.findById(transaction.order_id).lean()
    : null;

  if (!transaction || !order) {
    order = await Order.findOne({ orderCode: txnRef }).lean();
    transaction = order
      ? await transactionService.findPendingByOrderId(order._id.toString())
      : null;
  }

  if (!order) {
    return { rspCode: '01', message: 'Order not found' };
  }

  const orderId = order._id.toString();

  if (!transaction) {
    const latest = await transactionService.findLatestByOrderId(orderId);
    if (latest?.status === 'success') {
      return {
        rspCode: '02',
        message: 'Order already confirmed',
        orderId,
        orderCode: order.orderCode,
        transactionId: latest._id.toString(),
        transactionStatus: latest.status,
        paymentStatus: 'paid',
      };
    }

    return {
      rspCode: '01',
      message: 'Transaction not found',
      orderId,
      orderCode: order.orderCode,
      transactionId: latest?._id.toString(),
      transactionStatus: latest?.status,
      paymentStatus: order.paymentStatus,
    };
  }

  if (transaction.status !== 'pending') {
    return {
      rspCode: transaction.status === 'success' ? '02' : '00',
      message: 'Transaction already resolved',
      orderId,
      orderCode: order.orderCode,
      transactionId: transaction._id.toString(),
      transactionStatus: transaction.status,
      paymentStatus: transaction.status === 'success' ? 'paid' : order.paymentStatus,
    };
  }

  const callbackAmount = result.amount;
  if (callbackAmount !== undefined && Math.round(callbackAmount) !== Math.round(transaction.amount)) {
    return {
      rspCode: '04',
      message: 'Invalid amount',
      orderId,
      orderCode: order.orderCode,
      transactionId: transaction._id.toString(),
      transactionStatus: transaction.status,
      paymentStatus: order.paymentStatus,
    };
  }

  const isSuccess = result.isSuccess;
  const newStatus: TransactionStatus = isSuccess ? 'success' : 'failed';

  const resolvedTransaction = await transactionService.resolveTransaction({
    transactionId: transaction._id.toString(),
    status: newStatus,
    gatewayTransactionId: result.transactionNo ? String(result.transactionNo) : null,
    failureReason: isSuccess ? null : `VNPay response ${result.responseCode || 'unknown'}`,
    paymentDetail: {
      vnp_ResponseCode: result.responseCode,
      vnp_TransactionStatus: result.transactionStatus,
      vnp_TransactionNo: result.transactionNo,
      vnp_BankCode: result.bankCode,
      vnp_PayDate: result.payDate,
      vnp_Amount: callbackAmount,
    },
  });

  if (!resolvedTransaction) {
    return {
      rspCode: '00',
      message: 'Transaction already resolved',
      orderId,
      orderCode: order.orderCode,
      transactionId: transaction._id.toString(),
      paymentStatus: order.paymentStatus,
    };
  }

  const latest = await transactionService.findLatestAttemptByOrderId(orderId);
  const isLatestAttempt = latest?._id.toString() === resolvedTransaction._id.toString();
  let paymentStatus = order.paymentStatus;

  if (isSuccess || isLatestAttempt) {
    paymentStatus = isSuccess ? 'paid' : 'failed';
    await Order.updateOne(
      { _id: order._id },
      { $set: { paymentStatus } },
    );
  }

  return {
    rspCode: '00',
    message: isSuccess ? 'Confirm success' : 'Confirm failed payment',
    orderId,
    orderCode: order.orderCode,
    transactionId: resolvedTransaction._id.toString(),
    transactionStatus: resolvedTransaction.status,
    paymentStatus,
  };
};

export const createVNPayUrl = async (req: Request, res: Response) => {
  try {
    const { orderId, amount, bankCode, locale } = req.body;
    const transactionRef = String(orderId || '');
    const parsedAmount = Number(amount);

    if (!transactionRef || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return error(res, 'orderId and a positive amount are required');
    }

    if (!isValidVNPayTransactionRef(transactionRef)) {
      return error(res, 'orderId must be alphanumeric and at most 100 characters');
    }

    const paymentUrl = createVNPayPaymentUrl({
      orderId: transactionRef,
      amount: parsedAmount,
      ipAddr: getClientIp(req),
      bankCode: bankCode ? String(bankCode) : undefined,
      locale: locale ? String(locale) : undefined,
    });

    return ok(res, { paymentUrl }, 'Created VNPay payment URL');
  } catch (err: unknown) {
    return serverError(res, getErrorMessage(err));
  }
};

export const createVNPayUrlFromOrder = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const orderId = req.params.orderId as string;
    const { bankCode, locale } = req.body as { bankCode?: string; locale?: string };

    if (!Types.ObjectId.isValid(orderId)) {
      return error(res, 'Invalid orderId', 400);
    }

    const order = await Order.findById(orderId).lean();
    if (!order || order.user_id.toString() !== userId) {
      return error(res, 'Order not found', 404);
    }

    if (order.paymentMethod !== 'VNPAY') {
      return error(res, 'This order does not use VNPay', 400);
    }

    if (order.paymentStatus === 'paid') {
      return error(res, 'Order is already paid', 409);
    }

    if (!canCreatePaymentForOrderStatus(order.status)) {
      return error(res, 'Order cannot create a new payment URL', 400);
    }

    const transaction = await transactionService.ensureVNPayAttemptForOrder({
      userId,
      orderId,
      orderCode: order.orderCode,
      amount: order.totalAmount,
      paymentMethodId: order.paymentMethodId?.toString() ?? null,
    });

    if (!transaction?.txnRef) {
      return error(res, 'Cannot create payment attempt', 500);
    }

    const txnRef = transaction.txnRef;
    if (!isValidVNPayTransactionRef(txnRef)) {
      return error(res, `Invalid VNPay txnRef "${txnRef}"`, 500);
    }

    const paymentUrl = createVNPayPaymentUrl({
      orderId: txnRef,
      amount: order.totalAmount,
      ipAddr: getClientIp(req),
      bankCode: bankCode || undefined,
      locale: locale || 'vn',
    });

    return ok(res, {
      paymentUrl,
      transactionId: transaction._id.toString(),
      txnRef,
      attemptNo: transaction.attemptNo ?? 1,
      expiredAt: transaction.expiredAt ?? null,
      orderCode: order.orderCode,
      amount: order.totalAmount,
    }, 'Created VNPay payment URL from order');
  } catch (err: unknown) {
    return serverError(res, getErrorMessage(err));
  }
};

export const getOrderPaymentStatus = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const orderId = req.params.orderId as string;

    if (!Types.ObjectId.isValid(orderId)) {
      return error(res, 'Invalid orderId', 400);
    }

    const order = await Order.findById(orderId).lean();
    if (!order || order.user_id.toString() !== userId) {
      return error(res, 'Order not found', 404);
    }

    const latestTransaction = await transactionService.findLatestAttemptByOrderId(orderId);
    const canPayNow =
      order.paymentMethod === 'VNPAY' &&
      order.paymentStatus !== 'paid' &&
      order.paymentStatus !== 'refunded' &&
      canCreatePaymentForOrderStatus(order.status);

    return ok(res, {
      orderId: order._id.toString(),
      orderCode: order.orderCode,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      canPayNow,
      latestTransaction: latestTransaction
        ? {
          id: latestTransaction._id.toString(),
          txnRef: latestTransaction.txnRef ?? null,
          attemptNo: latestTransaction.attemptNo ?? null,
          status: latestTransaction.status,
          expiredAt: latestTransaction.expiredAt ?? null,
          resolvedAt: latestTransaction.resolvedAt ?? null,
          failureReason: latestTransaction.failureReason ?? null,
        }
        : null,
    }, 'Fetched payment status');
  } catch (err: unknown) {
    return serverError(res, getErrorMessage(err));
  }
};

export const expireStalePaymentAttempts = async (_req: Request, res: Response) => {
  try {
    const result = await paymentExpiryService.expireStaleTransactions();

    return ok(res, {
      ...result,
      policy: 'Expired attempts are marked expired. Orders remain payment pending and can create a new payment URL.',
    }, 'Expired stale payment attempts');
  } catch (err: unknown) {
    return serverError(res, getErrorMessage(err));
  }
};

export const adjustOrderPaymentStatus = async (req: Request, res: Response) => {
  try {
    const orderId = req.params.orderId as string;
    const paymentStatus = parseAdminPaymentStatus((req.body as { paymentStatus?: unknown }).paymentStatus);
    const reason = parseAdminReason((req.body as { reason?: unknown }).reason);

    if (!Types.ObjectId.isValid(orderId)) {
      return error(res, 'Invalid orderId', 400);
    }

    if (!paymentStatus) {
      return error(res, 'Invalid payment status', 400);
    }

    if (!reason) {
      return error(res, 'Reason is required and must be at least 5 characters', 400);
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return error(res, 'Order not found', 404);
    }

    const before = {
      paymentStatus: order.paymentStatus,
      status: order.status,
    };

    if (order.paymentStatus === paymentStatus) {
      return ok(res, order, 'Payment status already set');
    }

    order.paymentStatus = paymentStatus;
    const updatedOrder = await order.save();

    await transactionService.createManualAdjustmentTransaction({
      userId: order.user_id.toString(),
      orderId: order._id.toString(),
      amount: order.totalAmount,
      paymentMethod: order.paymentMethod,
      paymentMethodId: order.paymentMethodId?.toString() ?? null,
      status: toManualTransactionStatus(paymentStatus),
      reason,
      actorId: req.user!.userId,
    });

    await auditLogService.recordAuditLogBestEffort({
      actorId: req.user?.userId ?? null,
      actorRole: req.user?.role === 'admin' ? 'admin' : 'staff',
      action: 'payment.adjust',
      targetType: 'Order',
      targetId: order._id.toString(),
      reason,
      before,
      after: {
        paymentStatus: updatedOrder.paymentStatus,
        status: updatedOrder.status,
      },
      metadata: {
        orderCode: updatedOrder.orderCode,
        paymentMethod: updatedOrder.paymentMethod,
      },
    });

    return ok(res, updatedOrder, 'Adjusted order payment status');
  } catch (err: unknown) {
    return serverError(res, getErrorMessage(err));
  }
};

const buildMobileReturnUrl = async (
  result: VNPayResponseResult,
  settledOrderId?: string | null,
) => {
  const mobileReturnUrl = process.env.VNPAY_MOBILE_RETURN_URL?.trim();
  if (!mobileReturnUrl) {
    return null;
  }

  const txnRef = String(result.orderId || '').toUpperCase();
  let orderId: string | null = settledOrderId ?? null;

  if (!orderId && txnRef) {
    const transaction = await transactionService.findByTxnRef(txnRef);
    if (transaction) {
      orderId = transaction.order_id.toString();
    }
  }

  if (!orderId && txnRef) {
    const order = await Order.findOne({ orderCode: txnRef }).select('_id').lean();
    orderId = order?._id.toString() ?? null;
  }

  const url = new URL(mobileReturnUrl);
  if (orderId) {
    url.searchParams.set('orderId', orderId);
  }
  url.searchParams.set('paymentStatus', result.isValidSignature && result.isSuccess ? 'paid' : 'pending');
  url.searchParams.set('responseCode', String(result.responseCode ?? ''));
  url.searchParams.set('txnRef', txnRef);

  return url.toString();
};

export const handleVNPayReturn = async (req: Request, res: Response) => {
  try {
    const result = verifyVNPayResponse(req.query);
    const settlement = await settleVNPayPayment(result);
    const mobileReturnUrl = await buildMobileReturnUrl(result, settlement.orderId ?? null);

    if (mobileReturnUrl) {
      return res.redirect(mobileReturnUrl);
    }

    return ok(res, { ...result, settlement }, 'Verified VNPay return');
  } catch (err: unknown) {
    return serverError(res, getErrorMessage(err));
  }
};

export const handleVNPayIpn = async (req: Request, res: Response) => {
  try {
    const result = verifyVNPayResponse(req.query);
    const settlement = await settleVNPayPayment(result);

    return res.status(200).json({
      RspCode: settlement.rspCode,
      Message: settlement.message,
    });
  } catch (err: unknown) {
    return res.status(200).json({ RspCode: '99', Message: getErrorMessage(err) });
  }
};
