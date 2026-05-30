import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { User, type AuthProviderName, type IUser } from '../../database/models/user.model';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken, JwtPayload } from '../../utils/jwt';
import { sendResetPasswordEmail } from '../../utils/email';
import { sendOtpSms, verifyOtpCode, verifyOtpToken } from '../../utils/sms';

const SALT_ROUNDS = 10;

const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const sendOtp = async (phone: string) => {
  const existingUser = await User.findOne({ phone });
  if (existingUser) {
    throw { status: 409, message: 'Số điện thoại đã được sử dụng' };
  }

  await sendOtpSms(phone);
};

export const verifyOtp = (phone: string, otp: string): string => {
  const token = verifyOtpCode(phone, otp);
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
  address: {
    customerName: string;
    province: string;
    district: string;
    ward: string;
    streetName: string;
    phoneNumber: string;
    isDefault: boolean;
  };
  otpToken: string;
}) => {
  if (!verifyOtpToken(data.phone, data.otpToken)) {
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

  const user = await User.create({
    name: data.name,
    email: data.email.toLowerCase(),
    password: hashedPassword,
    phone: data.phone,
    gender: data.gender,
    dateOfBirth: new Date(data.dateOfBirth),
    role: 'user',
    isActive: true,
    address: [
      {
        customerName: data.address.customerName,
        province: data.address.province,
        district: data.address.district,
        ward: data.address.ward,
        streetName: data.address.streetName,
        phoneNumber: data.address.phoneNumber,
        isDefault: true,
      },
    ],
  });

  const payload: JwtPayload = { userId: user._id.toString(), email: user.email, role: user.role };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  user.refreshToken = refreshToken;
  await user.save();

  return {
    accessToken,
    refreshToken,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      avatarImage: user.avatarImage ?? null,
    },
  };
};

export const loginUser = async (identifier: string, password: string) => {
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

  const payload: JwtPayload = { userId: user._id.toString(), email: user.email, role: user.role };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  user.refreshToken = refreshToken;
  await user.save();

  return {
    accessToken,
    refreshToken,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      avatarImage: user.avatarImage ?? null,
    },
  };
};

export const logoutUser = async (userId: string) => {
  const user = await User.findById(userId);
  if (user) {
    user.refreshToken = null;
    await user.save();
  }
};

export const refreshAccessToken = async (token: string) => {
  let payload: JwtPayload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw { status: 401, message: 'Refresh token không hợp lệ hoặc đã hết hạn' };
  }

  const user = await User.findById(payload.userId);
  if (!user || user.refreshToken !== token) {
    throw { status: 401, message: 'Refresh token không hợp lệ' };
  }

  const newPayload: JwtPayload = { userId: user._id.toString(), email: user.email, role: user.role };
  const newAccessToken = generateAccessToken(newPayload);
  const newRefreshToken = generateRefreshToken(newPayload);

  user.refreshToken = newRefreshToken;
  await user.save();

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
};

export const forgotPassword = async (identifier: string) => {
  const isEmail = identifier.includes('@');
  const query = isEmail ? { email: identifier.toLowerCase() } : { phone: identifier };

  const user = await User.findOne(query);
  if (!user) {
    return;
  }

  if (isEmail) {
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    await sendResetPasswordEmail(user.email, resetToken);
  } else {
    await sendOtpSms(user.phone);
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
    if (!verifyOtpToken(identifier, token)) {
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

  user.password = await hashPassword(newPassword);
  user.resetPasswordToken = null;
  user.resetPasswordExpires = null;
  user.refreshToken = null;
  await user.save();
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

  user.password = await hashPassword(newPassword);
  user.refreshToken = null;
  await user.save();
};

const googleClient = process.env.GOOGLE_CLIENT_ID
  ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
  : null;

const generateUserTokens = async (user: IUser) => {
  const payload: JwtPayload = { userId: user._id.toString(), email: user.email, role: user.role };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  user.refreshToken = refreshToken;
  await user.save();

  return {
    accessToken,
    refreshToken,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      avatarImage: user.avatarImage ?? null,
    },
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
      user.authProviders.push({ provider: 'google', providerId: googleId! });
      await user.save();
    } else {
      user = await User.create({
        name: name || email.split('@')[0],
        email: email.toLowerCase(),
        password: await hashPassword(crypto.randomBytes(32).toString('hex')),
        phone: '',
        gender: 'male',
        dateOfBirth: new Date('2000-01-01'),
        role: 'user',
        isActive: true,
        authProviders: [{ provider: 'google', providerId: googleId! }],
        address: [],
      });
    }
  }

  if (!user.isActive) {
    throw { status: 403, message: 'Tài khoản không còn hoạt động' };
  }

  return generateUserTokens(user);
};

const facebookLogin = async (accessToken: string) => {
  if (!process.env.FACEBOOK_APP_ID) {
    throw { status: 500, message: 'Facebook Sign-In chưa được cấu hình' };
  }

  let fbUser;
  try {
    const response = await fetch(
      `https://graph.facebook.com/me?fields=id,name,email&access_token=${accessToken}`,
    );
    fbUser = await response.json();

    if (fbUser.error) {
      throw new Error(fbUser.error.message);
    }

    if (!fbUser.id) {
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
      user.authProviders.push({ provider: 'facebook', providerId: facebookId });
      await user.save();
    } else {
      user = await User.create({
        name: name || `Facebook User`,
        email: userEmail.toLowerCase(),
        password: await hashPassword(crypto.randomBytes(32).toString('hex')),
        phone: '',
        gender: 'male',
        dateOfBirth: new Date('2000-01-01'),
        role: 'user',
        isActive: true,
        authProviders: [{ provider: 'facebook', providerId: facebookId }],
        address: [],
      });
    }
  }

  if (!user.isActive) {
    throw { status: 403, message: 'Tài khoản không còn hoạt động' };
  }

  return generateUserTokens(user);
};
