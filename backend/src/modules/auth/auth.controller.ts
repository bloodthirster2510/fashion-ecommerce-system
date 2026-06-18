import { Request, Response } from 'express';
import * as authService from './auth.service';
import {
  validateSendOtp,
  validateVerifyOtp,
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateChangePassword,
} from '../../validators/auth.validator';
import { ok, created, noContent } from '../../utils/response';

export const sendOtp = async (req: Request, res: Response) => {
  const errors = validateSendOtp(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ message: 'Dữ liệu không hợp lệ', errors });
  }

  try {
    await authService.sendOtp(req.body.phone);
    return ok(res, null, 'Mã OTP đã được gửi');
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
    const token = authService.verifyOtp(req.body.phone, req.body.otp);
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
    return created(res, result, 'Đăng ký thành công');
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
    return ok(res, result, 'Đăng nhập thành công');
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err && 'message' in err) {
      return res.status((err as { status: number }).status).json({ message: (err as { message: string }).message });
    }
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

export const adminLogin = async (req: Request, res: Response) => {
  const errors = validateLogin(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ message: 'Dá»¯ liá»‡u khÃ´ng há»£p lá»‡', errors });
  }

  try {
    const result = await authService.loginAdminUser(req.body.identifier, req.body.password);
    return ok(res, result, 'ÄÄƒng nháº­p quáº£n trá»‹ thÃ nh cÃ´ng');
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err && 'message' in err) {
      return res.status((err as { status: number }).status).json({ message: (err as { message: string }).message });
    }
    return res.status(500).json({ message: 'Lá»—i server' });
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    await authService.logoutUser(req.user!.userId);
    return noContent(res);
  } catch {
    return noContent(res);
  }
};

export const refreshToken = async (req: Request, res: Response) => {
  const { refreshToken: token } = req.body;

  if (!token) {
    return res.status(400).json({ message: 'Refresh token là bắt buộc' });
  }

  try {
    const result = await authService.refreshAccessToken(token);
    return ok(res, result, 'Token đã được làm mới');
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
    await authService.forgotPassword(req.body.identifier);
    return ok(res, { method: isEmail ? 'email' : 'phone' }, msg);
  } catch {
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

export const socialLogin = async (req: Request, res: Response) => {
  const { provider, idToken } = req.body;

  if (!provider || !idToken) {
    return res.status(400).json({ message: 'provider và idToken là bắt buộc' });
  }

  if (!['google', 'facebook', 'apple'].includes(provider)) {
    return res.status(400).json({ message: 'Provider không hợp lệ' });
  }

  try {
    const result = await authService.socialLogin(provider, idToken);
    return ok(res, result, 'Đăng nhập thành công');
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err && 'message' in err) {
      return res.status((err as { status: number }).status).json({ message: (err as { message: string }).message });
    }
    return res.status(500).json({ message: 'Lỗi server' });
  }
};
