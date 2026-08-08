import { Request, Response } from 'express';
import * as authService from './auth.service';
import {
  applyRefreshTokenCookieMode,
  clearRefreshTokenCookie,
  getRefreshTokenFromCookie,
  isRefreshTokenCookieMode,
} from './refresh-token-cookie';
import {
  validateSendOtp,
  validateVerifyOtp,
  validateRegister,
  validateLogin,
  validateLoginUnlockRequest,
  validateLoginUnlockVerify,
  validateForgotPassword,
  validateResetPassword,
  validateChangePassword,
} from '../../validators/auth.validator';
import { ok, created, noContent } from '../../utils/response';
import { isSmsDeliveryError } from '../../utils/sms-provider';
import { isEmailDeliveryError } from '../../utils/email-provider';
import { LoginSecurityError } from './login-security.service';

const sendLoginSecurityError = (res: Response, err: unknown) => {
  if (!(err instanceof LoginSecurityError)) return null;
  const retryAfterSeconds = err.data?.retryAfterSeconds;
  if (typeof retryAfterSeconds === 'number') {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil(retryAfterSeconds))));
  }
  return res.status(err.status).json({
    message: err.message,
    errorCode: err.errorCode,
    ...(err.data ? { data: err.data } : {}),
  });
};

const getBearerToken = (req: Request) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.slice('Bearer '.length).trim() || null;
};

const getRefreshTokenFromBody = (req: Request) => {
  const token = req.body?.refreshToken;
  return typeof token === 'string' && token.trim() ? token.trim() : null;
};

const getRequestRefreshToken = (req: Request) =>
  getRefreshTokenFromBody(req) ?? (isRefreshTokenCookieMode(req) ? getRefreshTokenFromCookie(req) : null);

export const sendOtp = async (req: Request, res: Response) => {
  const errors = validateSendOtp(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ message: 'Dữ liệu không hợp lệ', errors });
  }

  try {
    const delivery = await authService.sendOtp(req.body.phone);
    return ok(res, delivery, 'Nếu số điện thoại có thể đăng ký, mã OTP đã được gửi');
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err && 'message' in err) {
      return res.status((err as { status: number }).status).json({ message: (err as { message: string }).message });
    }
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

export const verifyOtp = async (req: Request, res: Response) => {
  const errors = validateVerifyOtp(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ message: 'Dữ liệu không hợp lệ', errors });
  }

  try {
    const token = await authService.verifyOtp(req.body.phone, req.body.otp);
    return ok(res, { otpToken: token }, 'Xác thực OTP thành công');
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err && 'message' in err) {
      return res.status((err as { status: number }).status).json({ message: (err as { message: string }).message });
    }
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

export const register = async (req: Request, res: Response) => {
  const errors = validateRegister(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ message: 'Dữ liệu không hợp lệ', errors });
  }

  try {
    const result = await authService.registerUser(req.body);
    return created(res, applyRefreshTokenCookieMode(req, res, result), 'Đăng ký thành công');
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err && 'message' in err) {
      return res.status((err as { status: number }).status).json({ message: (err as { message: string }).message });
    }
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

