import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { User, type AuthProviderName, type IUser } from '../../database/models/user.model';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  JwtPayload,
} from '../../utils/jwt';
import {
  getResetPasswordEmailCapability,
  sendResetPasswordEmail,
} from '../../utils/email';
import { sendOtpSms, verifyOtpCode, verifyOtpToken } from '../../utils/sms';
import { getSmsDeliveryCapability, type SmsDeliveryInfo } from '../../utils/sms-provider';
import { normalizeUserAddressInput, type UserAddressInput } from '../../utils/address';
import { LEGAL_POLICY_VERSION } from './legal-policy';
import { PushToken } from '../../database/models/push-token.model';

const SALT_ROUNDS = 10;
const DEFAULT_AUTH_IDENTIFIER_COOLDOWN_MS = 60_000;
const DEFAULT_AUTH_IDENTIFIER_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_AUTH_IDENTIFIER_MAX_ATTEMPTS = 5;
const DEFAULT_AUTH_IDENTIFIER_LOCK_MS = 15 * 60 * 1000;

type AuthIdentifierThrottleBucket = {
  count: number;
  resetAt: number;
  lastRequestedAt: number;
  lockedUntil?: number;
};

const authIdentifierThrottleStore = new Map<string, AuthIdentifierThrottleBucket>();

const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

const hashRefreshToken = (token: string) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

const parsePositiveIntegerEnv = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

const createAuthThrottleError = () => ({
  status: 429,
  message: 'Vui lòng chờ trước khi yêu cầu mã mới',
});

const normalizeThrottleIdentifier = (identifier: string) => identifier.trim().toLowerCase();

const assertAuthIdentifierNotThrottled = (flow: 'send-otp' | 'forgot-password', identifier: string) => {
  const now = Date.now();
  const key = `${flow}:${normalizeThrottleIdentifier(identifier)}`;
  const cooldownMs = parsePositiveIntegerEnv(
    'AUTH_IDENTIFIER_COOLDOWN_MS',
    DEFAULT_AUTH_IDENTIFIER_COOLDOWN_MS,
  );
  const windowMs = parsePositiveIntegerEnv('AUTH_IDENTIFIER_WINDOW_MS', DEFAULT_AUTH_IDENTIFIER_WINDOW_MS);
  const maxAttempts = parsePositiveIntegerEnv(
    'AUTH_IDENTIFIER_MAX_ATTEMPTS',
    DEFAULT_AUTH_IDENTIFIER_MAX_ATTEMPTS,
  );
  const lockMs = parsePositiveIntegerEnv('AUTH_IDENTIFIER_LOCK_MS', DEFAULT_AUTH_IDENTIFIER_LOCK_MS);
  const existingBucket = authIdentifierThrottleStore.get(key);

  if (existingBucket?.lockedUntil && existingBucket.lockedUntil > now) {
    throw createAuthThrottleError();
  }

  if (existingBucket && now - existingBucket.lastRequestedAt < cooldownMs) {
    throw createAuthThrottleError();
  }

  const bucket =
    existingBucket && existingBucket.resetAt > now
      ? existingBucket
      : { count: 0, resetAt: now + windowMs, lastRequestedAt: 0 };

  bucket.count += 1;
  bucket.lastRequestedAt = now;

  if (bucket.count > maxAttempts) {
    bucket.lockedUntil = now + lockMs;
    authIdentifierThrottleStore.set(key, bucket);
    throw createAuthThrottleError();
  }

  delete bucket.lockedUntil;
  authIdentifierThrottleStore.set(key, bucket);
};

export const clearAuthRequestThrottleForTests = () => {
  if (process.env.NODE_ENV === 'test') {
    authIdentifierThrottleStore.clear();
  }
};

const updateAuthFields = async (user: IUser, fields: Record<string, unknown>) => {
  await User.updateOne({ _id: user._id }, { $set: fields });
};

const isProfileCompleted = (user: IUser) =>
  Boolean(user.phone && user.gender && user.dateOfBirth && Array.isArray(user.address) && user.address.length > 0);

const toSessionUser = (user: IUser) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone ?? '',
  role: user.role,
  permissions: user.permissions ?? [],
  mustChangePassword: user.mustChangePassword ?? false,
  avatarImage: user.avatarImage ?? null,
  profileCompleted: isProfileCompleted(user),
});

