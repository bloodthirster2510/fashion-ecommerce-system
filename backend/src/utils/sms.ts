import crypto from 'crypto';
import { OtpVerification } from '../database/models/otp-verification.model';
import {
  deliverOtpSms,
  getSmsDeliveryCapability,
  type SmsDeliveryResult,
} from './sms-provider';

const OTP_EXPIRY_MINUTES = 5;
const OTP_TOKEN_EXPIRY_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const OTP_LOCK_MINUTES = 10;
const processOtpSecret = crypto.randomBytes(32).toString('hex');

type StoredOtpRecord = {
  _id: unknown;
  phone: string;
  otpHash?: string | null;
  expiresAt: Date;
  attempts?: number | null;
  lockedUntil?: Date | null;
};

type StoredOtpTokenRecord = {
  _id: unknown;
  phone: string;
  tokenHash?: string | null;
  expiresAt: Date;
};

const getOtpSecret = () => {
  const secret = process.env.OTP_HASH_SECRET?.trim() || process.env.JWT_ACCESS_SECRET?.trim();

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('OTP_HASH_SECRET or JWT_ACCESS_SECRET is required in production');
  }

  return processOtpSecret;
};

const hashOtp = (phone: string, otp: string) =>
  crypto.createHmac('sha256', getOtpSecret()).update(`${phone}:${otp}`).digest('hex');

const hashToken = (token: string) =>
  crypto.createHash('sha256').update(token).digest('hex');

const timingSafeEqualHex = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left, 'hex');
  const rightBuffer = Buffer.from(right, 'hex');

  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

export const generateOtp = (): string => {
  return crypto.randomInt(100000, 1000000).toString();
};

export const sendOtpSms = async (phone: string): Promise<SmsDeliveryResult> => {
  const capability = getSmsDeliveryCapability();
  const otp = capability.testOtp ?? generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await OtpVerification.deleteMany({ phone, kind: 'token' });
  await OtpVerification.findOneAndUpdate(
    { phone, kind: 'otp' },
    {
      $set: {
        otpHash: hashOtp(phone, otp),
        tokenHash: null,
        expiresAt,
        attempts: 0,
        lockedUntil: null,
      },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );

  try {
    return await deliverOtpSms(phone, otp, expiresAt);
  } catch (error) {
    await OtpVerification.deleteOne({ phone, kind: 'otp' });
    throw error;
  }
};

export const verifyOtpCode = async (phone: string, otp: string): Promise<string | null> => {
  const record = await OtpVerification.findOne({ phone, kind: 'otp' }).lean<StoredOtpRecord>();

  if (!record?.otpHash) {
    return null;
  }

  const now = new Date();

  if (record.lockedUntil && now < record.lockedUntil) {
    return null;
  }

  if (new Date() > record.expiresAt) {
    await OtpVerification.deleteOne({ _id: record._id });
    return null;
  }

  const otpHash = hashOtp(phone, otp);
  if (!timingSafeEqualHex(record.otpHash, otpHash)) {
    const attempts = (record.attempts ?? 0) + 1;
    const lockedUntil = attempts >= OTP_MAX_ATTEMPTS
      ? new Date(now.getTime() + OTP_LOCK_MINUTES * 60 * 1000)
      : null;

    await OtpVerification.updateOne(
      { _id: record._id },
      {
        $set: {
          attempts,
          lockedUntil,
        },
      },
    );

    return null;
  }

  const consumedOtp = await OtpVerification.findOneAndDelete({
    _id: record._id,
    phone,
    kind: 'otp',
  });
  if (!consumedOtp) {
    return null;
  }

  const otpToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(otpToken);
  const expiresAt = new Date(Date.now() + OTP_TOKEN_EXPIRY_MINUTES * 60 * 1000);
  await OtpVerification.create({
    phone,
    kind: 'token',
    tokenHash,
    otpHash: null,
    attempts: 0,
    expiresAt,
  });

  return otpToken;
};

export const verifyOtpToken = async (phone: string, token: string): Promise<boolean> => {
  const tokenHash = hashToken(token);
  const record = await OtpVerification.findOneAndDelete({
    phone,
    kind: 'token',
    tokenHash,
    expiresAt: { $gt: new Date() },
  }).lean<StoredOtpTokenRecord>();
  if (!record) return false;
  return true;
};
