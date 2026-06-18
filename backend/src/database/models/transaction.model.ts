import { Schema, model, models, type Document, type Types } from 'mongoose';

export type TransactionStatus = 'pending' | 'success' | 'failed' | 'expired';
export type TransactionPaymentMethod = 'COD' | 'VNPAY' | 'MOMO' | 'CARD' | 'BANK';
export type TransactionGatewayProvider = 'vnpay' | 'momo' | 'stripe' | 'napas' | 'manual' | null;
export type TransactionCreatedBy = 'user' | 'admin' | 'system';

export interface ITransaction extends Document {
  user_id: Types.ObjectId;
  order_id: Types.ObjectId;
  amount: number;
  paymentMethod: TransactionPaymentMethod;
  paymentMethodId?: Types.ObjectId | null;
  txnRef?: string | null;
  attemptNo?: number;
  expiredAt?: Date | null;
  resolvedAt?: Date | null;
  failureReason?: string | null;
  createdBy?: TransactionCreatedBy;
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
    txnRef: {
      type: String,
      trim: true,
      uppercase: true,
      minlength: 1,
      maxlength: 100,
    },
    attemptNo: {
      type: Number,
      min: 1,
    },
    expiredAt: {
      type: Date,
    },
    resolvedAt: {
      type: Date,
    },
    failureReason: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    createdBy: {
      type: String,
      enum: ['user', 'admin', 'system'],
      default: 'user',
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
      enum: ['pending', 'success', 'failed', 'expired'],
      required: true,
      default: 'pending',
    },
  },
  { timestamps: true },
);

transactionSchema.index({ order_id: 1 });
transactionSchema.index({ user_id: 1, createdAt: -1 });
transactionSchema.index({ status: 1, paymentMethod: 1 });
transactionSchema.index({ txnRef: 1 }, { unique: true, sparse: true });
transactionSchema.index({ order_id: 1, attemptNo: 1 }, { unique: true, sparse: true });
transactionSchema.index({ order_id: 1, status: 1, createdAt: -1 });
transactionSchema.index({ user_id: 1, paymentMethod: 1, createdAt: -1 });

export const Transaction = models.Transaction || model<ITransaction>('Transaction', transactionSchema);
