import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { error, ok, serverError } from '../../utils/response';
import { formatVNPayDate } from '../../utils/vnpay.util';
import { auditLogService } from '../audit-logs/audit-log.service';
import { orderService } from '../orders/order.service';
import { getVNPayServerIp, refundVNPayTransaction } from './payments.service';
import { transactionService } from './transaction.service';
import { vnpayReconcileService } from './vnpay-reconcile.service';

const getErrorMessage = (value: unknown) => value instanceof Error
  ? value.message
  : 'Internal Server Error';

const getErrorStatus = (value: unknown) => (
  typeof value === 'object' && value !== null && 'statusCode' in value &&
  typeof value.statusCode === 'number'
    ? value.statusCode
    : 500
);

const getTransactionDate = (transaction: {
  createdAt: Date;
  paymentDetail?: Record<string, unknown> | null;
}) => {
  const stored = transaction.paymentDetail?.vnp_CreateDate;
  return typeof stored === 'string' && /^\d{14}$/.test(stored)
    ? stored
    : formatVNPayDate(transaction.createdAt);
};

export const reconcileVNPayOrder = async (req: Request, res: Response) => {
  const orderId = req.params.orderId as string;
  if (!Types.ObjectId.isValid(orderId)) return error(res, 'Invalid orderId', 400);

  try {
    const result = await vnpayReconcileService.reconcileOrder(orderId, getVNPayServerIp());
    await auditLogService.recordAuditLogBestEffort({
      actorId: req.user?.userId ?? null,
      actorRole: req.user?.role === 'admin' ? 'admin' : 'staff',
      action: 'payment.vnpay_reconcile',
      targetType: 'Order',
      targetId: orderId,
      reason: 'Manual VNPay QueryDr reconciliation',
      after: {
        responseCode: result.response.vnp_ResponseCode ?? null,
        transactionStatus: result.response.vnp_TransactionStatus ?? null,
        transactionType: result.response.vnp_TransactionType ?? null,
        reconciliationStatus: result.reconciliationStatus,
        paymentStatus: result.settlement?.paymentStatus ?? result.refundedOrder?.paymentStatus ?? null,
      },
      metadata: {
        transactionId: result.transaction._id.toString(),
        txnRef: result.transaction.txnRef ?? null,
      },
    });

    return ok(res, {
      gateway: result.response,
      settlement: result.settlement,
      order: result.refundedOrder,
      reconciliationStatus: result.reconciliationStatus,
    }, 'Reconciled VNPay transaction');
  } catch (value) {
    const status = getErrorStatus(value);
    return status === 500
      ? serverError(res, getErrorMessage(value))
      : error(res, getErrorMessage(value), status);
  }
};

export const refundVNPayOrder = async (req: Request, res: Response) => {
  const orderId = req.params.orderId as string;
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (!Types.ObjectId.isValid(orderId)) return error(res, 'Invalid orderId', 400);
  if (reason.length < 5) return error(res, 'Refund reason must be at least 5 characters', 400);

  try {
    const order = await orderService.getOrderById(req.user!.userId, req.user?.role, orderId);
    if (order.paymentMethod !== 'VNPAY' || order.paymentStatus !== 'paid') {
      return error(res, 'Only paid VNPay orders can be refunded through VNPay', 409);
    }
    if (!['cancelled', 'returned'].includes(order.status)) {
      return error(res, 'Order must be cancelled or returned before refund', 409);
    }

    const existingRefund = await transactionService.findLatestVNPayRefundByOrderId(orderId);
    if (existingRefund?.status === 'pending') {
      return error(res, 'A VNPay refund is already being processed; reconcile it before retrying', 409);
    }
    if (existingRefund?.status === 'success') {
      return error(res, 'VNPay refund was already completed', 409);
    }

    const paymentTransaction = await transactionService.findLatestSuccessfulByOrderId(orderId);
    const txnRef = paymentTransaction?.txnRef?.trim().toUpperCase();
    if (!paymentTransaction || !txnRef) {
      return error(res, 'Successful VNPay payment transaction not found', 409);
    }

    const gateway = await refundVNPayTransaction({
      txnRef,
      transactionDate: getTransactionDate(paymentTransaction),
      transactionNo: paymentTransaction.gatewayTransactionId ?? null,
      amount: order.totalAmount,
      createdBy: req.user!.userId,
      ipAddr: getVNPayServerIp(),
    });
    if (!gateway.isValidSignature) {
      return error(res, 'Invalid VNPay refund response signature', 502);
    }
    if (gateway.vnp_TxnRef?.toUpperCase() !== txnRef) {
      return error(res, 'VNPay refund transaction reference mismatch', 502);
    }
    if (gateway.vnp_ResponseCode === '00' && gateway.vnp_TransactionType !== '02') {
      return error(res, 'VNPay full refund transaction type mismatch', 502);
    }

    const gatewayAmount = Number(gateway.vnp_Amount) / 100;
    if (gateway.vnp_ResponseCode === '00' && (
      !Number.isFinite(gatewayAmount) || Math.round(gatewayAmount) !== Math.round(order.totalAmount)
    )) {
      return error(res, 'VNPay refund amount mismatch', 502);
    }

    const refundTransaction = await transactionService.createVNPayRefundTransaction({
      userId: order.user_id.toString(),
      orderId,
      amount: order.totalAmount,
      actorId: req.user!.userId,
      reason,
      originalTxnRef: txnRef,
      response: gateway,
    });
    const completed = gateway.vnp_ResponseCode === '00' &&
      gateway.vnp_TransactionStatus === '00' &&
      gateway.vnp_TransactionType === '02';
    const updatedOrder = completed
      ? await orderService.markVNPayRefundCompleted(orderId)
      : order;

    await auditLogService.recordAuditLogBestEffort({
      actorId: req.user?.userId ?? null,
      actorRole: req.user?.role === 'admin' ? 'admin' : 'staff',
      action: 'payment.vnpay_refund',
      targetType: 'Order',
      targetId: orderId,
      reason,
      before: { paymentStatus: order.paymentStatus },
      after: {
        paymentStatus: updatedOrder.paymentStatus,
        gatewayResponseCode: gateway.vnp_ResponseCode ?? null,
        gatewayTransactionStatus: gateway.vnp_TransactionStatus ?? null,
      },
      metadata: {
        paymentTransactionId: paymentTransaction._id.toString(),
        refundTransactionId: refundTransaction._id.toString(),
        txnRef,
      },
    });

    return ok(res, {
      order: updatedOrder,
      refundTransaction,
      gateway,
      refundStatus: completed ? 'completed' : refundTransaction.status,
    }, completed ? 'VNPay refund completed' : 'VNPay refund request submitted');
  } catch (value) {
    const status = getErrorStatus(value);
    return status === 500
      ? serverError(res, getErrorMessage(value))
      : error(res, getErrorMessage(value), status);
  }
};
