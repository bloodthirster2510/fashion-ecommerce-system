import crypto from 'crypto';
import { DistributedLock, Transaction } from '../../database/models';

const DEFAULT_PAYMENT_EXPIRY_GRACE_MS = 5 * 60 * 1000;
const DEFAULT_PAYMENT_EXPIRY_LOCK_TTL_MS = 5 * 60 * 1000;
const PAYMENT_EXPIRY_LOCK_NAME = 'payment-expiry';

export type ExpireStaleTransactionsResult = {
  expiredCount: number;
  orderIds: string[];
  // Kept for API compatibility. Payment-attempt expiry no longer cancels orders.
  cancelledOrderIds: string[];
  transactions: Array<{
    id: string;
    orderId: string;
    txnRef?: string | null;
    attemptNo?: number | null;
    expiredAt?: Date | null;
  }>;
  lockSkipped?: boolean;
};

const getPaymentExpiryGraceMs = () => {
  const configuredGraceMs = Number(process.env.PAYMENT_EXPIRY_GRACE_MS);
  return Number.isFinite(configuredGraceMs) && configuredGraceMs >= 0
    ? configuredGraceMs
    : DEFAULT_PAYMENT_EXPIRY_GRACE_MS;
};

const getPaymentExpiryLockTtlMs = () => {
  const configuredTtlMs = Number(process.env.PAYMENT_EXPIRY_LOCK_TTL_MS);
  return Number.isFinite(configuredTtlMs) && configuredTtlMs >= 10_000
    ? configuredTtlMs
    : DEFAULT_PAYMENT_EXPIRY_LOCK_TTL_MS;
};

const createEmptyExpiryResult = (lockSkipped = false): ExpireStaleTransactionsResult => ({
  expiredCount: 0,
  orderIds: [],
  cancelledOrderIds: [],
  transactions: [],
  ...(lockSkipped ? { lockSkipped: true } : {}),
});

const isDuplicateKeyError = (error: unknown) => Boolean(
  error && typeof error === 'object' && 'code' in error &&
  (error as { code?: unknown }).code === 11000,
);

const acquirePaymentExpiryLock = async (now: Date) => {
  const ownerId = `${process.pid}:${crypto.randomUUID()}`;
  const expiresAt = new Date(now.getTime() + getPaymentExpiryLockTtlMs());

  try {
    const result = await DistributedLock.updateOne(
      {
        name: PAYMENT_EXPIRY_LOCK_NAME,
        $or: [{ expiresAt: { $lte: now } }, { ownerId }],
      },
      {
        $set: { ownerId, expiresAt },
        $setOnInsert: { name: PAYMENT_EXPIRY_LOCK_NAME },
      },
      { upsert: true },
    );
    return result.upsertedCount > 0 || result.modifiedCount > 0 ? ownerId : null;
  } catch (error) {
    if (isDuplicateKeyError(error)) return null;
    throw error;
  }
};

const releasePaymentExpiryLock = (ownerId: string) =>
  DistributedLock.deleteOne({ name: PAYMENT_EXPIRY_LOCK_NAME, ownerId });

export const paymentExpiryService = {
  expireStaleTransactions: async (now = new Date()): Promise<ExpireStaleTransactionsResult> => {
    const expiryCutoff = new Date(now.getTime() - getPaymentExpiryGraceMs());
    const staleTransactions = await Transaction.find({
      status: 'pending',
      expiredAt: { $lte: expiryCutoff },
    })
      .select('_id order_id txnRef attemptNo expiredAt')
      .lean();

    if (!staleTransactions.length) return createEmptyExpiryResult();

    const transactionIds = staleTransactions.map((transaction) => transaction._id);
    const orderIds = Array.from(new Set(
      staleTransactions.map((transaction) => transaction.order_id.toString()),
    ));
    const result = await Transaction.updateMany(
      { _id: { $in: transactionIds }, status: 'pending' },
      { $set: { status: 'expired', resolvedAt: now, failureReason: 'expired' } },
    );

    return {
      expiredCount: result.modifiedCount,
      orderIds,
      cancelledOrderIds: [],
      transactions: staleTransactions.map((transaction) => ({
        id: transaction._id.toString(),
        orderId: transaction.order_id.toString(),
        txnRef: transaction.txnRef ?? null,
        attemptNo: transaction.attemptNo ?? null,
        expiredAt: transaction.expiredAt ?? null,
      })),
    };
  },

  expireStaleTransactionsWithLock: async (now = new Date()): Promise<ExpireStaleTransactionsResult> => {
    const ownerId = await acquirePaymentExpiryLock(now);
    if (!ownerId) return createEmptyExpiryResult(true);

    try {
      return await paymentExpiryService.expireStaleTransactions(now);
    } finally {
      await releasePaymentExpiryLock(ownerId);
    }
  },
};
