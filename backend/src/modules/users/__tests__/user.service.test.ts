import { getMe, updateMe, getAddresses, addAddress, deleteAddress, getUsers, updateUserStatus, updateUserRole } from '../user.service';
import { User } from '../../../database/models/user.model';

jest.mock('../../../database/models/user.model');

describe('User Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
        district: 'Ninh Kiều',
        ward: 'An Khánh',
        streetName: '123 Đường 3/2',
        phoneNumber: '0900000000',
        isDefault: true,
      });

      expect(result).toHaveLength(1);
      expect(result[0].customerName).toBe('Test');
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
        district: 'Ninh Kiều',
        ward: 'An Khánh',
        streetName: '123 Đường 3/2',
        phoneNumber: '0900000000',
      })).rejects.toEqual({ status: 400, message: 'Tối đa 5 địa chỉ' });
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

  describe('updateUserStatus', () => {
    it('should toggle user active status', async () => {
      const mockUser = { _id: 'u1', isActive: false };
      (User.findByIdAndUpdate as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      const result = await updateUserStatus('u1', false);
      expect(result).toEqual(mockUser);
    });
  });

  describe('updateUserRole', () => {
    it('should update user role', async () => {
      const mockUser = { _id: 'u1', role: 'staff' };
      (User.findByIdAndUpdate as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      const result = await updateUserRole('u1', 'staff');
      expect(result).toEqual(mockUser);
    });

    it('should throw for invalid role', async () => {
      await expect(updateUserRole('u1', 'superadmin')).rejects.toEqual({
        status: 400,
        message: 'Role không hợp lệ',
      });
    });
  });
});
