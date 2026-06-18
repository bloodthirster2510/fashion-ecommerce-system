import crypto from 'crypto';
import type { Types } from 'mongoose';
import { DistributedLock, Inventory, Order, Product, Transaction } from '../../database/models';
import { inventoryService } from '../inventory/inventory.service';

const DEFAULT_PAYMENT_EXPIRY_GRACE_MS = 5 * 60 * 1000;
const DEFAULT_PAYMENT_EXPIRY_LOCK_TTL_MS = 5 * 60 * 1000;
const PAYMENT_EXPIRY_LOCK_NAME = 'payment-expiry';

export type ExpireStaleTransactionsResult = {
  expiredCount: number;
  orderIds: string[];
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

const ONLINE_PAYMENT_METHODS = ['VNPAY', 'MOMO', 'CARD', 'BANK'];

const getPaymentExpiryGraceMs = () => {
  const configuredGraceMs = Number(process.env.PAYMENT_EXPIRY_GRACE_MS);

  if (Number.isFinite(configuredGraceMs) && configuredGraceMs >= 0) {
    return configuredGraceMs;
  }

  return DEFAULT_PAYMENT_EXPIRY_GRACE_MS;
};

const getPaymentExpiryLockTtlMs = () => {
  const configuredTtlMs = Number(process.env.PAYMENT_EXPIRY_LOCK_TTL_MS);

  if (Number.isFinite(configuredTtlMs) && configuredTtlMs >= 10_000) {
    return configuredTtlMs;
  }

  return DEFAULT_PAYMENT_EXPIRY_LOCK_TTL_MS;
};

const createEmptyExpiryResult = (lockSkipped = false): ExpireStaleTransactionsResult => ({
  expiredCount: 0,
  orderIds: [],
  cancelledOrderIds: [],
  transactions: [],
  ...(lockSkipped ? { lockSkipped: true } : {}),
});

const isDuplicateKeyError = (error: unknown) => (
  Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: unknown }).code === 11000,
  )
);

const acquirePaymentExpiryLock = async (now: Date) => {
  const ownerId = `${process.pid}:${crypto.randomUUID()}`;
  const expiresAt = new Date(now.getTime() + getPaymentExpiryLockTtlMs());

  try {
    const result = await DistributedLock.updateOne(
      {
        name: PAYMENT_EXPIRY_LOCK_NAME,
        $or: [
          { expiresAt: { $lte: now } },
          { ownerId },
        ],
      },
      {
        $set: {
          ownerId,
          expiresAt,
        },
        $setOnInsert: {
          name: PAYMENT_EXPIRY_LOCK_NAME,
        },
      },
      { upsert: true },
    );

    return result.upsertedCount > 0 || result.modifiedCount > 0 ? ownerId : null;
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return null;
    }

    throw error;
  }
};

const releasePaymentExpiryLock = async (ownerId: string) => {
  await DistributedLock.deleteOne({
    name: PAYMENT_EXPIRY_LOCK_NAME,
    ownerId,
  });
};

type ObjectIdLike = {
  toString: () => string;
};

type ExpirableOrder = {
  _id: ObjectIdLike;
  order_list: Array<{
    productId: Types.ObjectId;
    variantId: Types.ObjectId;
    colorVariantId: Types.ObjectId;
    size: string;
    quantity: number;
  }>;
  status: string;
  paymentStatus: string;
};

const restockCommittedOrder = async (order: ExpirableOrder) => {
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

  await inventoryService.restoreImportRemainingQuantities(
    order.order_list.map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      colorVariantId: item.colorVariantId,
      size: item.size,
      quantity: item.quantity,
    })),
  );
};

const cancelOrdersWhoseLatestAttemptExpired = async (
  orderIds: string[],
  expiredTransactionIds: Set<string>,
) => {
  const cancelledOrderIds: string[] = [];

  for (const orderId of orderIds) {
    const latestTransaction = await Transaction.findOne({ order_id: orderId })
      .sort({ attemptNo: -1, createdAt: -1 })
      .lean();

    if (
      !latestTransaction ||
      latestTransaction.status !== 'expired' ||
      !expiredTransactionIds.has(latestTransaction._id.toString())
    ) {
      continue;
    }

    const order = await Order.findOneAndUpdate(
      {
        _id: latestTransaction.order_id,
        status: 'confirmed',
        paymentMethod: { $in: ONLINE_PAYMENT_METHODS },
        paymentStatus: { $in: ['pending', 'failed'] },
      },
      {
        $set: {
          status: 'cancelled',
          paymentStatus: 'failed',
        },
      },
      {
        returnDocument: 'after',
      },
    );

    if (!order) {
      continue;
    }

    await restockCommittedOrder(order);
    cancelledOrderIds.push(order._id.toString());
  }

  return cancelledOrderIds;
};

export const paymentExpiryService = {
  expireStaleTransactions: async (now = new Date()): Promise<ExpireStaleTransactionsResult> => {
    const expiryCutoff = new Date(now.getTime() - getPaymentExpiryGraceMs());
    const staleTransactions = await Transaction.find({
      status: 'pending',
      expiredAt: { $lte: expiryCutoff },
    })
      .select('_id order_id txnRef attemptNo expiredAt')
      .lean();

    if (staleTransactions.length === 0) {
      return createEmptyExpiryResult();
    }

    const transactionIds = staleTransactions.map((transaction) => transaction._id);
    const expiredTransactionIds = new Set(transactionIds.map((id) => id.toString()));
    const orderIds = Array.from(new Set(staleTransactions.map((transaction) => transaction.order_id.toString())));

    const result = await Transaction.updateMany(
      {
        _id: { $in: transactionIds },
        status: 'pending',
      },
      {
        $set: {
          status: 'expired',
          resolvedAt: now,
          failureReason: 'expired',
        },
      },
    );
    const cancelledOrderIds = await cancelOrdersWhoseLatestAttemptExpired(orderIds, expiredTransactionIds);

    return {
      expiredCount: result.modifiedCount,
      orderIds,
      cancelledOrderIds,
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

    if (!ownerId) {
      return createEmptyExpiryResult(true);
    }

    try {
      return await paymentExpiryService.expireStaleTransactions(now);
    } finally {
      await releasePaymentExpiryLock(ownerId);
    }
  },
};
