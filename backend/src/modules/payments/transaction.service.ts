import { Types, type ClientSession } from 'mongoose';
import {
  Transaction,
  type TransactionStatus,
  type TransactionCreatedBy,
  type TransactionGatewayProvider,
  type TransactionPaymentMethod,
} from '../../database/models';

const PAYMENT_ATTEMPT_TTL_MS = 15 * 60 * 1000;

const isDuplicateKeyError = (error: unknown) => (
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: unknown }).code === 11000
);

const expirePendingAttemptsForOrder = async (
  orderId: string,
  excludeTransactionId?: Types.ObjectId | string | null,
) => {
  const filter: Record<string, unknown> = {
    order_id: new Types.ObjectId(orderId),
    status: 'pending',
  };

  if (excludeTransactionId) {
    filter._id = { $ne: new Types.ObjectId(excludeTransactionId.toString()) };
  }

  await Transaction.updateMany(
    filter,
    {
      $set: {
        status: 'expired',
        resolvedAt: new Date(),
        failureReason: 'superseded_by_new_attempt',
      },
    },
  );
};

export const transactionService = {
  /**
   * Tạo transaction pending cho đơn hàng online (VNPAY, MOMO, v.v.)
   */
  createPendingTransaction: async ({
    userId,
    orderId,
    amount,
    paymentMethod,
    gatewayProvider,
    paymentMethodId,
    txnRef,
    attemptNo,
    expiredAt,
    createdBy,
  }: {
    userId: string;
    orderId: string;
    amount: number;
    paymentMethod: TransactionPaymentMethod;
    gatewayProvider?: TransactionGatewayProvider;
    paymentMethodId?: string;
    txnRef?: string;
    attemptNo?: number;
    expiredAt?: Date;
    createdBy?: TransactionCreatedBy;
  }) => {
    const payload: Record<string, unknown> = {
      user_id: new Types.ObjectId(userId),
      order_id: new Types.ObjectId(orderId),
      amount,
      paymentMethod,
      gatewayProvider: gatewayProvider ?? null,
      paymentDetail: {},
      status: 'pending',
      createdBy: createdBy ?? 'user',
      expiredAt: expiredAt ?? new Date(Date.now() + PAYMENT_ATTEMPT_TTL_MS),
    };

    if (txnRef) payload.txnRef = txnRef;
    if (attemptNo) payload.attemptNo = attemptNo;
    if (paymentMethodId) payload.paymentMethodId = new Types.ObjectId(paymentMethodId);

    return Transaction.create(payload);
  },

  /**
   * Tìm transaction pending theo orderId — dùng cho create-payment-url
   */
  findPendingByOrderId: async (orderId: string) => {
    return Transaction.findOne({
      order_id: new Types.ObjectId(orderId),
      status: 'pending',
    }).sort({ createdAt: -1 });
  },

  findPendingWithoutTxnRefByOrderId: async (orderId: string) => {
    return Transaction.findOne({
      order_id: new Types.ObjectId(orderId),
      status: 'pending',
      $or: [{ txnRef: { $exists: false } }, { txnRef: null }, { txnRef: '' }],
    }).sort({ createdAt: 1 });
  },

  /**
   * Tìm transaction theo orderId (bất kỳ trạng thái) — dùng để check idempotent
   */
  findLatestByOrderId: async (orderId: string) => {
    return Transaction.findOne({
      order_id: new Types.ObjectId(orderId),
    }).sort({ createdAt: -1 });
  },

  findLatestAttemptByOrderId: async (orderId: string, session?: ClientSession) => {
    const query = Transaction.findOne({
      order_id: new Types.ObjectId(orderId),
    }).sort({ attemptNo: -1, createdAt: -1 });

    return session ? query.session(session) : query;
  },

  findByTxnRef: async (txnRef: string) => {
    return Transaction.findOne({ txnRef: txnRef.toUpperCase() });
  },

  createManualAdjustmentTransaction: async ({
    userId,
    orderId,
    amount,
    paymentMethod,
    paymentMethodId,
    status,
    reason,
    actorId,
  }: {
    userId: string;
    orderId: string;
    amount: number;
    paymentMethod: TransactionPaymentMethod;
    paymentMethodId?: string | null;
    status: TransactionStatus;
    reason: string;
    actorId: string;
  }) => {
    const latestAttempt = await transactionService.findLatestAttemptByOrderId(orderId);
    const attemptNo = Number(latestAttempt?.attemptNo ?? 0) + 1;
    const payload: Record<string, unknown> = {
      user_id: new Types.ObjectId(userId),
      order_id: new Types.ObjectId(orderId),
      amount,
      paymentMethod,
      gatewayProvider: 'manual',
      attemptNo,
      createdBy: 'admin',
      status,
      resolvedAt: status === 'pending' ? null : new Date(),
      failureReason: status === 'success' ? null : reason,
      paymentDetail: {
        manualAdjustment: true,
        reason,
        actorId,
      },
    };

    if (paymentMethodId) {
      payload.paymentMethodId = new Types.ObjectId(paymentMethodId);
    }

    return Transaction.create(payload);
  },

  ensureVNPayAttemptForOrder: async ({
    userId,
    orderId,
    orderCode,
    amount,
    paymentMethodId,
  }: {
    userId: string;
    orderId: string;
    orderCode: string;
    amount: number;
    paymentMethodId?: string | null;
  }) => {
    const reusableInitialTransaction = await transactionService.findPendingWithoutTxnRefByOrderId(orderId);
    const latestAttempt = await transactionService.findLatestAttemptByOrderId(orderId);
    const latestAttemptNo = Number(latestAttempt?.attemptNo ?? 0);
    const attemptNo = reusableInitialTransaction
      ? Math.max(Number(reusableInitialTransaction.attemptNo ?? 1), 1)
      : latestAttemptNo + 1;
    const txnRef = `${orderCode}A${attemptNo}`.toUpperCase();
    const expiredAt = new Date(Date.now() + PAYMENT_ATTEMPT_TTL_MS);

    if (reusableInitialTransaction) {
      await expirePendingAttemptsForOrder(orderId, reusableInitialTransaction._id);

      return Transaction.findOneAndUpdate(
        { _id: reusableInitialTransaction._id, status: 'pending' },
        {
          $set: {
            txnRef,
            attemptNo,
            expiredAt,
            gatewayProvider: 'vnpay',
            paymentMethodId: paymentMethodId ? new Types.ObjectId(paymentMethodId) : reusableInitialTransaction.paymentMethodId ?? null,
            createdBy: reusableInitialTransaction.createdBy ?? 'user',
          },
        },
        { returnDocument: 'after' },
      );
    }

    await expirePendingAttemptsForOrder(orderId);

    try {
      return await transactionService.createPendingTransaction({
        userId,
        orderId,
        amount,
        paymentMethod: 'VNPAY',
        paymentMethodId: paymentMethodId ?? undefined,
        gatewayProvider: 'vnpay',
        txnRef,
        attemptNo,
        expiredAt,
        createdBy: 'user',
      });
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }

      const retryLatestAttempt = await transactionService.findLatestAttemptByOrderId(orderId);
      const retryAttemptNo = Number(retryLatestAttempt?.attemptNo ?? attemptNo) + 1;

      return transactionService.createPendingTransaction({
        userId,
        orderId,
        amount,
        paymentMethod: 'VNPAY',
        paymentMethodId: paymentMethodId ?? undefined,
        gatewayProvider: 'vnpay',
        txnRef: `${orderCode}A${retryAttemptNo}`.toUpperCase(),
        attemptNo: retryAttemptNo,
        expiredAt: new Date(Date.now() + PAYMENT_ATTEMPT_TTL_MS),
        createdBy: 'user',
      });
    }
  },

  /**
   * Cập nhật transaction sau khi IPN/callback trả về.
   * Chỉ cập nhật khi còn pending — đảm bảo idempotent.
   */
  resolveTransaction: async ({
    transactionId,
    status,
    gatewayTransactionId,
    paymentDetail,
    failureReason,
    session,
  }: {
    transactionId: string;
    status: 'success' | 'failed' | 'expired';
    gatewayTransactionId?: string | null;
    paymentDetail?: Record<string, unknown>;
    failureReason?: string | null;
    session?: ClientSession;
  }) => {
    return Transaction.findOneAndUpdate(
      { _id: new Types.ObjectId(transactionId), status: 'pending' },
      {
        $set: {
          status,
          gatewayTransactionId: gatewayTransactionId ?? null,
          paymentDetail: paymentDetail ?? {},
          resolvedAt: new Date(),
          failureReason: failureReason ?? null,
        },
      },
      { returnDocument: 'after', session },
    );
  },
};
