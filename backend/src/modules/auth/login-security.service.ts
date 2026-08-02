import crypto from 'crypto';
import { LoginAttempt } from '../../database/models/login-attempt.model';
import { User, type IUser } from '../../database/models/user.model';
import { getEmailDeliveryCapability } from '../../utils/email-provider';
import { sendLoginUnlockOtpEmail } from '../../utils/email';
import { deliverOtpSms, getSmsDeliveryCapability } from '../../utils/sms-provider';
import { generateOtp } from '../../utils/sms';

const DEFAULT_FAILURE_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_MAX_FAILED_ATTEMPTS = 5;
const DEFAULT_LOCK_DURATIONS_MS = [15, 30, 60].map((minutes) => minutes * 60 * 1000);
const ATTEMPT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const UNLOCK_OTP_EXPIRY_MS = 5 * 60 * 1000;
const UNLOCK_OTP_COOLDOWN_MS = 60 * 1000;
const UNLOCK_OTP_MAX_ATTEMPTS = 5;
const UNLOCK_OTP_LOCK_MS = 10 * 60 * 1000;
const processOtpSecret = crypto.randomBytes(32).toString('hex');

type LoginUserReference = Pick<IUser, '_id'>;
type StoredLoginAttempt = {
  failedAttempts: number;
  lockedUntil?: Date | null;
  lockLevel: number;
};

export type LoginUnlockMethod = 'email' | 'phone';
export type LoginUnlockDelivery = {
  mode: 'mock' | 'real';
  provider: 'mock' | 'smtp' | 'twilio' | 'esms';
  testOtp?: string;
};

export type LoginUnlockRequestResult = {
  method: LoginUnlockMethod;
  delivery: LoginUnlockDelivery;
};

export class LoginSecurityError extends Error {
  readonly status: number;
  readonly errorCode: string;
  readonly data?: Record<string, unknown>;

  constructor(
    message: string,
    options: { status: number; errorCode: string; data?: Record<string, unknown> },
  ) {
    super(message);
    this.name = 'LoginSecurityError';
    this.status = options.status;
    this.errorCode = options.errorCode;
    this.data = options.data;
  }
}

const parsePositiveIntegerEnv = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

const getFailureWindowMs = () => parsePositiveIntegerEnv(
  'LOGIN_FAILURE_WINDOW_MS',
  DEFAULT_FAILURE_WINDOW_MS,
);

const getMaxFailedAttempts = () => parsePositiveIntegerEnv(
  'LOGIN_MAX_FAILED_ATTEMPTS',
  DEFAULT_MAX_FAILED_ATTEMPTS,
);

const getLockDurationsMs = () => {
  const configured = process.env.LOGIN_LOCK_DURATIONS_MINUTES
    ?.split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0)
    .map((minutes) => minutes * 60 * 1000);

  return configured?.length ? configured : DEFAULT_LOCK_DURATIONS_MS;
};

const normalizeIdentifier = (identifier: string) => identifier.trim().toLowerCase();

const getLoginAttemptKey = (identifier: string, user?: LoginUserReference | null) => {
  const subject = user ? `user:${user._id.toString()}` : `identifier:${normalizeIdentifier(identifier)}`;
  return crypto.createHash('sha256').update(subject).digest('hex');
};

const getOtpSecret = () => {
  const secret = process.env.OTP_HASH_SECRET?.trim() || process.env.JWT_ACCESS_SECRET?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('OTP_HASH_SECRET or JWT_ACCESS_SECRET is required in production');
  }
  return processOtpSecret;
};

const hashUnlockOtp = (userId: string, otp: string) => crypto
  .createHmac('sha256', getOtpSecret())
  .update(`login-unlock:${userId}:${otp}`)
  .digest('hex');

const timingSafeEqualHex = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left, 'hex');
  const rightBuffer = Buffer.from(right, 'hex');
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const createLockedError = (lockedUntil: Date) => {
  const retryAfterSeconds = Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 1000));
  return new LoginSecurityError(
    'Tài khoản tạm khóa do đăng nhập sai nhiều lần. Bạn có thể chờ hoặc mở khóa bằng OTP.',
    {
      status: 429,
      errorCode: 'LOGIN_TEMPORARILY_LOCKED',
      data: {
        lockedUntil: lockedUntil.toISOString(),
        retryAfterSeconds,
        canUnlock: true,
      },
    },
  );
};

const findUserByIdentifier = (identifier: string) => {
  const normalized = normalizeIdentifier(identifier);
  return User.findOne(normalized.includes('@') ? { email: normalized } : { phone: identifier.trim() });
};

export const assertLoginAllowed = async (
  identifier: string,
  user?: LoginUserReference | null,
) => {
  const attempt = await LoginAttempt.findOne({ key: getLoginAttemptKey(identifier, user) })
    .lean<StoredLoginAttempt>();
  const lockedUntil = attempt?.lockedUntil ? new Date(attempt.lockedUntil) : null;
  if (lockedUntil && lockedUntil.getTime() > Date.now()) throw createLockedError(lockedUntil);
};

