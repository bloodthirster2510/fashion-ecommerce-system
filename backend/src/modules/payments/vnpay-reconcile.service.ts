import crypto from 'crypto';
import { DistributedLock, Order, Transaction, type ITransaction } from '../../database/models';
import { formatVNPayDate } from '../../utils/vnpay.util';
import { SalesServiceError } from '../sales/sales.helpers';
import { orderService } from '../orders/order.service';
import { settleVNPayPayment } from './payments.controller';
import { getVNPayServerIp, queryVNPayTransaction } from './payments.service';
import { transactionService } from './transaction.service';

const LOCK_NAME = 'vnpay-reconcile';
const DEFAULT_STALE_MINUTES = 20;
const DEFAULT_RETRY_MINUTES = 15;
const DEFAULT_BATCH_SIZE = 25;
const DEFAULT_LOCK_TTL_MS = 10 * 60 * 1000;

const readNumberEnv = (name: string, fallback: number, minimum: number, maximum = Number.MAX_SAFE_INTEGER) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= minimum
    ? Math.min(Math.floor(value), maximum)
    : fallback;
};

const readString = (value: unknown) => typeof value === 'string' && value.trim()
  ? value.trim()
  : null;

const getTransactionDate = (transaction: ITransaction) => (
  readString(transaction.paymentDetail?.vnp_CreateDate) || formatVNPayDate(transaction.createdAt)
);

const isDuplicateKeyError = (error: unknown) => Boolean(
  error && typeof error === 'object' && 'code' in error &&
  (error as { code?: unknown }).code === 11000,
);

const acquireLock = async (now: Date) => {
  const ownerId = `${process.pid}:${crypto.randomUUID()}`;
  const ttlMs = readNumberEnv('VNPAY_RECONCILE_LOCK_TTL_MS', DEFAULT_LOCK_TTL_MS, 60_000);
  try {
    const result = await DistributedLock.updateOne(
      { name: LOCK_NAME, $or: [{ expiresAt: { $lte: now } }, { ownerId }] },
      {
        $set: { ownerId, expiresAt: new Date(now.getTime() + ttlMs) },
        $setOnInsert: { name: LOCK_NAME },
      },
      { upsert: true },
    );
    return result.upsertedCount > 0 || result.modifiedCount > 0 ? ownerId : null;
  } catch (error) {
    if (isDuplicateKeyError(error)) return null;
    throw error;
  }
};

const releaseLock = (ownerId: string) => DistributedLock.deleteOne({ name: LOCK_NAME, ownerId });

const reconcileTransaction = async (transaction: ITransaction, ipAddr = getVNPayServerIp()) => {
  const isRefundAttempt = transaction.paymentDetail?.vnp_Command === 'refund';
  const originalPayment = isRefundAttempt
    ? await transactionService.findLatestSuccessfulByOrderId(transaction.order_id.toString())
    : null;
  const originalTxnRef = readString(transaction.paymentDetail?.vnp_OriginalTxnRef);
  const txnRef = (transaction.txnRef?.trim() || originalTxnRef)?.toUpperCase();
  if (!txnRef) {
    throw new SalesServiceError('VNPay transaction reference is missing', 409);
  }

  if (isRefundAttempt && !originalPayment) {
    throw new SalesServiceError('Original VNPay payment transaction not found', 409);
  }

  const querySource = originalPayment ?? transaction;

  const response = await queryVNPayTransaction({
    txnRef,
    transactionDate: getTransactionDate(querySource),
    transactionNo: querySource.gatewayTransactionId ?? null,
    ipAddr,
  });
  const queriedAt = new Date();
  await transactionService.recordVNPayQueryResult({
    transactionId: transaction._id.toString(),
    queriedAt,
    response,
  });

  if (!response.isValidSignature) {
    // VNPay sandbox may omit vnp_SecureHash for duplicate QueryDr requests (code 94).
    // This branch is deliberately read-only: never infer a payment/refund result from it.
    if (response.vnp_ResponseCode === '94' && !response.vnp_SecureHash) {
      return {
        transaction,
        response,
        settlement: null,
        refundedOrder: null,
        reconciliationStatus: isRefundAttempt ? 'pending_refund' : 'unchanged',
        duplicateRequest: true,
      };
    }

    throw new SalesServiceError('Invalid VNPay QueryDr response signature', 502);
  }

  if (response.vnp_TxnRef?.toUpperCase() !== txnRef) {
    throw new SalesServiceError('VNPay QueryDr transaction reference mismatch', 502);
  }

  let settlement = null;
  let refundedOrder = null;
  if (response.vnp_ResponseCode === '00' && response.vnp_TransactionStatus === '00') {
    const amount = Number(response.vnp_Amount) / 100;
    if (response.vnp_TransactionType === '02') {
      const order = await Order.findById(transaction.order_id).lean();
      if (!order || !Number.isFinite(amount) || Math.round(amount) !== Math.round(order.totalAmount)) {
        throw new SalesServiceError('VNPay full refund amount does not match the order total', 502);
      }

      const refundTransaction = await transactionService.findLatestVNPayRefundByOrderId(
        transaction.order_id.toString(),
      );
      if (refundTransaction?.status === 'pending') {
        await transactionService.resolveVNPayRefundTransaction({
          transactionId: refundTransaction._id.toString(),
          response,
        });
      }
      refundedOrder = await orderService.markVNPayRefundCompleted(transaction.order_id.toString());
    } else if (!isRefundAttempt && response.vnp_TransactionType !== '03') {
      settlement = await settleVNPayPayment({
        isValidSignature: true,
        isSuccess: true,
        orderId: response.vnp_TxnRef,
        amount,
        responseCode: response.vnp_ResponseCode,
        transactionStatus: response.vnp_TransactionStatus,
        transactionNo: response.vnp_TransactionNo ?? '',
        bankCode: response.vnp_BankCode ?? '',
        payDate: response.vnp_PayDate ?? '',
      });
    }
  }

  const reconciliationStatus = refundedOrder
    ? 'refunded'
    : settlement?.paymentStatus === 'paid'
      ? 'paid'
      : isRefundAttempt
        ? 'pending_refund'
        : 'unchanged';

  return { transaction, response, settlement, refundedOrder, reconciliationStatus };
};