const createSocialUser = async (data: {
  provider: AuthProviderName;
  providerId: string;
  name: string;
  email: string;
}) => {
  return User.create({
    name: data.name,
    email: data.email.toLowerCase(),
    password: await hashPassword(crypto.randomBytes(32).toString('hex')),
    role: 'user',
    isActive: true,
    profileCompleted: false,
    authProviders: [{ provider: data.provider, providerId: data.providerId }],
    address: [],
  });
};

const linkAuthProvider = async (user: IUser, provider: AuthProviderName, providerId: string) => {
  const alreadyLinked = user.authProviders.some(
    (item) => item.provider === provider && item.providerId === providerId,
  );

  if (!alreadyLinked) {
    user.authProviders.push({ provider, providerId });
    await User.updateOne(
      { _id: user._id },
      { $addToSet: { authProviders: { provider, providerId } } },
    );
  }
};

export const sendOtp = async (phone: string): Promise<SmsDeliveryInfo> => {
  assertAuthIdentifierNotThrottled('send-otp', phone);
  const capability = getSmsDeliveryCapability();
  const existingUser = await User.findOne({ phone });
  if (existingUser) return capability;

  const delivery = await sendOtpSms(phone);
  return {
    mode: delivery.mode,
    provider: delivery.provider,
    ...(delivery.testOtp ? { testOtp: delivery.testOtp } : {}),
  };
};

export const verifyOtp = async (phone: string, otp: string): Promise<string> => {
  const token = await verifyOtpCode(phone, otp);
  if (!token) {
    throw { status: 400, message: 'Mã OTP không hợp lệ hoặc đã hết hạn' };
  }
  return token;
};

export const registerUser = async (data: {
  name: string;
  email: string;
  password: string;
  phone: string;
  gender: string;
  dateOfBirth: string;
  address: UserAddressInput;
  otpToken: string;
  acceptedTerms: boolean;
  policyVersion: string;
}) => {
  if (!data.acceptedTerms || data.policyVersion !== LEGAL_POLICY_VERSION) {
    throw { status: 400, message: 'Bạn cần đồng ý với phiên bản điều khoản hiện hành' };
  }

  if (!(await verifyOtpToken(data.phone, data.otpToken))) {
    throw { status: 400, message: 'Số điện thoại chưa được xác thực' };
  }

  const existingUser = await User.findOne({
    $or: [{ email: data.email.toLowerCase() }, { phone: data.phone }],
  });

  if (existingUser) {
    if (existingUser.email === data.email.toLowerCase()) {
      throw { status: 409, message: 'Email đã được sử dụng' };
    }
    throw { status: 409, message: 'Số điện thoại đã được sử dụng' };
  }

  const hashedPassword = await hashPassword(data.password);
  const address = normalizeUserAddressInput({
    ...data.address,
    isDefault: true,
  });

  const user = await User.create({
    name: data.name,
    email: data.email.toLowerCase(),
    password: hashedPassword,
    phone: data.phone,
    gender: data.gender,
    dateOfBirth: new Date(data.dateOfBirth),
    role: 'user',
    isActive: true,
    address: [address],
    legalConsent: {
      policyVersion: LEGAL_POLICY_VERSION,
      acceptedAt: new Date(),
    },
  });

  const payload: JwtPayload = { userId: user._id.toString(), email: user.email, role: user.role };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  await updateAuthFields(user, { refreshToken: hashRefreshToken(refreshToken), lastLoginAt: new Date() });

  return {
    accessToken,
    refreshToken,
    user: toSessionUser(user),
  };
};

const loginWithPassword = async (
  identifier: string,
  password: string,
  options: { allowedRoles?: Array<IUser['role']> } = {},
) => {
  const isEmail = identifier.includes('@');
  const query = isEmail ? { email: identifier.toLowerCase() } : { phone: identifier };

  const user = await User.findOne(query);

  if (!user) {
    throw { status: 401, message: 'Thông tin đăng nhập không chính xác' };
  }

  if (!user.isActive) {
    throw { status: 403, message: 'Tài khoản không còn hoạt động' };
  }

  const isPasswordValid = await comparePassword(password, user.password);
  if (!isPasswordValid) {
    throw { status: 401, message: 'Thông tin đăng nhập không chính xác' };
  }

  if (options.allowedRoles && !options.allowedRoles.includes(user.role)) {
    throw { status: 403, message: 'Tài khoản không có quyền truy cập trang quản trị' };
  }

  const payload: JwtPayload = { userId: user._id.toString(), email: user.email, role: user.role };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  await updateAuthFields(user, { refreshToken: hashRefreshToken(refreshToken), lastLoginAt: new Date() });

  return {
    accessToken,
    refreshToken,
    user: toSessionUser(user),
  };
};