export const login = async (req: Request, res: Response) => {
  const errors = validateLogin(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ message: 'Dữ liệu không hợp lệ', errors });
  }

  try {
    const result = await authService.loginUser(req.body.identifier, req.body.password);
    return ok(res, applyRefreshTokenCookieMode(req, res, result), 'Đăng nhập thành công');
  } catch (err: unknown) {
    const securityResponse = sendLoginSecurityError(res, err);
    if (securityResponse) return securityResponse;
    if (err && typeof err === 'object' && 'status' in err && 'message' in err) {
      return res.status((err as { status: number }).status).json({ message: (err as { message: string }).message });
    }
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

export const requestLoginUnlock = async (req: Request, res: Response) => {
  const errors = validateLoginUnlockRequest(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ message: 'Dữ liệu không hợp lệ', errors });
  }

  const isEmail = req.body.channel
    ? req.body.channel === 'email'
    : req.body.identifier.trim().includes('@');
  const message = isEmail
    ? 'Nếu tài khoản đang bị khóa, mã OTP đã được gửi qua email.'
    : 'Nếu tài khoản đang bị khóa, mã OTP đã được gửi qua SMS.';

  try {
    return ok(res, await authService.requestLoginUnlock(req.body.identifier, req.body.channel), message);
  } catch (err) {
    const securityResponse = sendLoginSecurityError(res, err);
    if (securityResponse) return securityResponse;
    if (isEmailDeliveryError(err)) {
      return res.status(err.status).json({
        message: 'Không thể gửi email mở khóa lúc này. Vui lòng thử lại sau.',
        errorCode: err.code,
      });
    }
    if (isSmsDeliveryError(err)) {
      return res.status(err.status).json({
        message: 'Không thể gửi mã OTP lúc này. Vui lòng thử lại sau.',
        errorCode: err.code,
      });
    }
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

export const verifyLoginUnlock = async (req: Request, res: Response) => {
  const errors = validateLoginUnlockVerify(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ message: 'Dữ liệu không hợp lệ', errors });
  }

  try {
    await authService.verifyLoginUnlock(req.body.identifier, req.body.otp);
    return ok(res, null, 'Mở khóa đăng nhập thành công. Vui lòng đăng nhập lại.');
  } catch (err) {
    const securityResponse = sendLoginSecurityError(res, err);
    if (securityResponse) return securityResponse;
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

export const adminLogin = async (req: Request, res: Response) => {
  const errors = validateLogin(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ message: 'Dữ liệu không hợp lệ', errors });
  }

  try {
    const result = await authService.loginAdminUser(req.body.identifier, req.body.password);
    return ok(res, applyRefreshTokenCookieMode(req, res, result), 'Đăng nhập quản trị thành công');
  } catch (err: unknown) {
    const securityResponse = sendLoginSecurityError(res, err);
    if (securityResponse) return securityResponse;
    if (err && typeof err === 'object' && 'status' in err && 'message' in err) {
      return res.status((err as { status: number }).status).json({ message: (err as { message: string }).message });
    }
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

export const logout = async (req: Request, res: Response) => {
  const useRefreshTokenCookie = isRefreshTokenCookieMode(req);

  try {
    if (req.user?.userId) {
      await authService.logoutUser(req.user.userId);
    } else {
      const accessToken = getBearerToken(req);
      const refreshToken = getRequestRefreshToken(req);

      if (accessToken) {
        try {
          await authService.logoutWithAccessToken(accessToken);
        } catch (accessTokenError) {
          if (!refreshToken) throw accessTokenError;
          await authService.logoutWithRefreshToken(refreshToken);
        }
      } else if (refreshToken) {
        await authService.logoutWithRefreshToken(refreshToken);
      }
    }

    if (useRefreshTokenCookie) {
      clearRefreshTokenCookie(res);
    }
    return noContent(res);
  } catch {
    if (useRefreshTokenCookie) {
      clearRefreshTokenCookie(res);
    }
    return noContent(res);
  }
};

export const refreshToken = async (req: Request, res: Response) => {
  const token = getRequestRefreshToken(req);

  if (!token) {
    return res.status(400).json({ message: 'Refresh token là bắt buộc' });
  }

  try {
    const result = await authService.refreshAccessToken(token);
    return ok(res, applyRefreshTokenCookieMode(req, res, result), 'Token đã được làm mới');
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err && 'message' in err) {
      return res.status((err as { status: number }).status).json({ message: (err as { message: string }).message });
    }
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  const errors = validateForgotPassword(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ message: 'Dữ liệu không hợp lệ', errors });
  }

  const isEmail = req.body.identifier.includes('@');
  const msg = isEmail 
    ? 'Nếu tài khoản tồn tại, email khôi phục mật khẩu đã được gửi' 
    : 'Nếu tài khoản tồn tại, mã OTP đã được gửi qua SMS';

  try {
    const result = await authService.forgotPassword(req.body.identifier);
    return ok(res, result, msg);
  } catch (err) {
    if (isEmailDeliveryError(err)) {
      return res.status(err.status).json({
        message: 'Không thể gửi email khôi phục lúc này. Vui lòng thử lại sau.',
        errorCode: err.code,
      });
    }
    if (isSmsDeliveryError(err)) {
      return res.status(err.status).json({
        message: 'Không thể gửi mã OTP lúc này. Vui lòng thử lại sau.',
        errorCode: err.code,
      });
    }
    return ok(res, { method: isEmail ? 'email' : 'phone' }, msg);
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  const errors = validateResetPassword(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ message: 'Dữ liệu không hợp lệ', errors });
  }

  try {
    await authService.resetPassword(req.body.identifier, req.body.token, req.body.newPassword);
    return ok(res, null, 'Đặt lại mật khẩu thành công');
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err && 'message' in err) {
      return res.status((err as { status: number }).status).json({ message: (err as { message: string }).message });
    }
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

export const changePassword = async (req: Request, res: Response) => {
  const errors = validateChangePassword(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ message: 'Dữ liệu không hợp lệ', errors });
  }

  try {
    await authService.changePassword(req.user!.userId, req.body.currentPassword, req.body.newPassword);
    return ok(res, null, 'Đổi mật khẩu thành công');
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err && 'message' in err) {
      return res.status((err as { status: number }).status).json({ message: (err as { message: string }).message });
    }
    return res.status(500).json({ message: 'Lỗi server' });
  }
};