export const recordFailedLogin = async (
  identifier: string,
  user?: LoginUserReference | null,
) => {
  const now = new Date();
  const key = getLoginAttemptKey(identifier, user);
  const maxAttempts = getMaxFailedAttempts();
  const windowCutoff = new Date(now.getTime() - getFailureWindowMs());
  const expiresAt = new Date(now.getTime() + ATTEMPT_RETENTION_MS);
  const lockDurations = getLockDurationsMs();
  const attemptsInWindow = {
    $cond: [
      { $gt: [{ $ifNull: ['$windowStartedAt', new Date(0)] }, windowCutoff] },
      { $add: [{ $ifNull: ['$failedAttempts', 0] }, 1] },
      1,
    ],
  };
  const currentLockLevel = { $ifNull: ['$lockLevel', 0] };
  const lockDurationExpression = {
    $switch: {
      branches: lockDurations.map((duration, index) => ({
        case: { $eq: [currentLockLevel, index] },
        then: duration,
      })),
      default: lockDurations[lockDurations.length - 1],
    },
  };

  const updateAttempt = () => LoginAttempt.findOneAndUpdate(
    { key },
    [{
      $set: {
        key,
        failedAttempts: attemptsInWindow,
        windowStartedAt: {
          $cond: [
            { $gt: [{ $ifNull: ['$windowStartedAt', new Date(0)] }, windowCutoff] },
            '$windowStartedAt',
            now,
          ],
        },
        lockedUntil: {
          $cond: [
            { $gte: [attemptsInWindow, maxAttempts] },
            { $add: [now, lockDurationExpression] },
            null,
          ],
        },
        lockLevel: {
          $cond: [
            { $gte: [attemptsInWindow, maxAttempts] },
            { $add: [currentLockLevel, 1] },
            currentLockLevel,
          ],
        },
        expiresAt,
      },
    }],
    { upsert: true, returnDocument: 'after', updatePipeline: true },
  ).lean<StoredLoginAttempt>();

  let attempt;
  try {
    attempt = await updateAttempt();
  } catch (error) {
    const duplicateInsert = typeof error === 'object' && error !== null && 'code' in error
      && (error as { code?: number }).code === 11000;
    if (!duplicateInsert) throw error;
    attempt = await updateAttempt();
  }

  const lockedUntil = attempt?.lockedUntil ? new Date(attempt.lockedUntil) : null;
  if (lockedUntil && lockedUntil.getTime() > Date.now()) throw createLockedError(lockedUntil);
};

const clearUnlockChallenge = (userId: IUser['_id']) => User.updateOne(
  { _id: userId },
  {
    $set: {
      loginUnlockOtpHash: null,
      loginUnlockOtpExpiresAt: null,
      loginUnlockOtpAttempts: 0,
      loginUnlockOtpLockedUntil: null,
      loginUnlockOtpSentAt: null,
    },
  },
);

export const clearLoginSecurity = async (identifier: string, user: LoginUserReference) => {
  await Promise.all([
    LoginAttempt.deleteOne({ key: getLoginAttemptKey(identifier, user) }),
    clearUnlockChallenge(user._id),
  ]);
};