export const loginUser = async (identifier: string, password: string) => {
  return loginWithPassword(identifier, password);
};

export const loginAdminUser = async (identifier: string, password: string) => {
  return loginWithPassword(identifier, password, { allowedRoles: ['admin', 'staff'] });
};

export const logoutUser = async (userId: string) => {
  await Promise.all([
    User.updateOne({ _id: userId }, { $set: { refreshToken: null } }),
    PushToken.updateMany({ userId, isActive: true }, { $set: { isActive: false } }),
  ]);
};

export const logoutWithAccessToken = async (token: string) => {
  const payload = verifyAccessToken(token);
  await logoutUser(payload.userId);
};

export const logoutWithRefreshToken = async (token: string) => {
  const payload = verifyRefreshToken(token);
  await logoutUser(payload.userId);
};

export const refreshAccessToken = async (token: string) => {
  let payload: JwtPayload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw { status: 401, message: 'Refresh token không hợp lệ hoặc đã hết hạn' };
  }

  const user = await User.findById(payload.userId);
  const tokenHash = hashRefreshToken(token);
  if (!user || (user.refreshToken !== tokenHash && user.refreshToken !== token)) {
    throw { status: 401, message: 'Refresh token không hợp lệ' };
  }

  const newPayload: JwtPayload = { userId: user._id.toString(), email: user.email, role: user.role };
  const newAccessToken = generateAccessToken(newPayload);
  const newRefreshToken = generateRefreshToken(newPayload);

  await updateAuthFields(user, { refreshToken: hashRefreshToken(newRefreshToken) });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
};

export const forgotPassword = async (identifier: string) => {
  const isEmail = identifier.includes('@');
  const method = isEmail ? 'email' as const : 'phone' as const;
  const emailCapability = isEmail ? getResetPasswordEmailCapability(identifier.toLowerCase()) : undefined;
  const smsCapability = isEmail ? undefined : getSmsDeliveryCapability();

  try {
    assertAuthIdentifierNotThrottled('forgot-password', identifier);
  } catch {
    return {
      method,
      ...(emailCapability ? { delivery: emailCapability } : {}),
      ...(smsCapability ? { delivery: smsCapability } : {}),
    };
  }

  const query = isEmail ? { email: identifier.toLowerCase() } : { phone: identifier };

  const user = await User.findOne(query);
  if (!user) {
    return {
      method,
      ...(emailCapability ? { delivery: emailCapability } : {}),
      ...(smsCapability ? { delivery: smsCapability } : {}),
    };
  }

  if (isEmail) {
    const resetToken = emailCapability?.testToken ?? crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const previousResetToken = user.resetPasswordToken ?? null;
    const previousResetExpiry = user.resetPasswordExpires ?? null;

    await updateAuthFields(user, {
      resetPasswordToken: hashedToken,
      resetPasswordExpires: new Date(Date.now() + 15 * 60 * 1000),
    });

    try {
      const delivery = await sendResetPasswordEmail(user.email, resetToken);
      return { method, delivery };
    } catch (error) {
      await updateAuthFields(user, {
        resetPasswordToken: previousResetToken,
        resetPasswordExpires: previousResetExpiry,
      });
      throw error;
    }
  } else {
    const delivery = await sendOtpSms(user.phone);
    return {
      method,
      delivery: {
        mode: delivery.mode,
        provider: delivery.provider,
        ...(delivery.testOtp ? { testOtp: delivery.testOtp } : {}),
      },
    };
  }
};

export const resetPassword = async (identifier: string, token: string, newPassword: string) => {
  const isEmail = identifier.includes('@');
  
  let user;
  if (isEmail) {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    user = await User.findOne({
      email: identifier.toLowerCase(),
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() },
    });
    if (!user) {
      throw { status: 400, message: 'Token không hợp lệ hoặc đã hết hạn' };
    }
  } else {
    if (!(await verifyOtpToken(identifier, token))) {
      throw { status: 400, message: 'Mã xác thực không hợp lệ hoặc đã hết hạn' };
    }
    user = await User.findOne({ phone: identifier });
    if (!user) {
      throw { status: 400, message: 'Người dùng không tồn tại' };
    }
  }

  const isSamePassword = await comparePassword(newPassword, user.password);
  if (isSamePassword) {
    throw { status: 400, message: 'Mật khẩu mới không được trùng với mật khẩu hiện tại' };
  }

  await updateAuthFields(user, {
    password: await hashPassword(newPassword),
    resetPasswordToken: null,
    resetPasswordExpires: null,
    refreshToken: null,
    mustChangePassword: false,
    passwordChangedAt: new Date(),
  });
};

