import { Schema, model, models, type Document, type Types } from 'mongoose';

export type PaymentMethodType = 'VNPAY' | 'MOMO' | 'BANK' | 'CARD';
export type PaymentMethodStatus = 'pending' | 'verified' | 'expired' | 'disabled';

export interface IPaymentMethod extends Document {
  user_id: Types.ObjectId;
  type: PaymentMethodType;
  provider: string;
  displayName: string;
  maskedInfo?: string | null;
  accountNumberEncrypted?: string | null;
  bankCode?: string | null;
  bankName?: string | null;
  cardBrand?: string | null;
  last4?: string | null;
  walletPhoneLast3?: string | null;
  providerCustomerId?: string | null;
  providerPaymentMethodId?: string | null;
  status: PaymentMethodStatus;
  isDefault: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const paymentMethodSchema = new Schema<IPaymentMethod>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['VNPAY', 'MOMO', 'BANK', 'CARD'],
      required: true,
    },
    provider: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 40,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 120,
    },
    maskedInfo: { type: String, trim: true, default: null, maxlength: 120 },
    accountNumberEncrypted: { type: String, select: false, default: null },
    bankCode: { type: String, trim: true, uppercase: true, default: null, maxlength: 30 },
    bankName: { type: String, trim: true, default: null, maxlength: 120 },
    cardBrand: { type: String, trim: true, default: null, maxlength: 40 },
    last4: { type: String, trim: true, default: null, maxlength: 4 },
    walletPhoneLast3: { type: String, trim: true, default: null, maxlength: 3 },
    providerCustomerId: { type: String, trim: true, default: null, maxlength: 200 },
    providerPaymentMethodId: { type: String, trim: true, default: null, maxlength: 200 },
    status: {
      type: String,
      enum: ['pending', 'verified', 'expired', 'disabled'],
      required: true,
      default: 'verified',
    },
    isDefault: { type: Boolean, default: false },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

paymentMethodSchema.index({ user_id: 1, status: 1 });
paymentMethodSchema.index(
  { user_id: 1, isDefault: 1 },
  {
    unique: true,
    partialFilterExpression: {
      isDefault: true,
      status: { $in: ['verified'] },
    },
  },
);

export const PaymentMethod =
  models.PaymentMethod || model<IPaymentMethod>('PaymentMethod', paymentMethodSchema);
