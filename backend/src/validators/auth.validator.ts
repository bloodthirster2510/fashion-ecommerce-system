import { LEGAL_POLICY_VERSION } from '../modules/auth/legal-policy';
import { customerBirthDateMessage, isValidCustomerBirthDate } from './birth-date.validator';

const vietnamPhoneRegex = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ValidationError {
  field: string;
  message: string;
}

const getRequestBody = (body: Record<string, unknown> | null | undefined): Record<string, unknown> =>
  body ?? {};

export const validateSendOtp = (body: Record<string, unknown> | null | undefined): ValidationError[] => {
  const requestBody = getRequestBody(body);
  const errors: ValidationError[] = [];

  if (!requestBody.phone || typeof requestBody.phone !== 'string' || !vietnamPhoneRegex.test(requestBody.phone.trim())) {
    errors.push({ field: 'phone', message: 'Số điện thoại không đúng định dạng' });
  }

  return errors;
};

export const validateVerifyOtp = (body: Record<string, unknown> | null | undefined): ValidationError[] => {
  const requestBody = getRequestBody(body);
  const errors: ValidationError[] = [];

  if (!requestBody.phone || typeof requestBody.phone !== 'string' || !vietnamPhoneRegex.test(requestBody.phone.trim())) {
    errors.push({ field: 'phone', message: 'Số điện thoại không đúng định dạng' });
  }

  if (!requestBody.otp || typeof requestBody.otp !== 'string' || !/^\d{6}$/.test(requestBody.otp.trim())) {
    errors.push({ field: 'otp', message: 'Mã OTP phải gồm 6 chữ số' });
  }

  return errors;
};

export const validateRegister = (body: Record<string, unknown> | null | undefined): ValidationError[] => {
  const requestBody = getRequestBody(body);
  const errors: ValidationError[] = [];

  if (!requestBody.name || typeof requestBody.name !== 'string' || requestBody.name.trim().length < 2 || requestBody.name.trim().length > 60) {
    errors.push({ field: 'name', message: 'Họ tên từ 2 đến 60 ký tự' });
  }

  if (!requestBody.phone || typeof requestBody.phone !== 'string' || !vietnamPhoneRegex.test(requestBody.phone.trim())) {
    errors.push({ field: 'phone', message: 'Số điện thoại không đúng định dạng' });
  }

  if (
    requestBody.email !== undefined
    && requestBody.email !== null
    && String(requestBody.email).trim().length > 0
    && (typeof requestBody.email !== 'string' || !emailRegex.test(requestBody.email.trim()))
  ) {
    errors.push({ field: 'email', message: 'Email không đúng định dạng' });
  }

  if (!requestBody.gender || !['male', 'female'].includes(requestBody.gender as string)) {
    errors.push({ field: 'gender', message: 'Giới tính phải là male hoặc female' });
  }

  if (!isValidCustomerBirthDate(requestBody.dateOfBirth)) {
    errors.push({ field: 'dateOfBirth', message: customerBirthDateMessage });
  }

  if (!requestBody.password || typeof requestBody.password !== 'string' || requestBody.password.length < 8) {
    errors.push({ field: 'password', message: 'Mật khẩu tối thiểu 8 ký tự' });
  }

  if (requestBody.password !== requestBody.confirmPassword) {
    errors.push({ field: 'confirmPassword', message: 'Xác nhận mật khẩu không trùng khớp' });
  }

  if (!requestBody.otpToken || typeof requestBody.otpToken !== 'string' || requestBody.otpToken.trim().length === 0) {
    errors.push({ field: 'otpToken', message: 'OTP chưa được xác thực' });
  }

  if (requestBody.acceptedTerms !== true) {
    errors.push({ field: 'acceptedTerms', message: 'Bạn cần đồng ý với điều khoản và chính sách bảo mật' });
  }

  if (requestBody.policyVersion !== LEGAL_POLICY_VERSION) {
    errors.push({ field: 'policyVersion', message: 'Phiên bản chính sách không hợp lệ, vui lòng tải lại trang' });
  }

  return errors;
};

export const validateLogin = (body: Record<string, unknown>): ValidationError[] => {
  const errors: ValidationError[] = [];
  const identifier = typeof body.identifier === 'string' ? body.identifier.trim() : '';

  if (!identifier) {
    errors.push({ field: 'identifier', message: 'Vui lòng nhập email hoặc số điện thoại.' });
  } else if (!emailRegex.test(identifier) && !vietnamPhoneRegex.test(identifier)) {
    errors.push({ field: 'identifier', message: 'Email hoặc số điện thoại không hợp lệ.' });
  }

  if (!body.password || typeof body.password !== 'string' || body.password.length === 0) {
    errors.push({ field: 'password', message: 'Vui lòng nhập mật khẩu.' });
  }

  return errors;
};

export const validateLoginUnlockRequest = (body: Record<string, unknown>): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (!body.identifier || typeof body.identifier !== 'string' || body.identifier.trim().length === 0) {
    errors.push({ field: 'identifier', message: 'Vui lòng nhập email hoặc số điện thoại' });
  }

  if (body.channel !== undefined && !['email', 'phone'].includes(String(body.channel))) {
    errors.push({ field: 'channel', message: 'Kênh nhận OTP không hợp lệ' });
  }

  return errors;
};

export const validateLoginUnlockVerify = (body: Record<string, unknown>): ValidationError[] => {
  const errors = validateLoginUnlockRequest(body);

  if (!body.otp || typeof body.otp !== 'string' || !/^\d{6}$/.test(body.otp.trim())) {
    errors.push({ field: 'otp', message: 'Mã OTP phải gồm 6 chữ số' });
  }

  return errors;
};

export const validateForgotPassword = (body: Record<string, unknown>): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (!body.identifier || typeof body.identifier !== 'string' || body.identifier.trim().length === 0) {
    errors.push({ field: 'identifier', message: 'Vui lòng nhập email hoặc số điện thoại' });
  }

  return errors;
};

export const validateResetPassword = (body: Record<string, unknown>): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (!body.identifier || typeof body.identifier !== 'string' || body.identifier.trim().length === 0) {
    errors.push({ field: 'identifier', message: 'Vui lòng nhập email hoặc số điện thoại' });
  }

  if (!body.token || typeof body.token !== 'string' || body.token.trim().length === 0) {
    errors.push({ field: 'token', message: 'Token hoặc mã xác thực không hợp lệ' });
  }

  if (!body.newPassword || typeof body.newPassword !== 'string' || body.newPassword.length < 8) {
    errors.push({ field: 'newPassword', message: 'Mật khẩu mới tối thiểu 8 ký tự' });
  }

  if (body.newPassword !== body.confirmPassword) {
    errors.push({ field: 'confirmPassword', message: 'Xác nhận mật khẩu không trùng khớp' });
  }

  return errors;
};

export const validateChangePassword = (body: Record<string, unknown>): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (!body.currentPassword || typeof body.currentPassword !== 'string' || body.currentPassword.length === 0) {
    errors.push({ field: 'currentPassword', message: 'Vui lòng nhập mật khẩu hiện tại' });
  }

  if (!body.newPassword || typeof body.newPassword !== 'string' || body.newPassword.length < 8) {
    errors.push({ field: 'newPassword', message: 'Mật khẩu mới tối thiểu 8 ký tự' });
  }

  if (body.newPassword !== body.confirmPassword) {
    errors.push({ field: 'confirmPassword', message: 'Xác nhận mật khẩu không trùng khớp' });
  }

  return errors;
};
