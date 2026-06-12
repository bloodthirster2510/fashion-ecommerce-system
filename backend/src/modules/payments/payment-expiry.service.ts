import { Transaction } from '../../database/models';

export type ExpireStaleTransactionsResult = {
  expiredCount: number;
  orderIds: string[];
  transactions: Array<{
    id: string;
    orderId: string;
    txnRef?: string | null;
    attemptNo?: number | null;
    expiredAt?: Date | null;
  }>;
};

export const paymentExpiryService = {
  expireStaleTransactions: async (now = new Date()): Promise<ExpireStaleTransactionsResult> => {
    const staleTransactions = await Transaction.find({
      status: 'pending',
      expiredAt: { $lte: now },
    })
      .select('_id order_id txnRef attemptNo expiredAt')
      .lean();

    if (staleTransactions.length === 0) {
      return {
        expiredCount: 0,
        orderIds: [],
        transactions: [],
      };
    }

    const transactionIds = staleTransactions.map((transaction) => transaction._id);

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

    return {
      expiredCount: result.modifiedCount,
      orderIds: Array.from(new Set(staleTransactions.map((transaction) => transaction.order_id.toString()))),
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
