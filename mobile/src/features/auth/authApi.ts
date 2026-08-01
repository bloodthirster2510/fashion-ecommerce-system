import { apiFetch } from '../../config/api';
import type {
  ApiValidationError,
  ApiResponse,
  UserAddressPayload,
  RegisterPayload,
  AuthSession,
  OtpDeliveryInfo,
  PasswordRecoveryResult,
  LoginUnlockResult,
} from './types';
import { AuthApiError } from './types';

export type { ApiValidationError, UserAddressPayload, RegisterPayload, AuthSession };
export { AuthApiError };

const parseApiResponse = <T>(text: string): ApiResponse<T> => {
  if (!text) return {};

  if (/^\s*<!doctype html/i.test(text) || /^\s*<html[\s>]/i.test(text)) {
    return { message: 'Máy chủ đang chạy chưa đúng API đăng nhập. Vui lòng khởi động lại backend.' };
  }

  try {
    return JSON.parse(text) as ApiResponse<T>;
  } catch {
    return { message: text };
  }
};

const post = async <T>(path: string, body: Record<string, unknown>, accessToken?: string): Promise<T> => {
  const response = await apiFetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const payload = parseApiResponse<T>(await response.text());

  if (!response.ok) {
    const validationMessage = payload.errors?.map((error: ApiValidationError) => error.message).join('\n');
    throw new AuthApiError(
      validationMessage || payload.message || 'Không thể kết nối máy chủ',
      payload.errors,
      response.status,
      payload.errorCode,
      payload.data,
    );
  }

  return payload.data as T;
};

export const authApi = {
  sendOtp: (phone: string) => post<OtpDeliveryInfo>('/auth/send-otp', { phone }),
  verifyOtp: (phone: string, otp: string) => post<{ otpToken: string }>('/auth/verify-otp', { phone, otp }),
  register: (payload: RegisterPayload) => post<AuthSession>('/auth/register', payload),
  login: (identifier: string, password: string) => post<AuthSession>('/auth/login', { identifier, password }),
  requestLoginUnlock: (identifier: string, channel: 'email' | 'phone') =>
    post<LoginUnlockResult>('/auth/login/unlock/request', { identifier, channel }),
  verifyLoginUnlock: (identifier: string, otp: string) =>
    post<null>('/auth/login/unlock/verify', { identifier, otp }),
  logout: (accessToken: string) => post<null>('/auth/logout', {}, accessToken),
  refreshToken: (refreshToken: string) =>
    post<{ accessToken: string; refreshToken: string }>('/auth/refresh-token', { refreshToken }),
  forgotPassword: (identifier: string) =>
    post<PasswordRecoveryResult>('/auth/forgot-password', { identifier }),
  resetPassword: (identifier: string, token: string, newPassword: string, confirmPassword: string) =>
    post<null>('/auth/reset-password', { identifier, token, newPassword, confirmPassword }),
  changePassword: (accessToken: string, currentPassword: string, newPassword: string, confirmPassword: string) =>
    post<null>('/auth/change-password', { currentPassword, newPassword, confirmPassword }, accessToken),
  socialLogin: (provider: string, idToken: string) => post<AuthSession>('/auth/social-login', { provider, idToken }),
};
