import { sendOtp, verifyOtp, registerUser, loginUser, loginAdminUser, getAdminSessionUser, logoutUser, refreshAccessToken, forgotPassword, resetPassword, changePassword, clearAuthRequestThrottleForTests } from '../auth.service';
import { LEGAL_POLICY_VERSION } from '../legal-policy';
import { User } from '../../../database/models/user.model';
import { PushToken } from '../../../database/models/push-token.model';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

jest.mock('../../../database/models/user.model');
jest.mock('../../../database/models/push-token.model');
jest.mock('../login-security.service', () => ({
  assertLoginAllowed: jest.fn(),
  clearLoginSecurity: jest.fn(),
  recordFailedLogin: jest.fn(),
  requestLoginUnlock: jest.fn(),
  verifyLoginUnlock: jest.fn(),
}));
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');
jest.mock('../../../utils/email', () => ({
  getResetPasswordEmailCapability: jest.fn(),
  sendResetPasswordEmail: jest.fn(),
}));
jest.mock('../../../utils/sms', () => ({
  sendOtpSms: jest.fn(),
  verifyOtpCode: jest.fn(),
  verifyOtpToken: jest.fn(),
}));

import { sendOtpSms, verifyOtpToken, verifyOtpCode } from '../../../utils/sms';
import {
  getResetPasswordEmailCapability,
  sendResetPasswordEmail,
} from '../../../utils/email';
import { EmailDeliveryError } from '../../../utils/email-provider';
import {
  assertLoginAllowed,
  clearLoginSecurity,
  recordFailedLogin,
} from '../login-security.service';
import { revokeSupportSocketAccess } from '../../realtime/support.gateway';

jest.mock('../../realtime/support.gateway', () => ({
  revokeSupportSocketAccess: jest.fn(),
}));

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

