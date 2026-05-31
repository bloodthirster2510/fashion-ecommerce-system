import { User, type IUser, type IUserAddress } from '../../database/models/user.model';
import { deleteImageFromCloudinary, getAvatarFolder, uploadImageToCloudinary } from '../../utils/cloudinary';

const safeUserSelect = '-password -refreshToken -resetPasswordToken -resetPasswordExpires';

const hasCompletedProfile = (user: IUser) =>
  Boolean(user.phone && user.gender && user.dateOfBirth && Array.isArray(user.address) && user.address.length > 0);

const syncProfileCompleted = (user: IUser) => {
  user.profileCompleted = hasCompletedProfile(user);
};

const normalizeBase64Image = (imageBase64: string, fallbackMimeType?: string) => {
  const dataUriMatch = imageBase64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s);
  const mimeType = (dataUriMatch?.[1] || fallbackMimeType || 'image/jpeg').toLowerCase();
  const cleanBase64 = (dataUriMatch?.[2] || imageBase64).replace(/\s/g, '');

  return { mimeType, cleanBase64 };
};

export const getMe = async (userId: string) => {
  const user = await User.findById(userId)
    .select(safeUserSelect);
  if (!user) {
    throw { status: 404, message: 'Người dùng không tồn tại' };
  }
  return user;
};

export const updateMe = async (userId: string, data: {
  name?: string;
  phone?: string;
  gender?: string;
  dateOfBirth?: string;
  avatarImage?: string | null;
}) => {
  const updates: Record<string, unknown> = {};

  if (data.name !== undefined) updates.name = data.name.trim();
  if (data.phone !== undefined) {
    const normalizedPhone = data.phone.trim();
    const existingUser = await User.findOne({ _id: { $ne: userId }, phone: normalizedPhone });
    if (existingUser) {
      throw { status: 409, message: 'Số điện thoại đã được sử dụng' };
    }
    updates.phone = normalizedPhone;
  }
  if (data.gender !== undefined) updates.gender = data.gender;
  if (data.dateOfBirth !== undefined) updates.dateOfBirth = new Date(data.dateOfBirth);
  if (data.avatarImage !== undefined) {
    if (data.avatarImage) {
      updates.avatarImage = data.avatarImage.trim();
    } else {
      const existingUser = await User.findById(userId).select('avatarPublicId');
      if (!existingUser) {
        throw { status: 404, message: 'Người dùng không tồn tại' };
      }

      await deleteImageFromCloudinary(existingUser.avatarPublicId).catch(() => undefined);
      updates.avatarImage = null;
      updates.avatarPublicId = null;
    }
  }

  if (Object.keys(updates).length === 0) {
    throw { status: 400, message: 'Không có dữ liệu để cập nhật' };
  }

  const user = await User.findByIdAndUpdate(userId, { $set: updates }, { new: true, runValidators: true })
    .select(safeUserSelect);

  if (!user) {
    throw { status: 404, message: 'Người dùng không tồn tại' };
  }

  syncProfileCompleted(user);
  await user.save();
  return user;
};

export const uploadAvatar = async (userId: string, data: {
  imageBase64?: string;
  mimeType?: string;
}) => {
  if (!data.imageBase64 || typeof data.imageBase64 !== 'string') {
    throw { status: 400, message: 'Vui lòng chọn ảnh đại diện' };
  }

  const existingUser = await User.findById(userId).select('avatarPublicId');
  if (!existingUser) {
    throw { status: 404, message: 'Người dùng không tồn tại' };
  }

  const { mimeType, cleanBase64 } = normalizeBase64Image(data.imageBase64, data.mimeType);
  const allowedMimeTypes: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };
  if (!allowedMimeTypes[mimeType]) {
    throw { status: 400, message: 'Ảnh đại diện phải là JPG, PNG hoặc WEBP' };
  }

  const avatarBuffer = Buffer.from(cleanBase64, 'base64');
  const maxAvatarBytes = 3 * 1024 * 1024;

  if (!avatarBuffer.length || avatarBuffer.length > maxAvatarBytes) {
    throw { status: 400, message: 'Ảnh đại diện tối đa 3MB' };
  }

  const safeUserId = userId.replace(/[^a-zA-Z0-9]/g, '');
  const uploadResult = await uploadImageToCloudinary({
    fileDataUri: `data:${mimeType};base64,${cleanBase64}`,
    folder: getAvatarFolder(),
    publicId: safeUserId,
  });

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: { avatarImage: uploadResult.secureUrl, avatarPublicId: uploadResult.publicId } },
    { new: true, runValidators: true },
  ).select(safeUserSelect);

  if (!user) {
    throw { status: 404, message: 'Người dùng không tồn tại' };
  }

  if (existingUser.avatarPublicId && existingUser.avatarPublicId !== uploadResult.publicId) {
    await deleteImageFromCloudinary(existingUser.avatarPublicId).catch(() => undefined);
  }

  return user;
};

export const getAddresses = async (userId: string) => {
  const user = await User.findById(userId).select('address');
  if (!user) {
    throw { status: 404, message: 'Người dùng không tồn tại' };
  }
  return user.address;
};

