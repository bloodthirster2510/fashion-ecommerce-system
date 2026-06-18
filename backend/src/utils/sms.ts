import crypto from 'crypto';

interface OtpRecord {
  otpHash: string;
  expiresAt: Date;
  attempts: number;
  lockedUntil?: Date;
}

interface OtpTokenRecord {
  phone: string;
  expiresAt: Date;
}

const otpStore = new Map<string, OtpRecord | OtpTokenRecord>();
const OTP_EXPIRY_MINUTES = 5;
const OTP_TOKEN_EXPIRY_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const OTP_LOCK_MINUTES = 10;
const processOtpSecret = crypto.randomBytes(32).toString('hex');

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

const isOtpRecord = (record: OtpRecord | OtpTokenRecord | undefined): record is OtpRecord => (
  Boolean(record && 'otpHash' in record)
);

const isOtpTokenRecord = (record: OtpRecord | OtpTokenRecord | undefined): record is OtpTokenRecord => (
  Boolean(record && 'phone' in record)
);

export const generateOtp = (): string => {
  return crypto.randomInt(100000, 1000000).toString();
};

export const sendOtpSms = async (phone: string) => {
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  otpStore.set(phone, {
    otpHash: hashOtp(phone, otp),
    expiresAt,
    attempts: 0,
  });

  if (process.env.SMS_PROVIDER === 'twilio') {
    try {
    } catch (err) {
      console.error('Failed to send SMS via Twilio:', err);
    }
  } else if (process.env.SMS_PROVIDER === 'esms') {
    try {
    } catch (err) {
      console.error('Failed to send SMS via ESMS:', err);
    }
  } else if (process.env.NODE_ENV !== 'production') {
    console.info(`OTP generated for ${phone.slice(-4).padStart(phone.length, '*')}; configure SMS_PROVIDER to deliver it.`);
  }
};

export const verifyOtpCode = (phone: string, otp: string): string | null => {
  const record = otpStore.get(phone);

  if (!isOtpRecord(record)) {
    return null;
  }

  const now = new Date();

  if (record.lockedUntil && now < record.lockedUntil) {
    return null;
  }

  if (new Date() > record.expiresAt) {
    otpStore.delete(phone);
    return null;
  }

  const otpHash = hashOtp(phone, otp);
  if (!timingSafeEqualHex(record.otpHash, otpHash)) {
    record.attempts += 1;

    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      record.lockedUntil = new Date(now.getTime() + OTP_LOCK_MINUTES * 60 * 1000);
    }

    return null;
  }

  otpStore.delete(phone);

  const otpToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + OTP_TOKEN_EXPIRY_MINUTES * 60 * 1000);
  otpStore.set(`token:${hashToken(otpToken)}`, { phone, expiresAt });

  return otpToken;
};

export const verifyOtpToken = (phone: string, token: string): boolean => {
  const tokenKey = `token:${hashToken(token)}`;
  const record = otpStore.get(tokenKey);
  if (!isOtpTokenRecord(record)) return false;

  if (new Date() > record.expiresAt) {
    otpStore.delete(tokenKey);
    return false;
  }

  if (record.phone !== phone) return false;

  otpStore.delete(tokenKey);
  return true;
};