describe('Auth Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.NODE_ENV = 'test';
    process.env.SMS_PROVIDER = 'mock';
    process.env.SMS_MOCK_OTP = '123456';
    (getResetPasswordEmailCapability as jest.Mock).mockReturnValue({
      mode: 'mock',
      provider: 'mock',
      testToken: 'mock-reset-token-0000000000000001',
      testUrl: 'fashion-ecommerce://reset-password?identifier=test%40test.com&token=mock-reset-token-0000000000000001',
    });
    (sendResetPasswordEmail as jest.Mock).mockResolvedValue({
      mode: 'mock',
      provider: 'mock',
      testToken: 'mock-reset-token-0000000000000001',
      testUrl: 'fashion-ecommerce://reset-password?identifier=test%40test.com&token=mock-reset-token-0000000000000001',
    });
    (sendOtpSms as jest.Mock).mockResolvedValue({
      mode: 'mock',
      provider: 'mock',
      testOtp: '123456',
    });
    (assertLoginAllowed as jest.Mock).mockResolvedValue(undefined);
    (recordFailedLogin as jest.Mock).mockResolvedValue(undefined);
    (clearLoginSecurity as jest.Mock).mockResolvedValue(undefined);
    clearAuthRequestThrottleForTests();
  });

  describe('sendOtp', () => {
    it('should not reveal whether phone already exists', async () => {
      (User.findOne as jest.Mock).mockResolvedValue({ phone: '0900000000' });
      await expect(sendOtp('0900000000')).resolves.toEqual({
        mode: 'mock',
        provider: 'mock',
        testOtp: '123456',
      });
      expect(sendOtpSms).not.toHaveBeenCalled();
    });

    it('should send OTP successfully', async () => {
      (User.findOne as jest.Mock).mockResolvedValue(null);
      await expect(sendOtp('0900000000')).resolves.toEqual({
        mode: 'mock',
        provider: 'mock',
        testOtp: '123456',
      });
    });

    it('should throttle repeated OTP requests before user lookup', async () => {
      (User.findOne as jest.Mock).mockResolvedValue(null);

      await expect(sendOtp('0900000001')).resolves.toEqual({
        mode: 'mock',
        provider: 'mock',
        testOtp: '123456',
      });
      await expect(sendOtp('0900000001')).rejects.toMatchObject({ status: 429 });

      expect(User.findOne).toHaveBeenCalledTimes(1);
      expect(sendOtpSms).toHaveBeenCalledTimes(1);
    });
  });

  describe('verifyOtp', () => {
    it('should throw if OTP is invalid', async () => {
      (verifyOtpCode as jest.Mock).mockReturnValue(null);
      await expect(verifyOtp('0900000000', '123456')).rejects.toBeDefined();
    });

    it('should return token if OTP is valid', async () => {
      (verifyOtpCode as jest.Mock).mockReturnValue('otp_token_abc');
      const result = await verifyOtp('0900000000', '654321');
      expect(result).toBe('otp_token_abc');
    });
  });

  describe('registerUser', () => {
    it('should throw error if otpToken is invalid', async () => {
      (verifyOtpToken as jest.Mock).mockReturnValue(false);
      await expect(registerUser({
        name: 'Test',
        email: 'test@test.com',
        password: 'password123',
        phone: '0900000000',
        gender: 'male',
        dateOfBirth: '1990-01-01',
        otpToken: 'bad_token',
        acceptedTerms: true,
        policyVersion: LEGAL_POLICY_VERSION,
        address: {
          customerName: 'Test',
          province: 'Cần Thơ',
          provinceId: 92,
          district: 'Ninh Kiều',
          districtId: 789,
          ward: 'An Khánh',
          wardCode: '00123',
          streetName: '123 Đường 3/2',
          phoneNumber: '0900000000',
          isDefault: true,
        },
      })).rejects.toEqual({ status: 400, message: 'Số điện thoại chưa được xác thực' });
    });

    it('should throw error if email already exists', async () => {
      (verifyOtpToken as jest.Mock).mockReturnValue(true);
      (User.findOne as jest.Mock).mockResolvedValue({ email: 'test@test.com' });
      await expect(registerUser({
        name: 'Test',
        email: 'test@test.com',
        password: 'password123',
        phone: '0900000000',
        gender: 'male',
        dateOfBirth: '1990-01-01',
        otpToken: 'valid_token',
        acceptedTerms: true,
        policyVersion: LEGAL_POLICY_VERSION,
        address: {
          customerName: 'Test',
          province: 'Cần Thơ',
          provinceId: 92,
          district: 'Ninh Kiều',
          districtId: 789,
          ward: 'An Khánh',
          wardCode: '00123',
          streetName: '123 Đường 3/2',
          phoneNumber: '0900000000',
          isDefault: true,
        },
      })).rejects.toEqual({ status: 409, message: 'Email đã được sử dụng' });
    });

    it('should register user successfully', async () => {
      (verifyOtpToken as jest.Mock).mockReturnValue(true);
      (User.findOne as jest.Mock).mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');
      (jwt.sign as jest.Mock).mockReturnValueOnce('access_token').mockReturnValueOnce('refresh_token');
      const mockUser = {
        _id: { toString: () => 'user123' },
        name: 'Test',
        email: 'test@test.com',
        phone: '0900000000',
        role: 'user',
        save: jest.fn(),
        refreshToken: '',
      };
      (User.create as jest.Mock).mockResolvedValue(mockUser);

      const result = await registerUser({
        name: 'Test',
        email: 'test@test.com',
        password: 'password123',
        phone: '0900000000',
        gender: 'male',
        dateOfBirth: '1990-01-01',
        otpToken: 'valid_token',
        acceptedTerms: true,
        policyVersion: LEGAL_POLICY_VERSION,
        address: {
          customerName: 'Test',
          province: 'Cần Thơ',
          provinceId: 92,
          district: 'Ninh Kiều',
          districtId: 789,
          ward: 'An Khánh',
          wardCode: '00123',
          streetName: '123 Đường 3/2',
          phoneNumber: '0900000000',
          isDefault: true,
        },
      });

      expect(result.accessToken).toBe('access_token');
      expect(result.refreshToken).toBe('refresh_token');
      expect(result.user.name).toBe('Test');
      expect(result.user.role).toBe('user');
      expect(User.create).toHaveBeenCalledWith(expect.objectContaining({
        legalConsent: {
          policyVersion: LEGAL_POLICY_VERSION,
          acceptedAt: expect.any(Date),
        },
      }));
      expect(User.updateOne).toHaveBeenCalledWith(
        { _id: mockUser._id },
        { $set: expect.objectContaining({ refreshToken: hashToken('refresh_token'), lastLoginAt: expect.any(Date) }) },
      );
      expect(mockUser.save).not.toHaveBeenCalled();
    });

    it('should backfill GHN fields for 2025 addresses during registration', async () => {
      (verifyOtpToken as jest.Mock).mockReturnValue(true);
      (User.findOne as jest.Mock).mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');
      (jwt.sign as jest.Mock).mockReturnValueOnce('access_token').mockReturnValueOnce('refresh_token');
      const mockUser = {
        _id: { toString: () => 'user123' },
        name: 'Test',
        email: 'test@test.com',
        phone: '0900000000',
        role: 'user',
        save: jest.fn(),
        refreshToken: '',
      };
      (User.create as jest.Mock).mockResolvedValue(mockUser);

      await registerUser({
        name: 'Test',
        email: 'test@test.com',
        password: 'password123',
        phone: '0900000000',
        gender: 'male',
        dateOfBirth: '1990-01-01',
        otpToken: 'valid_token',
        acceptedTerms: true,
        policyVersion: LEGAL_POLICY_VERSION,
        address: {
          customerName: 'Test',
          province: 'Thanh pho Can Tho',
          provinceCode: '92',
          ward: 'Phuong Ninh Kieu',
          wardCode: '31135',
          streetName: '365 Tran Minh Son',
          phoneNumber: '0900000000',
          isDefault: true,
        },
      });

      expect(User.create).toHaveBeenCalledWith(expect.objectContaining({
        address: [expect.objectContaining({
          provinceCode: '92',
          wardCode: '31135',
          ghnProvinceId: 220,
          ghnDistrictId: 1572,
          ghnWardCode: '550108',
          ghnMappingStatus: 'manual',
          ghnMappingVerifiedAt: null,
        })],
      }));
    });
  });

  describe('loginUser', () => {
    it('should throw error if user not found', async () => {
      (User.findOne as jest.Mock).mockResolvedValue(null);
      await expect(loginUser('test@test.com', 'password')).rejects.toEqual({
        status: 401,
        message: 'Thông tin đăng nhập không chính xác',
      });
      expect(recordFailedLogin).toHaveBeenCalledWith('test@test.com');
    });

    it('should throw error if user is inactive', async () => {
      (User.findOne as jest.Mock).mockResolvedValue({ isActive: false });
      await expect(loginUser('test@test.com', 'password')).rejects.toEqual({
        status: 403,
        message: 'Tài khoản không còn hoạt động',
      });
    });

    it('should throw error if password is wrong', async () => {
      const mockUser = { _id: { toString: () => 'user123' }, isActive: true, password: 'hash' };
      (User.findOne as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(loginUser('test@test.com', 'password')).rejects.toEqual({
        status: 401,
        message: 'Thông tin đăng nhập không chính xác',
      });
      expect(recordFailedLogin).toHaveBeenCalledWith('test@test.com', mockUser);
    });

    it('propagates the temporary lock raised on the fifth failed attempt', async () => {
      const mockUser = { _id: { toString: () => 'user123' }, isActive: true, password: 'hash' };
      const lockError = {
        status: 429,
        errorCode: 'LOGIN_TEMPORARILY_LOCKED',
        message: 'Tài khoản tạm khóa',
      };
      (User.findOne as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      (recordFailedLogin as jest.Mock).mockRejectedValueOnce(lockError);

      await expect(loginUser('test@test.com', 'password')).rejects.toBe(lockError);
    });

    it('should login user successfully', async () => {
      const mockUser = {
        _id: { toString: () => 'user123' },
        name: 'Test',
        email: 'test@test.com',
        phone: '0900000000',
        role: 'user',
        password: 'hash',
        isActive: true,
        save: jest.fn(),
        refreshToken: '',
      };
      (User.findOne as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwt.sign as jest.Mock).mockReturnValueOnce('access_token').mockReturnValueOnce('refresh_token');

      const result = await loginUser('test@test.com', 'password');
      expect(result.accessToken).toBe('access_token');
      expect(result.refreshToken).toBe('refresh_token');
      expect(result.user.email).toBe('test@test.com');
      expect(User.updateOne).toHaveBeenCalledWith(
        { _id: mockUser._id },
        { $set: expect.objectContaining({ refreshToken: hashToken('refresh_token'), lastLoginAt: expect.any(Date) }) },
      );
      expect(clearLoginSecurity).toHaveBeenCalledWith('test@test.com', mockUser);
      expect(mockUser.save).not.toHaveBeenCalled();
    });
  });

  describe('loginAdminUser', () => {
    it('should reject customer accounts before issuing admin tokens', async () => {
      const mockUser = {
        _id: { toString: () => 'user123' },
        name: 'Customer',
        email: 'customer@test.com',
        role: 'user',
        password: 'hash',
        isActive: true,
      };
      (User.findOne as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(loginAdminUser('customer@test.com', 'password')).rejects.toEqual({
        status: 403,
        message: 'Tài khoản không có quyền truy cập trang quản trị',
      });
      expect(jwt.sign).not.toHaveBeenCalled();
      expect(User.updateOne).not.toHaveBeenCalled();
    });

    it('should login staff accounts through the admin endpoint', async () => {
      const mockUser = {
        _id: { toString: () => 'staff123' },
        name: 'Staff',
        email: 'staff@test.com',
        phone: '0900000000',
        role: 'staff',
        permissions: ['orders.read'],
        password: 'hash',
        isActive: true,
      };
      (User.findOne as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwt.sign as jest.Mock).mockReturnValueOnce('admin_access_token').mockReturnValueOnce('admin_refresh_token');

      const result = await loginAdminUser('staff@test.com', 'password');

      expect(result.accessToken).toBe('admin_access_token');
      expect(result.refreshToken).toBe('admin_refresh_token');
      expect(result.user.role).toBe('staff');
      expect(result.user.permissions).toEqual(['orders.read']);
      expect(User.updateOne).toHaveBeenCalledWith(
        { _id: mockUser._id },
        { $set: expect.objectContaining({ refreshToken: hashToken('admin_refresh_token'), lastLoginAt: expect.any(Date) }) },
      );
    });
  });

  describe('logoutUser', () => {
    it('should clear refresh token', async () => {
      const mockUser = { refreshToken: 'token', save: jest.fn() };
      (User.findById as jest.Mock).mockResolvedValue(mockUser);
      await logoutUser('user123');
      expect(User.updateOne).toHaveBeenCalledWith(
        { _id: 'user123' },
        { $set: { refreshToken: null } },
      );
      expect(PushToken.updateMany).toHaveBeenCalledWith(
        { userId: 'user123', isActive: true },
        { $set: { isActive: false } },
      );
      expect(revokeSupportSocketAccess).toHaveBeenCalledWith('user123');
      expect(mockUser.save).not.toHaveBeenCalled();
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh tokens successfully', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({ userId: 'user123', email: 'test@test.com', role: 'user' });
      const mockUser = {
        _id: { toString: () => 'user123' },
        email: 'test@test.com',
        role: 'user',
        isActive: true,
        refreshToken: 'old_token',
        save: jest.fn(),
      };
      (User.findById as jest.Mock).mockResolvedValue(mockUser);
      (jwt.sign as jest.Mock).mockReturnValueOnce('new_access').mockReturnValueOnce('new_refresh');

      const result = await refreshAccessToken('old_token');
      expect(result.accessToken).toBe('new_access');
      expect(result.refreshToken).toBe('new_refresh');
      expect(result.user).toMatchObject({
        _id: mockUser._id,
        email: 'test@test.com',
        role: 'user',
      });
      expect(User.updateOne).toHaveBeenCalledWith(
        { _id: mockUser._id },
        { $set: { refreshToken: hashToken('new_refresh') } },
      );
    });

    it('rejects refresh tokens after the account is deactivated', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({
        userId: 'user123',
        email: 'test@test.com',
        role: 'user',
      });
      (User.findById as jest.Mock).mockResolvedValue({
        _id: { toString: () => 'user123' },
        email: 'test@test.com',
        role: 'user',
        isActive: false,
        refreshToken: hashToken('old_token'),
      });

      await expect(refreshAccessToken('old_token')).rejects.toMatchObject({
        status: 403,
      });
      expect(jwt.sign).not.toHaveBeenCalled();
      expect(User.updateOne).not.toHaveBeenCalled();
    });
  });

  describe('getAdminSessionUser', () => {
    it('returns the latest staff permissions from the database', async () => {
      (User.findById as jest.Mock).mockResolvedValue({
        _id: 'staff-1',
        name: 'Staff',
        email: 'staff@example.com',
        role: 'staff',
        isActive: true,
        permissions: ['orders.read', 'orders.update'],
      });

      await expect(getAdminSessionUser('staff-1')).resolves.toMatchObject({
        _id: 'staff-1',
        role: 'staff',
        permissions: ['orders.read', 'orders.update'],
      });
    });

    it('rejects inactive staff sessions', async () => {
      (User.findById as jest.Mock).mockResolvedValue({
        _id: 'staff-1',
        role: 'staff',
        isActive: false,
      });

      await expect(getAdminSessionUser('staff-1')).rejects.toMatchObject({ status: 403 });
    });
  });

  describe('forgotPassword', () => {
    it('should not reveal whether an email account exists', async () => {
      (User.findOne as jest.Mock).mockResolvedValue(null);
      await expect(forgotPassword('test@test.com')).resolves.toEqual({
        method: 'email',
        delivery: {
          mode: 'mock',
          provider: 'mock',
          testToken: 'mock-reset-token-0000000000000001',
          testUrl: expect.stringContaining('fashion-ecommerce://reset-password'),
        },
      });
      expect(sendResetPasswordEmail).not.toHaveBeenCalled();
    });

    it('stores the mock token hash and returns email delivery information', async () => {
      const user = {
        _id: 'user-email-1',
        email: 'test@test.com',
        resetPasswordToken: null,
        resetPasswordExpires: null,
      };
      (User.findOne as jest.Mock).mockResolvedValue(user);

      await expect(forgotPassword('test@test.com')).resolves.toEqual({
        method: 'email',
        delivery: expect.objectContaining({
          mode: 'mock',
          provider: 'mock',
          testToken: 'mock-reset-token-0000000000000001',
        }),
      });
      expect(User.updateOne).toHaveBeenCalledWith(
        { _id: 'user-email-1' },
        {
          $set: {
            resetPasswordToken: hashToken('mock-reset-token-0000000000000001'),
            resetPasswordExpires: expect.any(Date),
          },
        },
      );
      expect(sendResetPasswordEmail).toHaveBeenCalledWith(
        'test@test.com',
        'mock-reset-token-0000000000000001',
      );
    });

    it('restores the previous reset token when email delivery fails', async () => {
      const previousExpiry = new Date('2026-07-29T10:00:00.000Z');
      const user = {
        _id: 'user-email-2',
        email: 'test@test.com',
        resetPasswordToken: 'previous-hash',
        resetPasswordExpires: previousExpiry,
      };
      (User.findOne as jest.Mock).mockResolvedValue(user);
      (sendResetPasswordEmail as jest.Mock).mockRejectedValue(
        new EmailDeliveryError('smtp unavailable', {
          code: 'EMAIL_PROVIDER_UNAVAILABLE',
        }),
      );

      await expect(forgotPassword('test@test.com')).rejects.toMatchObject({
        code: 'EMAIL_PROVIDER_UNAVAILABLE',
      });
      expect(User.updateOne).toHaveBeenLastCalledWith(
        { _id: 'user-email-2' },
        {
          $set: {
            resetPasswordToken: 'previous-hash',
            resetPasswordExpires: previousExpiry,
          },
        },
      );
    });

    it('should throttle repeated phone reset requests without sending another SMS', async () => {
      (User.findOne as jest.Mock).mockResolvedValue({
        phone: '0900000009',
        email: 'user@test.com',
      });

      await expect(forgotPassword('0900000009')).resolves.toEqual({
        method: 'phone',
        delivery: { mode: 'mock', provider: 'mock', testOtp: '123456' },
      });
      await expect(forgotPassword('0900000009')).resolves.toEqual({
        method: 'phone',
        delivery: { mode: 'mock', provider: 'mock', testOtp: '123456' },
      });

      expect(sendOtpSms).toHaveBeenCalledTimes(1);
      expect(User.findOne).toHaveBeenCalledTimes(1);
    });
  });

  describe('resetPassword', () => {
    it('should reset password with valid token', async () => {
      const mockUser = {
        _id: { toString: () => 'user123' },
        password: 'old',
        save: jest.fn(),
        resetPasswordToken: '',
        resetPasswordExpires: null,
        refreshToken: '',
      };
      (User.findOne as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockImplementation(async (plain, hash) => plain === hash);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new_hash');

      await resetPassword('test@test.com', 'valid_token', 'new_password');
      expect(User.updateOne).toHaveBeenCalledWith(
        { _id: mockUser._id },
        {
          $set: expect.objectContaining({
            password: 'new_hash',
            resetPasswordToken: null,
            resetPasswordExpires: null,
            refreshToken: null,
            mustChangePassword: false,
            passwordChangedAt: expect.any(Date),
          }),
        },
      );
      expect(PushToken.updateMany).toHaveBeenCalledWith(
        { userId: 'user123', isActive: true },
        { $set: { isActive: false } },
      );
      expect(revokeSupportSocketAccess).toHaveBeenCalledWith('user123');
      expect(mockUser.save).not.toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const mockUser = {
        _id: { toString: () => 'user123' },
        password: 'current_pass',
        save: jest.fn(),
        refreshToken: '',
      };
      (User.findById as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockImplementation(async (plain, hash) => plain === hash);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new_hash');

      await changePassword('user123', 'current_pass', 'new_pass');
      expect(User.updateOne).toHaveBeenCalledWith(
        { _id: mockUser._id },
        {
          $set: expect.objectContaining({
            password: 'new_hash',
            refreshToken: null,
            mustChangePassword: false,
            passwordChangedAt: expect.any(Date),
          }),
        },
      );
      expect(PushToken.updateMany).toHaveBeenCalledWith(
        { userId: 'user123', isActive: true },
        { $set: { isActive: false } },
      );
      expect(revokeSupportSocketAccess).toHaveBeenCalledWith('user123');
      expect(mockUser.save).not.toHaveBeenCalled();
    });

    it('does not revoke device access when the current password is invalid', async () => {
      (User.findById as jest.Mock).mockResolvedValue({
        _id: { toString: () => 'user123' },
        email: 'test@test.com',
        password: 'current_hash',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(changePassword('user123', 'wrong-password', 'newPassword123'))
        .rejects.toMatchObject({ status: 400 });

      expect(User.updateOne).not.toHaveBeenCalled();
      expect(PushToken.updateMany).not.toHaveBeenCalled();
      expect(revokeSupportSocketAccess).not.toHaveBeenCalled();
    });
  });
});
