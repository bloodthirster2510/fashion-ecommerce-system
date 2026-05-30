import { sendOtp, verifyOtp, registerUser, loginUser, logoutUser, refreshAccessToken, forgotPassword, resetPassword, changePassword } from '../auth.service';
import { User } from '../../../database/models/user.model';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

jest.mock('../../../database/models/user.model');
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');
jest.mock('../../../utils/email', () => ({
  sendResetPasswordEmail: jest.fn(),
}));
jest.mock('../../../utils/sms', () => ({
  sendOtpSms: jest.fn(),
  verifyOtpCode: jest.fn(),
  verifyOtpToken: jest.fn(),
}));

import { verifyOtpToken, verifyOtpCode } from '../../../utils/sms';

describe('Auth Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendOtp', () => {
    it('should throw if phone already exists', async () => {
      (User.findOne as jest.Mock).mockResolvedValue({ phone: '0900000000' });
      await expect(sendOtp('0900000000')).rejects.toEqual({
        status: 409,
        message: 'Số điện thoại đã được sử dụng',
      });
    });

    it('should send OTP successfully', async () => {
      (User.findOne as jest.Mock).mockResolvedValue(null);
      await expect(sendOtp('0900000000')).resolves.toBeUndefined();
    });
  });

  describe('verifyOtp', () => {
    it('should throw if OTP is invalid', () => {
      (verifyOtpCode as jest.Mock).mockReturnValue(null);
      expect(() => verifyOtp('0900000000', '123456')).toThrow();
    });

    it('should return token if OTP is valid', () => {
      (verifyOtpCode as jest.Mock).mockReturnValue('otp_token_abc');
      const result = verifyOtp('0900000000', '654321');
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
        address: {
          customerName: 'Test',
          province: 'Cần Thơ',
          district: 'Ninh Kiều',
          ward: 'An Khánh',
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
        address: {
          customerName: 'Test',
          province: 'Cần Thơ',
          district: 'Ninh Kiều',
          ward: 'An Khánh',
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
        address: {
          customerName: 'Test',
          province: 'Cần Thơ',
          district: 'Ninh Kiều',
          ward: 'An Khánh',
          streetName: '123 Đường 3/2',
          phoneNumber: '0900000000',
          isDefault: true,
        },
      });

      expect(result.accessToken).toBe('access_token');
      expect(result.refreshToken).toBe('refresh_token');
      expect(result.user.name).toBe('Test');
      expect(result.user.role).toBe('user');
    });
  });

  describe('loginUser', () => {
    it('should throw error if user not found', async () => {
      (User.findOne as jest.Mock).mockResolvedValue(null);
      await expect(loginUser('test@test.com', 'password')).rejects.toEqual({
        status: 401,
        message: 'Thông tin đăng nhập không chính xác',
      });
    });

    it('should throw error if user is inactive', async () => {
      (User.findOne as jest.Mock).mockResolvedValue({ isActive: false });
      await expect(loginUser('test@test.com', 'password')).rejects.toEqual({
        status: 403,
        message: 'Tài khoản không còn hoạt động',
      });
    });

    it('should throw error if password is wrong', async () => {
      (User.findOne as jest.Mock).mockResolvedValue({ isActive: true, password: 'hash' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(loginUser('test@test.com', 'password')).rejects.toEqual({
        status: 401,
        message: 'Thông tin đăng nhập không chính xác',
      });
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
    });
  });

  describe('logoutUser', () => {
    it('should clear refresh token', async () => {
      const mockUser = { refreshToken: 'token', save: jest.fn() };
      (User.findById as jest.Mock).mockResolvedValue(mockUser);
      await logoutUser('user123');
      expect(mockUser.refreshToken).toBeNull();
      expect(mockUser.save).toHaveBeenCalled();
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh tokens successfully', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({ userId: 'user123', email: 'test@test.com', role: 'user' });
      const mockUser = {
        _id: { toString: () => 'user123' },
        email: 'test@test.com',
        role: 'user',
        refreshToken: 'old_token',
        save: jest.fn(),
      };
      (User.findById as jest.Mock).mockResolvedValue(mockUser);
      (jwt.sign as jest.Mock).mockReturnValueOnce('new_access').mockReturnValueOnce('new_refresh');

      const result = await refreshAccessToken('old_token');
      expect(result.accessToken).toBe('new_access');
      expect(result.refreshToken).toBe('new_refresh');
    });
  });

  describe('forgotPassword', () => {
    it('should do nothing if user not found', async () => {
      (User.findOne as jest.Mock).mockResolvedValue(null);
      await expect(forgotPassword('test@test.com')).resolves.toBeUndefined();
    });
  });

  describe('resetPassword', () => {
    it('should reset password with valid token', async () => {
      const mockUser = {
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
      expect(mockUser.password).toBe('new_hash');
      expect(mockUser.resetPasswordToken).toBeNull();
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const mockUser = {
        password: 'current_pass',
        save: jest.fn(),
        refreshToken: '',
      };
      (User.findById as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockImplementation(async (plain, hash) => plain === hash);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new_hash');

      await changePassword('user123', 'current_pass', 'new_pass');
      expect(mockUser.password).toBe('new_hash');
      expect(mockUser.refreshToken).toBeNull();
    });
  });
});