export const requestLoginUnlock = async (
  identifier: string,
  preferredMethod?: LoginUnlockMethod,
): Promise<LoginUnlockRequestResult> => {
  const normalized = normalizeIdentifier(identifier);
  const method: LoginUnlockMethod = preferredMethod ?? (normalized.includes('@') ? 'email' : 'phone');
  const capability = method === 'email' ? getEmailDeliveryCapability() : getSmsDeliveryCapability();
  const genericResult: LoginUnlockRequestResult = { method, delivery: capability };
  const user = await findUserByIdentifier(identifier);
  if (!user || !user.isActive || (method === 'phone' && !user.phone)) return genericResult;

  const attempt = await LoginAttempt.findOne({ key: getLoginAttemptKey(identifier, user) })
    .lean<StoredLoginAttempt>();
  const accountLockedUntil = attempt?.lockedUntil ? new Date(attempt.lockedUntil) : null;
  if (!accountLockedUntil || accountLockedUntil.getTime() <= Date.now()) return genericResult;

  const now = new Date();
  const otpLockedUntil = user.loginUnlockOtpLockedUntil
    ? new Date(user.loginUnlockOtpLockedUntil)
    : null;
  if (otpLockedUntil && otpLockedUntil.getTime() > now.getTime()) {
    throw new LoginSecurityError('Bạn đã nhập sai OTP quá nhiều lần. Vui lòng thử lại sau.', {
      status: 429,
      errorCode: 'LOGIN_UNLOCK_OTP_LOCKED',
      data: { retryAfterSeconds: Math.ceil((otpLockedUntil.getTime() - now.getTime()) / 1000) },
    });
  }

  const sentAt = user.loginUnlockOtpSentAt ? new Date(user.loginUnlockOtpSentAt) : null;
  if (sentAt && now.getTime() - sentAt.getTime() < UNLOCK_OTP_COOLDOWN_MS) {
    throw new LoginSecurityError('Vui lòng chờ trước khi yêu cầu mã OTP mới.', {
      status: 429,
      errorCode: 'LOGIN_UNLOCK_OTP_COOLDOWN',
      data: { retryAfterSeconds: Math.ceil((UNLOCK_OTP_COOLDOWN_MS - (now.getTime() - sentAt.getTime())) / 1000) },
    });
  }

  const otp = method === 'phone' && 'testOtp' in capability && capability.testOtp
    ? capability.testOtp
    : generateOtp();
  const expiresAt = new Date(now.getTime() + UNLOCK_OTP_EXPIRY_MS);
  const previousChallenge = {
    loginUnlockOtpHash: user.loginUnlockOtpHash ?? null,
    loginUnlockOtpExpiresAt: user.loginUnlockOtpExpiresAt ?? null,
    loginUnlockOtpAttempts: user.loginUnlockOtpAttempts ?? 0,
    loginUnlockOtpLockedUntil: user.loginUnlockOtpLockedUntil ?? null,
    loginUnlockOtpSentAt: user.loginUnlockOtpSentAt ?? null,
  };

  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        loginUnlockOtpHash: hashUnlockOtp(user._id.toString(), otp),
        loginUnlockOtpExpiresAt: expiresAt,
        loginUnlockOtpAttempts: 0,
        loginUnlockOtpLockedUntil: null,
        loginUnlockOtpSentAt: now,
      },
    },
  );

  try {
    const delivery = method === 'email'
      ? await sendLoginUnlockOtpEmail(user.email, otp, expiresAt)
      : await deliverOtpSms(user.phone, otp, expiresAt);
    return {
      method,
      delivery: {
        mode: delivery.mode,
        provider: delivery.provider,
        ...('testOtp' in delivery && delivery.testOtp ? { testOtp: delivery.testOtp } : {}),
      },
    };
  } catch (error) {
    await User.updateOne({ _id: user._id }, { $set: previousChallenge });
    throw error;
  }
};

const createInvalidOtpError = () => new LoginSecurityError(
  'Mã OTP không hợp lệ hoặc đã hết hạn.',
  { status: 400, errorCode: 'LOGIN_UNLOCK_OTP_INVALID' },
);

export const verifyLoginUnlock = async (identifier: string, otp: string) => {
  const user = await findUserByIdentifier(identifier);
  if (!user || !user.isActive || !user.loginUnlockOtpHash) throw createInvalidOtpError();

  const now = new Date();
  const accountAttempt = await LoginAttempt.findOne({ key: getLoginAttemptKey(identifier, user) })
    .lean<StoredLoginAttempt>();
  const accountLockedUntil = accountAttempt?.lockedUntil ? new Date(accountAttempt.lockedUntil) : null;
  const otpLockedUntil = user.loginUnlockOtpLockedUntil
    ? new Date(user.loginUnlockOtpLockedUntil)
    : null;
  const otpExpiresAt = user.loginUnlockOtpExpiresAt ? new Date(user.loginUnlockOtpExpiresAt) : null;

  if (!accountLockedUntil || accountLockedUntil <= now || !otpExpiresAt || otpExpiresAt <= now) {
    throw createInvalidOtpError();
  }
  if (otpLockedUntil && otpLockedUntil > now) {
    throw new LoginSecurityError('Bạn đã nhập sai OTP quá nhiều lần. Vui lòng thử lại sau.', {
      status: 429,
      errorCode: 'LOGIN_UNLOCK_OTP_LOCKED',
      data: { retryAfterSeconds: Math.ceil((otpLockedUntil.getTime() - now.getTime()) / 1000) },
    });
  }

  const candidateHash = hashUnlockOtp(user._id.toString(), otp.trim());
  if (!timingSafeEqualHex(user.loginUnlockOtpHash, candidateHash)) {
    const attempts = (user.loginUnlockOtpAttempts ?? 0) + 1;
    await User.updateOne(
      { _id: user._id, loginUnlockOtpHash: user.loginUnlockOtpHash },
      {
        $set: {
          loginUnlockOtpAttempts: attempts,
          loginUnlockOtpLockedUntil: attempts >= UNLOCK_OTP_MAX_ATTEMPTS
            ? new Date(now.getTime() + UNLOCK_OTP_LOCK_MS)
            : null,
        },
      },
    );
    throw createInvalidOtpError();
  }

  const consumed = await User.findOneAndUpdate(
    {
      _id: user._id,
      loginUnlockOtpHash: user.loginUnlockOtpHash,
      loginUnlockOtpExpiresAt: { $gt: now },
    },
    {
      $set: {
        loginUnlockOtpHash: null,
        loginUnlockOtpExpiresAt: null,
        loginUnlockOtpAttempts: 0,
        loginUnlockOtpLockedUntil: null,
        loginUnlockOtpSentAt: null,
      },
    },
    { returnDocument: 'after' },
  );
  if (!consumed) throw createInvalidOtpError();

  await LoginAttempt.deleteOne({ key: getLoginAttemptKey(identifier, user) });
};
