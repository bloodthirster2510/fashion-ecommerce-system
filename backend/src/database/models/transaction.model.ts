import { Schema, model, models, type Document, type Types } from 'mongoose';

export type TransactionStatus = 'pending' | 'success' | 'failed';
export type TransactionPaymentMethod = 'COD' | 'VNPAY' | 'MOMO' | 'CARD' | 'BANK';
export type TransactionGatewayProvider = 'vnpay' | 'momo' | 'stripe' | 'napas' | 'manual' | null;

export interface ITransaction extends Document {
  user_id: Types.ObjectId;
  order_id: Types.ObjectId;
  amount: number;
  paymentMethod: TransactionPaymentMethod;
  paymentMethodId?: Types.ObjectId | null;
  gatewayTransactionId?: string | null;
  gatewayProvider?: TransactionGatewayProvider;
  paymentDetail: Record<string, unknown>;
  status: TransactionStatus;
  createdAt: Date;
  updatedAt: Date;
}

const transactionSchema = new Schema<ITransaction>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    order_id: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    amount: {
      type: Number,
      required: true,
      min: [1, 'Amount must be at least 1 VND'],
    },
    paymentMethod: {
      type: String,
      enum: ['COD', 'VNPAY', 'MOMO', 'CARD', 'BANK'],
      required: true,
    },
    paymentMethodId: {
      type: Schema.Types.ObjectId,
      ref: 'PaymentMethod',
      default: null,
    },
    gatewayTransactionId: {
      type: String,
      trim: true,
      default: null,
      maxlength: 100,
    },
    gatewayProvider: {
      type: String,
      enum: ['vnpay', 'momo', 'stripe', 'napas', 'manual', null],
      default: null,
    },
    paymentDetail: {
      type: Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: ['pending', 'success', 'failed'],
      required: true,
      default: 'pending',
    },
  },
  { timestamps: true },
);

transactionSchema.index({ order_id: 1 });
transactionSchema.index({ user_id: 1, createdAt: -1 });
transactionSchema.index({ status: 1, paymentMethod: 1 });

export const Transaction = models.Transaction || model<ITransaction>('Transaction', transactionSchema);
