import crypto from 'crypto';

interface OtpRecord {
  otp: string;
  expiresAt: Date;
}

const otpStore = new Map<string, OtpRecord>();
const OTP_EXPIRY_MINUTES = 5;

export const generateOtp = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const sendOtpSms = async (phone: string) => {
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  otpStore.set(phone, { otp, expiresAt });

  console.log('=== SMS OTP ===');
  console.log(`Phone: ${phone}`);
  console.log(`OTP: ${otp}`);
  console.log(`Expires: ${expiresAt}`);
  console.log('===============');

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
  }
};

export const verifyOtpCode = (phone: string, otp: string): string | null => {
  const record = otpStore.get(phone);

  if (!record) {
    return null;
  }

  if (new Date() > record.expiresAt) {
    otpStore.delete(phone);
    return null;
  }

  if (record.otp !== otp) {
    return null;
  }

  otpStore.delete(phone);

  const otpToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  otpStore.set(`token:${otpToken}`, { otp: phone, expiresAt });

  return otpToken;
};

export const verifyOtpToken = (phone: string, token: string): boolean => {
  const record = otpStore.get(`token:${token}`);
  if (!record) return false;

  if (new Date() > record.expiresAt) {
    otpStore.delete(`token:${token}`);
    return false;
  }

  if (record.otp !== phone) return false;

  otpStore.delete(`token:${token}`);
  return true;
};
