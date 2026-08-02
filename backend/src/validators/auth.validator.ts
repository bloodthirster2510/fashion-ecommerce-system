import { LEGAL_POLICY_VERSION } from '../modules/auth/legal-policy';

const vietnamPhoneRegex = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ValidationError {
  field: string;
  message: string;
}

export const validateSendOtp = (body: Record<string, unknown>): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (!body.phone || typeof body.phone !== 'string' || !vietnamPhoneRegex.test(body.phone.trim())) {
    errors.push({ field: 'phone', message: 'Số điện thoại không đúng định dạng' });
  }

  return errors;
};

export const validateVerifyOtp = (body: Record<string, unknown>): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (!body.phone || typeof body.phone !== 'string' || !vietnamPhoneRegex.test(body.phone.trim())) {
    errors.push({ field: 'phone', message: 'Số điện thoại không đúng định dạng' });
  }

  if (!body.otp || typeof body.otp !== 'string' || body.otp.trim().length === 0) {
    errors.push({ field: 'otp', message: 'Vui lòng nhập mã OTP' });
  }

  return errors;
};

export const validateRegister = (body: Record<string, unknown>): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (!body.name || typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 60) {
    errors.push({ field: 'name', message: 'Họ tên từ 2 đến 60 ký tự' });
  }

  if (!body.phone || typeof body.phone !== 'string' || !vietnamPhoneRegex.test(body.phone.trim())) {
    errors.push({ field: 'phone', message: 'Số điện thoại không đúng định dạng' });
  }

  if (!body.email || typeof body.email !== 'string' || !emailRegex.test(body.email.trim())) {
    errors.push({ field: 'email', message: 'Email không đúng định dạng' });
  }

  if (!body.gender || !['male', 'female'].includes(body.gender as string)) {
    errors.push({ field: 'gender', message: 'Giới tính phải là male hoặc female' });
  }

  if (!body.dateOfBirth || typeof body.dateOfBirth !== 'string' || isNaN(Date.parse(body.dateOfBirth as string))) {
    errors.push({ field: 'dateOfBirth', message: 'Ngày sinh không hợp lệ' });
  }

  if (!body.password || typeof body.password !== 'string' || body.password.length < 8) {
    errors.push({ field: 'password', message: 'Mật khẩu tối thiểu 8 ký tự' });
  }

  if (body.password !== body.confirmPassword) {
    errors.push({ field: 'confirmPassword', message: 'Xác nhận mật khẩu không trùng khớp' });
  }

  if (!body.otpToken || typeof body.otpToken !== 'string' || body.otpToken.trim().length === 0) {
    errors.push({ field: 'otpToken', message: 'OTP chưa được xác thực' });
  }

  if (body.acceptedTerms !== true) {
    errors.push({ field: 'acceptedTerms', message: 'Bạn cần đồng ý với điều khoản và chính sách bảo mật' });
  }

  if (body.policyVersion !== LEGAL_POLICY_VERSION) {
    errors.push({ field: 'policyVersion', message: 'Phiên bản chính sách không hợp lệ, vui lòng tải lại trang' });
  }

  return errors;
};

export const validateLogin = (body: Record<string, unknown>): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (!body.identifier || typeof body.identifier !== 'string' || body.identifier.trim().length === 0) {
    errors.push({ field: 'identifier', message: 'Vui lòng nhập email hoặc số điện thoại' });
  }

  if (!body.password || typeof body.password !== 'string' || body.password.length === 0) {
    errors.push({ field: 'password', message: 'Vui lòng nhập mật khẩu' });
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