export const changePassword = async (userId: string, currentPassword: string, newPassword: string) => {
  const user = await User.findById(userId);
  if (!user) {
    throw { status: 404, message: 'Người dùng không tồn tại' };
  }

  const isPasswordValid = await comparePassword(currentPassword, user.password);
  if (!isPasswordValid) {
    throw { status: 400, message: 'Mật khẩu hiện tại không đúng' };
  }

  const isSamePassword = await comparePassword(newPassword, user.password);
  if (isSamePassword) {
    throw { status: 400, message: 'Mật khẩu mới không được trùng với mật khẩu hiện tại' };
  }

  await updateAuthFields(user, {
    password: await hashPassword(newPassword),
    refreshToken: null,
    mustChangePassword: false,
    passwordChangedAt: new Date(),
  });
};

const googleClient = process.env.GOOGLE_CLIENT_ID
  ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
  : null;

const generateUserTokens = async (user: IUser) => {
  const payload: JwtPayload = { userId: user._id.toString(), email: user.email, role: user.role };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  await updateAuthFields(user, { refreshToken: hashRefreshToken(refreshToken), lastLoginAt: new Date() });

  return {
    accessToken,
    refreshToken,
    user: toSessionUser(user),
  };
};

export const socialLogin = async (provider: AuthProviderName, idToken: string) => {
  if (provider === 'google') {
    return googleLogin(idToken);
  }
  if (provider === 'facebook') {
    return facebookLogin(idToken);
  }
  throw { status: 400, message: `Đăng nhập qua ${provider} chưa được hỗ trợ` };
};

const googleLogin = async (idToken: string) => {
  if (!googleClient) {
    throw { status: 500, message: 'Google Sign-In chưa được cấu hình' };
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    throw { status: 400, message: 'Google token không hợp lệ' };
  }

  if (!payload || !payload.email) {
    throw { status: 400, message: 'Không thể xác thực với Google' };
  }

  const { sub: googleId, email, name } = payload;

  let user = await User.findOne({ 'authProviders.provider': 'google', 'authProviders.providerId': googleId });

  if (!user) {
    user = await User.findOne({ email: email.toLowerCase() });

    if (user) {
      await linkAuthProvider(user, 'google', googleId!);
    } else {
      user = await createSocialUser({
        provider: 'google',
        providerId: googleId!,
        name: name || email.split('@')[0],
        email: email.toLowerCase(),
      });
    }
  }

  if (!user.isActive) {
    throw { status: 403, message: 'Tài khoản không còn hoạt động' };
  }

  return generateUserTokens(user);
};

const facebookLogin = async (accessToken: string) => {
  const appId = process.env.FACEBOOK_APP_ID?.trim();
  const appSecret = process.env.FACEBOOK_APP_SECRET?.trim();

  if (!appId || !appSecret) {
    throw { status: 500, message: 'Facebook Sign-In chưa được cấu hình' };
  }

  let fbUser;
  try {
    const debugResponse = await fetch(
      `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(`${appId}|${appSecret}`)}`,
    );
    const debugPayload = await debugResponse.json();
    const debugData = debugPayload?.data;

    if (!debugData?.is_valid || debugData.app_id !== appId || !debugData.user_id) {
      throw new Error('Invalid Facebook token');
    }

    const response = await fetch(
      `https://graph.facebook.com/me?fields=id,name,email&access_token=${accessToken}`,
    );
    fbUser = await response.json();

    if (fbUser.error) {
      throw new Error(fbUser.error.message);
    }

    if (!fbUser.id || fbUser.id !== debugData.user_id) {
      throw new Error('Invalid Facebook token');
    }
  } catch {
    throw { status: 400, message: 'Facebook token không hợp lệ' };
  }

  const { id: facebookId, name, email } = fbUser;
  const userEmail = email || `${facebookId}@facebook.com`;

  let user = await User.findOne({ 'authProviders.provider': 'facebook', 'authProviders.providerId': facebookId });

  if (!user) {
    if (email) {
      user = await User.findOne({ email: email.toLowerCase() });
    }

    if (user) {
      await linkAuthProvider(user, 'facebook', facebookId);
    } else {
      user = await createSocialUser({
        provider: 'facebook',
        providerId: facebookId,
        name: name || `Facebook User`,
        email: userEmail.toLowerCase(),
      });
    }
  }

  if (!user.isActive) {
    throw { status: 403, message: 'Tài khoản không còn hoạt động' };
  }

  return generateUserTokens(user);
};