export const addAddress = async (userId: string, address: {
  customerName: string;
  province: string;
  district: string;
  ward: string;
  streetName: string;
  phoneNumber: string;
  isDefault?: boolean;
}) => {
  const user = await User.findById(userId);
  if (!user) {
    throw { status: 404, message: 'Người dùng không tồn tại' };
  }

  if (user.address.length >= 5) {
    throw { status: 400, message: 'Tối đa 5 địa chỉ' };
  }

  const shouldSetDefault = address.isDefault ?? user.address.length === 0;
  if (shouldSetDefault) {
    user.address.forEach((item: IUserAddress) => {
      item.isDefault = false;
    });
  }

  user.address.push({
    customerName: address.customerName,
    province: address.province,
    district: address.district,
    ward: address.ward,
    streetName: address.streetName,
    phoneNumber: address.phoneNumber,
    isDefault: shouldSetDefault,
  });

  syncProfileCompleted(user);
  await user.save();
  return user.address;
};

export const updateAddress = async (userId: string, addressId: string, data: {
  customerName?: string;
  province?: string;
  district?: string;
  ward?: string;
  streetName?: string;
  phoneNumber?: string;
  isDefault?: boolean;
}) => {
  const user = await User.findById(userId);
  if (!user) {
    throw { status: 404, message: 'Người dùng không tồn tại' };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const address = (user.address as any).id(addressId);
  if (!address) {
    throw { status: 404, message: 'Địa chỉ không tồn tại' };
  }

  if (data.isDefault === true) {
    user.address.forEach((addr: IUserAddress) => {
      addr.isDefault = false;
    });
  }

  if (data.customerName !== undefined) address.customerName = data.customerName;
  if (data.province !== undefined) address.province = data.province;
  if (data.district !== undefined) address.district = data.district;
  if (data.ward !== undefined) address.ward = data.ward;
  if (data.streetName !== undefined) address.streetName = data.streetName;
  if (data.phoneNumber !== undefined) address.phoneNumber = data.phoneNumber;
  if (data.isDefault !== undefined) address.isDefault = data.isDefault;

  syncProfileCompleted(user);
  await user.save();
  return user.address;
};

export const deleteAddress = async (userId: string, addressId: string) => {
  const user = await User.findById(userId);
  if (!user) {
    throw { status: 404, message: 'Người dùng không tồn tại' };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const address = (user.address as any).id(addressId);
  if (!address) {
    throw { status: 404, message: 'Địa chỉ không tồn tại' };
  }

  address.deleteOne();
  syncProfileCompleted(user);
  await user.save();
};

export const setDefaultAddress = async (userId: string, addressId: string) => {
  const user = await User.findById(userId);
  if (!user) {
    throw { status: 404, message: 'Người dùng không tồn tại' };
  }

  let found = false;
  for (const addr of user.address) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((addr as any)._id.toString() === addressId) {
      addr.isDefault = true;
      found = true;
    } else {
      addr.isDefault = false;
    }
  }

  if (!found) {
    throw { status: 404, message: 'Địa chỉ không tồn tại' };
  }

  await user.save();
  return user.address;
};

export const getUsers = async (query: {
  role?: string;
  isActive?: string;
  keyword?: string;
  page?: string;
  limit?: string;
}) => {
  const filter: Record<string, unknown> = {};

  if (query.role) filter.role = query.role;
  if (query.isActive !== undefined) filter.isActive = query.isActive === 'true';

  if (query.keyword) {
    filter.$or = [
      { name: { $regex: query.keyword, $options: 'i' } },
      { email: { $regex: query.keyword, $options: 'i' } },
      { phone: { $regex: query.keyword, $options: 'i' } },
    ];
  }

  const page = Math.max(1, parseInt(query.page || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || '10')));
  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    User.find(filter)
      .select(safeUserSelect)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  return {
    items: users,
    totalItems: total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

export const getUserById = async (id: string) => {
  const user = await User.findById(id)
    .select(safeUserSelect);
  if (!user) {
    throw { status: 404, message: 'Người dùng không tồn tại' };
  }
  return user;
};

export const updateUserStatus = async (id: string, isActive: boolean) => {
  const user = await User.findByIdAndUpdate(id, { isActive }, { new: true })
    .select(safeUserSelect);
  if (!user) {
    throw { status: 404, message: 'Người dùng không tồn tại' };
  }
  return user;
};

export const updateUserRole = async (id: string, role: string) => {
  if (!['admin', 'staff', 'user'].includes(role)) {
    throw { status: 400, message: 'Role không hợp lệ' };
  }

  const user = await User.findByIdAndUpdate(id, { role }, { new: true })
    .select(safeUserSelect);
  if (!user) {
    throw { status: 404, message: 'Người dùng không tồn tại' };
  }
  return user;
};

export const forcePasswordReset = async (id: string) => {
  const user = await User.findById(id);
  if (!user) {
    throw { status: 404, message: 'Người dùng không tồn tại' };
  }

  user.refreshToken = null;
  user.resetPasswordToken = null;
  user.resetPasswordExpires = null;
  await user.save();
};
