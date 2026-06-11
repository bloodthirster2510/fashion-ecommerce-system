import { Types } from 'mongoose';
import { Transaction, type TransactionPaymentMethod } from '../../database/models';

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
  }: {
    userId: string;
    orderId: string;
    amount: number;
    paymentMethod: TransactionPaymentMethod;
    gatewayProvider?: 'vnpay' | 'momo' | 'stripe' | 'napas' | 'manual' | null;
  }) => {
    return Transaction.create({
      user_id: new Types.ObjectId(userId),
      order_id: new Types.ObjectId(orderId),
      amount,
      paymentMethod,
      gatewayProvider: gatewayProvider ?? null,
      paymentDetail: {},
      status: 'pending',
    });
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

  /**
   * Tìm transaction theo orderId (bất kỳ trạng thái) — dùng để check idempotent
   */
  findLatestByOrderId: async (orderId: string) => {
    return Transaction.findOne({
      order_id: new Types.ObjectId(orderId),
    }).sort({ createdAt: -1 });
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
  }: {
    transactionId: string;
    status: 'success' | 'failed';
    gatewayTransactionId?: string | null;
    paymentDetail?: Record<string, unknown>;
  }) => {
    return Transaction.findOneAndUpdate(
      { _id: new Types.ObjectId(transactionId), status: 'pending' },
      {
        $set: {
          status,
          gatewayTransactionId: gatewayTransactionId ?? null,
          paymentDetail: paymentDetail ?? {},
        },
      },
      { new: true },
    );
  },
};
