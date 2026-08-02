import { Document, Schema, model, models } from 'mongoose';

export type OtpVerificationKind = 'otp' | 'token';

export interface IOtpVerification extends Document {
  phone: string;
  kind: OtpVerificationKind;
  otpHash?: string | null;
  tokenHash?: string | null;
  attempts: number;
  lockedUntil?: Date | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const otpVerificationSchema = new Schema<IOtpVerification>(
  {
    phone: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    kind: {
      type: String,
      enum: ['otp', 'token'],
      required: true,
      index: true,
    },
    otpHash: {
      type: String,
      default: null,
    },
    tokenHash: {
      type: String,
      default: null,
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    lockedUntil: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true },
);

otpVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpVerificationSchema.index({ phone: 1, kind: 1 });
otpVerificationSchema.index(
  { kind: 1, tokenHash: 1 },
  {
    unique: true,
    partialFilterExpression: {
      kind: 'token',
      tokenHash: { $type: 'string' },
    },
  },
);

export const OtpVerification =
  models.OtpVerification || model<IOtpVerification>('OtpVerification', otpVerificationSchema);
