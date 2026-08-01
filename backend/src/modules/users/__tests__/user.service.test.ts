import crypto from 'crypto';
import {
  addAddress,
  deleteAddress,
  forcePasswordReset,
  getAddresses,
  getCustomerSummary,
  getMe,
  getUsers,
  setDefaultAddress,
  updateAddress,
  updateMe,
  updateUserRole,
  updateUserStatus,
  uploadAvatar,
} from '../user.service';
import { User } from '../../../database/models/user.model';
import {
  deleteImageFromCloudinary,
  uploadImageToCloudinary,
} from '../../../utils/cloudinary';
import {
  getResetPasswordEmailCapability,
  sendResetPasswordEmail,
} from '../../../utils/email';

jest.mock('../../../database/models/user.model');
jest.mock('../../../utils/cloudinary', () => ({
  deleteImageFromCloudinary: jest.fn().mockResolvedValue(undefined),
  getAvatarFolder: jest.fn(() => 'test/avatars'),
  uploadImageToCloudinary: jest.fn(),
}));
jest.mock('../../../utils/email', () => ({
  getResetPasswordEmailCapability: jest.fn(),
  sendResetPasswordEmail: jest.fn(),
}));

describe('User Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getResetPasswordEmailCapability as jest.Mock).mockReturnValue({
      mode: 'mock',
      provider: 'mock',
      testToken: 'mock-reset-token-0000000000000001',
      testUrl: 'fashion-ecommerce://reset-password?identifier=customer%40test.com&token=mock-reset-token-0000000000000001',
    });
    (sendResetPasswordEmail as jest.Mock).mockResolvedValue({
      mode: 'mock',
      provider: 'mock',
      testToken: 'mock-reset-token-0000000000000001',
      testUrl: 'fashion-ecommerce://reset-password?identifier=customer%40test.com&token=mock-reset-token-0000000000000001',
    });
  });

  describe('getMe', () => {
    it('should return user without sensitive fields', async () => {
      const mockUser = {
        _id: 'user123',
        name: 'Test',
        email: 'test@test.com',
        role: 'user',
      };
      (User.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      const result = await getMe('user123');
      expect(result).toEqual(mockUser);
    });

    it('should throw if user not found', async () => {
      (User.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      await expect(getMe('user123')).rejects.toEqual({
        status: 404,
        message: 'Người dùng không tồn tại',
      });
    });
  });

  describe('updateMe', () => {
    it('should update user profile', async () => {
      const mockUser = {
        _id: 'user123',
        name: 'Updated',
        phone: '0900000000',
        gender: 'male',
        dateOfBirth: new Date('1990-01-01'),
        address: [{ customerName: 'Test' }],
        profileCompleted: true,
        save: jest.fn(),
      };
      (User.findByIdAndUpdate as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      const result = await updateMe('user123', { name: 'Updated' });
      expect(result).toEqual(mockUser);
    });

    it('should throw if no data provided', async () => {
      await expect(updateMe('user123', {})).rejects.toEqual({
        status: 400,
        message: 'Không có dữ liệu để cập nhật',
      });
    });

    it('should reject a null payload as bad input', async () => {
      await expect(updateMe('user123', null as never)).rejects.toEqual({
        status: 400,
        message: 'Dữ liệu cập nhật không hợp lệ',
      });
    });
  });

  describe('uploadAvatar', () => {
    it('should reject malformed base64 before uploading', async () => {
      (User.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue({ avatarPublicId: null }),
      });

      await expect(uploadAvatar('user123', {
        imageBase64: '%%%not-base64%%%',
        mimeType: 'image/png',
      })).rejects.toEqual({ status: 400, message: 'Dữ liệu ảnh đại diện không hợp lệ' });
      expect(uploadImageToCloudinary).not.toHaveBeenCalled();
    });

    it('should remove a newly uploaded image when the user is concurrently deleted', async () => {
      (User.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue({ avatarPublicId: null }),
      });
      (uploadImageToCloudinary as jest.Mock).mockResolvedValue({
        publicId: 'test/avatars/user123',
        secureUrl: 'https://cdn.example.com/user123.png',
      });
      (User.findByIdAndUpdate as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      await expect(uploadAvatar('user123', {
        imageBase64: Buffer.from('valid-image-bytes').toString('base64'),
        mimeType: 'image/png',
      })).rejects.toEqual({ status: 404, message: 'Người dùng không tồn tại' });
      expect(deleteImageFromCloudinary).toHaveBeenCalledWith('test/avatars/user123');
    });
  });

  describe('getAddresses', () => {
    it('should return user addresses', async () => {
      const addresses = [{ customerName: 'Test', province: 'Cần Thơ' }];
      (User.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue({ address: addresses }),
      });

      const result = await getAddresses('user123');
      expect(result).toEqual(addresses);
    });
  });

  describe('addAddress', () => {
    it('should add a new address', async () => {
      const user = {
        address: [],
        save: jest.fn(),
      };
      (User.findById as jest.Mock).mockResolvedValue(user);

      const result = await addAddress('user123', {
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
      });

      expect(result).toHaveLength(1);
      expect(result[0].customerName).toBe('Test');
      expect(user.save).toHaveBeenCalled();
    });

    it('should always make the first saved address the default', async () => {
      const user = { address: [], save: jest.fn() };
      (User.findById as jest.Mock).mockResolvedValue(user);

      const result = await addAddress('user123', {
        customerName: 'Test User',
        province: 'Cần Thơ',
        ward: 'An Khánh',
        wardCode: '00123',
        streetName: '123 Đường 3/2',
        phoneNumber: '0900000000',
        isDefault: false,
      });

      expect(result[0].isDefault).toBe(true);
    });

    it('should normalize legacy saved addresses before adding a new one', async () => {
      const legacyAddress = {
        customerName: 'Old',
        province: 'Thành phố Cần Thơ',
        ward: 'Phường Ninh Kiều',
        streetName: 'Old street',
        phoneNumber: '0900000000',
        isDefault: true,
      };
      const user = {
        address: [legacyAddress],
        save: jest.fn(),
      };
      (User.findById as jest.Mock).mockResolvedValue(user);

      const result = await addAddress('user123', {
        customerName: 'Test',
        province: 'Thành phố Cần Thơ',
        provinceCode: '92',
        ward: 'Phường Ninh Kiều',
        wardCode: '31135',
        streetName: '365 Tran Minh Son',
        phoneNumber: '0343149695',
        isDefault: true,
      });

      expect(result).toHaveLength(2);
      expect(result[0].wardCode).toBe('legacy-1');
      expect(result[0].isDefault).toBe(false);
      expect(result[1].wardCode).toBe('31135');
      expect(result[1].ghnProvinceId).toBe(220);
      expect(result[1].ghnDistrictId).toBe(1572);
      expect(result[1].ghnWardCode).toBe('550108');
      expect(result[1].ghnMappingStatus).toBe('mapped');
      expect(result[1].isDefault).toBe(true);
      expect(user.save).toHaveBeenCalled();
    });

    it('should throw if max addresses reached', async () => {
      const user = {
        address: [
          { customerName: 'A1' },
          { customerName: 'A2' },
          { customerName: 'A3' },
          { customerName: 'A4' },
          { customerName: 'A5' },
        ],
      };
      (User.findById as jest.Mock).mockResolvedValue(user);

      await expect(addAddress('user123', {
        customerName: 'Test',
        province: 'Cần Thơ',
        provinceId: 92,
        district: 'Ninh Kiều',
        districtId: 789,
        ward: 'An Khánh',
        wardCode: '00123',
        streetName: '123 Đường 3/2',
        phoneNumber: '0900000000',
      })).rejects.toEqual({ status: 400, message: 'Tối đa 5 địa chỉ' });
    });
  });

  describe('updateAddress', () => {
    const savedAddress = () => ({
      _id: { toString: () => 'addr-default' },
      customerName: 'Test User',
      province: 'Cần Thơ',
      provinceCode: '92',
      provinceId: 92,
      district: null,
      districtId: null,
      ward: 'An Khánh',
      wardCode: '00123',
      streetName: '123 Đường 3/2',
      phoneNumber: '0900000000',
      isDefault: true,
    });

    it('should preserve the default-address invariant when unchecking the only default', async () => {
      const address = savedAddress();
      const addresses = [address] as typeof address[] & { id?: jest.Mock };
      addresses.id = jest.fn().mockReturnValue(address);
      const user = { address: addresses, save: jest.fn(), profileCompleted: true };
      (User.findById as jest.Mock).mockResolvedValue(user);

      const result = await updateAddress('user123', 'addr-default', { isDefault: false });

      expect(result[0].isDefault).toBe(true);
      expect(user.save).toHaveBeenCalled();
    });

    it('should reject a null update payload', async () => {
      await expect(updateAddress('user123', 'addr-default', null as never)).rejects.toEqual({
        status: 400,
        message: 'Dữ liệu địa chỉ không hợp lệ',
      });
      expect(User.findById).not.toHaveBeenCalled();
    });
  });

  describe('setDefaultAddress', () => {
    it('should keep exactly one default address', async () => {
      const addresses = [
        { _id: { toString: () => 'addr-1' }, isDefault: true },
        { _id: { toString: () => 'addr-2' }, isDefault: false },
      ];
      const user = { address: addresses, save: jest.fn() };
      (User.findById as jest.Mock).mockResolvedValue(user);

      await setDefaultAddress('user123', 'addr-2');

      expect(addresses.map((address) => address.isDefault)).toEqual([false, true]);
    });
  });

  describe('deleteAddress', () => {
    it('should delete an address', async () => {
      const address = { deleteOne: jest.fn() };
      const user = {
        address: { id: jest.fn().mockReturnValue(address) },
        save: jest.fn(),
      };
      (User.findById as jest.Mock).mockResolvedValue(user);

      await deleteAddress('user123', 'addr123');
      expect(address.deleteOne).toHaveBeenCalled();
      expect(user.save).toHaveBeenCalled();
    });

    it('should assign another default address when deleting the default one', async () => {
      const defaultAddress = {
        _id: { toString: () => 'addr-default' },
        isDefault: true,
        deleteOne: jest.fn(() => {
          user.address.splice(0, 1);
        }),
      };
      const fallbackAddress = {
        _id: { toString: () => 'addr-fallback' },
        isDefault: false,
      };
      const user = {
        address: [defaultAddress, fallbackAddress],
        save: jest.fn(),
      };
      (user.address as unknown as { id: jest.Mock }).id = jest.fn().mockReturnValue(defaultAddress);
      (User.findById as jest.Mock).mockResolvedValue(user);

      const remainingAddresses = await deleteAddress('user123', 'addr-default');

      expect(defaultAddress.deleteOne).toHaveBeenCalled();
      expect(fallbackAddress.isDefault).toBe(true);
      expect(remainingAddresses).toBe(user.address);
      expect(user.save).toHaveBeenCalled();
    });
  });

  describe('getUsers', () => {
    it('should return paginated users', async () => {
      const mockUsers = [{ _id: 'u1', name: 'User1' }];
      const mockSelect = jest.fn().mockReturnThis();
      const mockSort = jest.fn().mockReturnThis();
      const mockSkip = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockResolvedValue(mockUsers);
      (User.find as jest.Mock).mockReturnValue({
        select: mockSelect,
        sort: mockSort,
        skip: mockSkip,
        limit: mockLimit,
      });
      (User.countDocuments as jest.Mock).mockResolvedValue(1);

      const result = await getUsers({ page: '1', limit: '10' });
      expect(result.items).toEqual(mockUsers);
      expect(result.totalItems).toBe(1);
      expect(result.page).toBe(1);
    });
  });

  describe('getCustomerSummary', () => {
    it('should return aggregate customer counters', async () => {
      (User.countDocuments as jest.Mock)
        .mockResolvedValueOnce(12)
        .mockResolvedValueOnce(9)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(7)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(2);

      const result = await getCustomerSummary({ keyword: 'anna' });

      expect(result).toEqual({
        total: 12,
        active: 9,
        blocked: 3,
        completedProfiles: 7,
        activeLast30Days: 5,
        newLast7Days: 2,
      });
      expect(User.countDocuments).toHaveBeenCalledTimes(6);
      expect(User.countDocuments).toHaveBeenNthCalledWith(1, expect.objectContaining({
        role: 'user',
        $or: expect.any(Array),
      }));
      expect(User.countDocuments).toHaveBeenNthCalledWith(5, expect.objectContaining({
        isActive: true,
        lastLoginAt: expect.objectContaining({ $gte: expect.any(Date) }),
      }));
    });
  });

  describe('updateUserStatus', () => {
    it('should toggle user active status', async () => {
      const mockUser = { _id: 'u1', isActive: false };
      (User.findOneAndUpdate as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      const result = await updateUserStatus('u1', false);
      expect(result).toEqual(mockUser);
      expect(User.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'u1', role: 'user' },
        { isActive: false },
        { returnDocument: 'after' },
      );
    });
  });

  describe('updateUserRole', () => {
    it('should update user role', async () => {
      const mockUser = { _id: 'u1', role: 'staff' };
      (User.findById as jest.Mock).mockResolvedValue({ _id: 'u1', role: 'user', isActive: true });
      (User.findByIdAndUpdate as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      const result = await updateUserRole('u1', 'staff');
      expect(result).toEqual(mockUser);
    });

    it('should reject downgrading the last active admin', async () => {
      (User.findById as jest.Mock).mockResolvedValue({ _id: 'admin1', role: 'admin', isActive: true });
      (User.countDocuments as jest.Mock).mockResolvedValue(0);

      await expect(updateUserRole('admin1', 'staff')).rejects.toEqual({
        status: 409,
        message: 'Không thể hạ quyền admin cuối cùng đang hoạt động',
      });

      expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should throw for invalid role', async () => {
      await expect(updateUserRole('u1', 'superadmin')).rejects.toEqual({
        status: 400,
        message: 'Role không hợp lệ',
      });
    });
  });

  describe('forcePasswordReset', () => {
    it('should revoke sessions and send a reset password token', async () => {
      const previousExpiry = new Date();
      const previousPasswordChangedAt = new Date(Date.now() - 60_000);
      const user = {
        email: 'customer@test.com',
        refreshToken: 'hashed-refresh-token',
        resetPasswordToken: 'hashed-reset-token',
        resetPasswordExpires: previousExpiry,
        mustChangePassword: false,
        passwordChangedAt: previousPasswordChangedAt,
        save: jest.fn(),
      };
      (User.findOne as jest.Mock).mockResolvedValue(user);

      await expect(forcePasswordReset('u1')).resolves.toMatchObject({
        mode: 'mock',
        provider: 'mock',
        testToken: 'mock-reset-token-0000000000000001',
      });

      expect(user.refreshToken).toBeNull();
      expect(user.resetPasswordToken).not.toBe('hashed-reset-token');
      expect(user.resetPasswordExpires).toBeInstanceOf(Date);
      expect(user.resetPasswordExpires!.getTime()).toBeGreaterThan(previousExpiry.getTime());
      expect(user.mustChangePassword).toBe(true);
      expect(user.passwordChangedAt).toBeInstanceOf(Date);
      expect(user.passwordChangedAt!.getTime()).toBeGreaterThan(previousPasswordChangedAt.getTime());
      expect(user.save).toHaveBeenCalled();
      expect(sendResetPasswordEmail).toHaveBeenCalledTimes(1);

      const [email, token] = (sendResetPasswordEmail as jest.Mock).mock.calls[0];
      expect(email).toBe('customer@test.com');
      expect(token).toBe('mock-reset-token-0000000000000001');
      expect(user.resetPasswordToken).toBe(crypto.createHash('sha256').update(token).digest('hex'));
    });

    it('restores the previous auth state when reset email delivery fails', async () => {
      const previousExpiry = new Date('2026-07-29T10:00:00.000Z');
      const previousPasswordChangedAt = new Date('2026-07-20T10:00:00.000Z');
      const user = {
        email: 'customer@test.com',
        refreshToken: 'hashed-refresh-token',
        resetPasswordToken: 'hashed-reset-token',
        resetPasswordExpires: previousExpiry,
        mustChangePassword: false,
        passwordChangedAt: previousPasswordChangedAt,
        save: jest.fn(),
      };
      (User.findOne as jest.Mock).mockResolvedValue(user);
      (sendResetPasswordEmail as jest.Mock).mockRejectedValue(new Error('SMTP unavailable'));

      await expect(forcePasswordReset('u1')).rejects.toThrow('SMTP unavailable');
      expect(user).toMatchObject({
        refreshToken: 'hashed-refresh-token',
        resetPasswordToken: 'hashed-reset-token',
        resetPasswordExpires: previousExpiry,
        mustChangePassword: false,
        passwordChangedAt: previousPasswordChangedAt,
      });
      expect(user.save).toHaveBeenCalledTimes(2);
    });
  });
});
