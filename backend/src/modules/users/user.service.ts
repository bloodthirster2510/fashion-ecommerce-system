import crypto from 'crypto';
import { User, type IUser, type IUserAddress, type UserRole } from '../../database/models/user.model';
import { deleteImageFromCloudinary, getAvatarFolder, uploadImageToCloudinary } from '../../utils/cloudinary';
import { normalizeUserAddressInput, type UserAddressInput } from '../../utils/address';
import {
  getResetPasswordEmailCapability,
  sendResetPasswordEmail,
} from '../../utils/email';

const safeUserSelect = '-password -refreshToken -resetPasswordToken -resetPasswordExpires';
const adminUserRoles: UserRole[] = ['admin', 'staff', 'user'];
const adminUserRoleSet = new Set<string>(adminUserRoles);

const firstString = (value: unknown) => {
  if (Array.isArray(value)) {
    return firstString(value[0]);
  }

  return typeof value === 'string' ? value.trim() : undefined;
};

const parsePositiveInteger = (value: unknown, fallback: number, max: number) => {
  const rawValue = firstString(value);
  if (!rawValue) {
    return fallback;
  }

  const parsedValue = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    return fallback;
  }

  return Math.min(max, parsedValue);
};

const parseStatusFilter = (value: unknown) => {
  const rawValue = firstString(value);
  if (!rawValue) {
    return undefined;
  }

  if (rawValue === 'true' || rawValue === 'active') {
    return true;
  }

  if (rawValue === 'false' || rawValue === 'blocked') {
    return false;
  }

  throw { status: 400, message: 'Trạng thái tài khoản không hợp lệ' };
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildAdminCustomerFilter = (query: {
  role?: unknown;
  isActive?: unknown;
  keyword?: unknown;
}) => {
  const filter: Record<string, unknown> = { role: 'user' };
  const role = firstString(query.role);
  const keyword = firstString(query.keyword);
  const isActive = parseStatusFilter(query.isActive);

  if (role && role !== 'user') {
    throw { status: 400, message: 'Role không hợp lệ' };
  }

  if (isActive !== undefined) {
    filter.isActive = isActive;
  }

  if (keyword) {
    const escapedKeyword = escapeRegExp(keyword.slice(0, 80));
    filter.$or = [
      { name: { $regex: escapedKeyword, $options: 'i' } },
      { email: { $regex: escapedKeyword, $options: 'i' } },
      { phone: { $regex: escapedKeyword, $options: 'i' } },
    ];
  }

  return filter;
};

const hasCompletedProfile = (user: IUser) =>
  Boolean(user.phone && user.gender && user.dateOfBirth && Array.isArray(user.address) && user.address.length > 0);

const syncProfileCompleted = (user: IUser) => {
  user.profileCompleted = hasCompletedProfile(user);
};

const toPlainAddress = (address: IUserAddress) => (
  typeof (address as unknown as { toObject?: () => IUserAddress }).toObject === 'function'
    ? (address as unknown as { toObject: () => IUserAddress }).toObject()
    : address
);

const normalizeSavedAddressesForCurrentSchema = (user: IUser) => {
  user.address.forEach((address, index) => {
    const currentAddress = toPlainAddress(address);

    Object.assign(address, normalizeUserAddressInput({
      ...currentAddress,
      wardCode: currentAddress.wardCode ?? currentAddress.ghnWardCode ?? `legacy-${index + 1}`,
      isDefault: currentAddress.isDefault,
    }));
  });
};

const ensureAddressDefaultInvariant = (addresses: IUserAddress[]) => {
  if (!addresses.length || addresses.some((address) => address.isDefault)) {
    return;
  }

  addresses[0].isDefault = true;
};

const assertNotLastActiveAdmin = async (user: IUser, nextRole: UserRole) => {
  if (user.role !== 'admin' || user.isActive === false || nextRole === 'admin') {
    return;
  }

  const otherActiveAdminCount = await User.countDocuments({
    _id: { $ne: user._id },
    role: 'admin',
    isActive: true,
  });

  if (otherActiveAdminCount < 1) {
    throw { status: 409, message: 'Không thể hạ quyền admin cuối cùng đang hoạt động' };
  }
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

  const user = await User.findByIdAndUpdate(userId, { $set: updates }, { returnDocument: 'after', runValidators: true })
    .select(safeUserSelect);

  if (!user) {
    throw { status: 404, message: 'Người dùng không tồn tại' };
  }

  normalizeSavedAddressesForCurrentSchema(user);
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
    { returnDocument: 'after', runValidators: true },
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

export const addAddress = async (userId: string, address: UserAddressInput) => {
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

  normalizeSavedAddressesForCurrentSchema(user);

  user.address.push(normalizeUserAddressInput({
    ...address,
    isDefault: shouldSetDefault,
  }));

  syncProfileCompleted(user);
  await user.save();
  return user.address;
};

export const updateAddress = async (userId: string, addressId: string, data: Partial<UserAddressInput>) => {
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

  normalizeSavedAddressesForCurrentSchema(user);

  const currentAddress = toPlainAddress(address);
  Object.assign(address, normalizeUserAddressInput({
    ...currentAddress,
    ...data,
    isDefault: data.isDefault ?? currentAddress.isDefault,
  }));

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

  const wasDefault = Boolean(toPlainAddress(address as IUserAddress).isDefault);
  address.deleteOne();
  if (wasDefault && Array.isArray(user.address)) {
    ensureAddressDefaultInvariant(user.address);
  }
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
  role?: unknown;
  isActive?: unknown;
  keyword?: unknown;
  page?: unknown;
  limit?: unknown;
}) => {
  const filter = buildAdminCustomerFilter(query);
  const page = parsePositiveInteger(query.page, 1, 10000);
  const limit = parsePositiveInteger(query.limit, 10, 100);
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

export const getCustomerSummary = async (query: { keyword?: unknown }) => {
  const filter = buildAdminCustomerFilter({ keyword: query.keyword, role: 'user' });
  const active30dBoundary = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const new7dBoundary = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    total,
    active,
    blocked,
    completedProfiles,
    activeLast30Days,
    newLast7Days,
  ] = await Promise.all([
    User.countDocuments(filter),
    User.countDocuments({ ...filter, isActive: true }),
    User.countDocuments({ ...filter, isActive: false }),
    User.countDocuments({ ...filter, profileCompleted: true }),
    User.countDocuments({ ...filter, isActive: true, lastLoginAt: { $gte: active30dBoundary } }),
    User.countDocuments({ ...filter, createdAt: { $gte: new7dBoundary } }),
  ]);

  return {
    total,
    active,
    blocked,
    completedProfiles,
    activeLast30Days,
    newLast7Days,
  };
};

export const getUserById = async (id: string) => {
  const user = await User.findOne({ _id: id, role: 'user' })
    .select(safeUserSelect);
  if (!user) {
    throw { status: 404, message: 'Người dùng không tồn tại' };
  }
  return user;
};

export const updateUserStatus = async (id: string, isActive: boolean, actorUserId?: string) => {
  if (typeof isActive !== 'boolean') {
    throw { status: 400, message: 'Trạng thái tài khoản không hợp lệ' };
  }

  if (actorUserId && actorUserId === id && !isActive) {
    throw { status: 400, message: 'Không thể khoá tài khoản đang đăng nhập' };
  }

  const user = await User.findOneAndUpdate({ _id: id, role: 'user' }, { isActive }, { returnDocument: 'after' })
    .select(safeUserSelect);
  if (!user) {
    throw { status: 404, message: 'Người dùng không tồn tại' };
  }
  return user;
};

export const updateUserRole = async (id: string, role: string, actorUserId?: string) => {
  if (!adminUserRoleSet.has(role)) {
    throw { status: 400, message: 'Role không hợp lệ' };
  }

  if (actorUserId && actorUserId === id && role !== 'admin') {
    throw { status: 400, message: 'Không thể tự hạ quyền tài khoản đang đăng nhập' };
  }

  const currentUser = await User.findById(id);
  if (!currentUser) {
    throw { status: 404, message: 'Người dùng không tồn tại' };
  }

  await assertNotLastActiveAdmin(currentUser, role as UserRole);

  const user = await User.findByIdAndUpdate(id, { role }, { returnDocument: 'after' })
    .select(safeUserSelect);
  if (!user) {
    throw { status: 404, message: 'Người dùng không tồn tại' };
  }
  return user;
};

export const forcePasswordReset = async (id: string) => {
  const user = await User.findOne({ _id: id, role: 'user' });
  if (!user) {
    throw { status: 404, message: 'Người dùng không tồn tại' };
  }

  const capability = getResetPasswordEmailCapability(user.email);
  const resetToken = capability.testToken ?? crypto.randomBytes(32).toString('hex');
  const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
  const previousAuthState = {
    refreshToken: user.refreshToken ?? null,
    resetPasswordToken: user.resetPasswordToken ?? null,
    resetPasswordExpires: user.resetPasswordExpires ?? null,
    mustChangePassword: user.mustChangePassword,
    passwordChangedAt: user.passwordChangedAt ?? null,
  };

  user.refreshToken = null;
  user.resetPasswordToken = resetTokenHash;
  user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);
  user.mustChangePassword = true;
  user.passwordChangedAt = new Date();
  await user.save();

  try {
    return await sendResetPasswordEmail(user.email, resetToken);
  } catch (error) {
    user.refreshToken = previousAuthState.refreshToken;
    user.resetPasswordToken = previousAuthState.resetPasswordToken;
    user.resetPasswordExpires = previousAuthState.resetPasswordExpires;
    user.mustChangePassword = previousAuthState.mustChangePassword;
    user.passwordChangedAt = previousAuthState.passwordChangedAt;
    await user.save();
    throw error;
  }
};