const reconcileOrder = async (orderId: string, ipAddr = getVNPayServerIp()) => {
  const order = await Order.findById(orderId).lean();
  if (!order || order.paymentMethod !== 'VNPAY') {
    throw new SalesServiceError('VNPay order not found', 404);
  }

  const latestRefund = order.paymentStatus === 'paid'
    ? await transactionService.findLatestVNPayRefundByOrderId(orderId)
    : null;
  const transaction = latestRefund?.status === 'pending'
    ? latestRefund
    : order.paymentStatus === 'paid' || order.paymentStatus === 'refunded'
      ? await transactionService.findLatestSuccessfulByOrderId(orderId)
      : await transactionService.findLatestAttemptByOrderId(orderId);
  if (!transaction) {
    throw new SalesServiceError('VNPay transaction not found', 404);
  }

  return reconcileTransaction(transaction, ipAddr);
};

const reconcileStaleTransactions = async (now = new Date()) => {
  const staleMinutes = readNumberEnv('VNPAY_RECONCILE_STALE_MINUTES', DEFAULT_STALE_MINUTES, 5);
  const retryMinutes = readNumberEnv('VNPAY_RECONCILE_RETRY_MINUTES', DEFAULT_RETRY_MINUTES, 5);
  const batchSize = readNumberEnv('VNPAY_RECONCILE_BATCH_SIZE', DEFAULT_BATCH_SIZE, 1, 100);
  const staleBefore = new Date(now.getTime() - staleMinutes * 60_000);
  const retryBefore = new Date(now.getTime() - retryMinutes * 60_000);
  const transactions = await Transaction.find({
    status: { $in: ['pending', 'expired'] },
    gatewayProvider: 'vnpay',
    createdAt: { $lte: staleBefore },
    $and: [
      {
        $or: [
          { txnRef: { $type: 'string', $ne: '' } },
          {
            'paymentDetail.vnp_Command': 'refund',
            'paymentDetail.vnp_OriginalTxnRef': { $type: 'string', $ne: '' },
          },
        ],
      },
      {
        $or: [
          { 'paymentDetail.vnp_LastQueryAt': { $exists: false } },
          { 'paymentDetail.vnp_LastQueryAt': { $lte: retryBefore } },
        ],
      },
    ],
  })
    .sort({ createdAt: 1 })
    .limit(batchSize);

  const result = {
    processedCount: 0,
    updatedCount: 0,
    failedCount: 0,
    transactionIds: [] as string[],
    failures: [] as Array<{ transactionId: string; message: string }>,
    lockSkipped: false,
  };

  for (const transaction of transactions) {
    const transactionId = transaction._id.toString();
    result.transactionIds.push(transactionId);
    try {
      const reconciliation = await reconcileTransaction(transaction);
      result.processedCount += 1;
      if (reconciliation.settlement?.paymentStatus === 'paid' || reconciliation.refundedOrder) {
        result.updatedCount += 1;
      }
    } catch (error) {
      result.processedCount += 1;
      result.failures.push({
        transactionId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  result.failedCount = result.failures.length;
  return result;
};

const reconcileStaleTransactionsWithLock = async (now = new Date()) => {
  const ownerId = await acquireLock(now);
  if (!ownerId) {
    return {
      processedCount: 0,
      updatedCount: 0,
      failedCount: 0,
      transactionIds: [],
      failures: [],
      lockSkipped: true,
    };
  }

  try {
    return await reconcileStaleTransactions(now);
  } finally {
    await releaseLock(ownerId);
  }
};

export const vnpayReconcileService = {
  reconcileOrder,
  reconcileStaleTransactions,
  reconcileStaleTransactionsWithLock,
};
