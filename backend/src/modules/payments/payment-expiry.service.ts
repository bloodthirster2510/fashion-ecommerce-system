import { Inventory, Order, Product, Transaction } from '../../database/models';

const DEFAULT_PAYMENT_EXPIRY_GRACE_MS = 5 * 60 * 1000;

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
};

const ONLINE_PAYMENT_METHODS = ['VNPAY', 'MOMO', 'CARD', 'BANK'];

const getPaymentExpiryGraceMs = () => {
  const configuredGraceMs = Number(process.env.PAYMENT_EXPIRY_GRACE_MS);

  if (Number.isFinite(configuredGraceMs) && configuredGraceMs >= 0) {
    return configuredGraceMs;
  }

  return DEFAULT_PAYMENT_EXPIRY_GRACE_MS;
};

type ObjectIdLike = {
  toString: () => string;
};

type ExpirableOrder = {
  _id: ObjectIdLike;
  order_list: Array<{
    productId: unknown;
    variantId: unknown;
    colorVariantId: unknown;
    size: string;
    quantity: number;
  }>;
  status: string;
  paymentStatus: string;
  save: () => Promise<unknown>;
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

    const order = await Order.findOne({
      _id: latestTransaction.order_id,
      status: 'confirmed',
      paymentMethod: { $in: ONLINE_PAYMENT_METHODS },
      paymentStatus: { $in: ['pending', 'failed'] },
    });

    if (!order) {
      continue;
    }

    await restockCommittedOrder(order);
    order.status = 'cancelled';
    order.paymentStatus = 'failed';
    await order.save();
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
      return {
        expiredCount: 0,
        orderIds: [],
        cancelledOrderIds: [],
        transactions: [],
      };
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
};
