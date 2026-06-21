import bcrypt from 'bcryptjs';
import { User, type StaffPermission } from '../../../database/models/user.model';
import { expandImpliedStaffPermissions, STAFF_PERMISSION_SET } from './account.permissions';
import { revokeSupportSocketAccess } from '../../realtime/support.gateway';

const SALT_ROUNDS = 10;
const safeAccountSelect = '-password -refreshToken -resetPasswordToken -resetPasswordExpires';

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

const normalizeEmail = (email: unknown) => {
  const value = firstString(email)?.toLowerCase();
  if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw { status: 400, message: 'Email không hợp lệ' };
  }
  return value;
};

const normalizePassword = (password: unknown) => {
  if (typeof password !== 'string' || password.length < 8) {
    throw { status: 400, message: 'Mật khẩu tạm tối thiểu 8 ký tự' };
  }
  return password;
};

const normalizePermissions = (permissions: unknown): StaffPermission[] => {
  if (!Array.isArray(permissions)) {
    return [];
  }

  const normalized = permissions
    .filter((permission): permission is string => typeof permission === 'string')
    .filter((permission) => STAFF_PERMISSION_SET.has(permission));

  return expandImpliedStaffPermissions(Array.from(new Set(normalized)) as StaffPermission[]);
};

const assertNoDuplicateContact = async (email: string, phone?: string) => {
  const clauses: Record<string, string>[] = [{ email }];

  if (phone) {
    clauses.push({ phone });
  }

  const existingUser = await User.findOne({ $or: clauses }).select('email phone').lean<{
    email?: string;
    phone?: string;
  } | null>();

  if (!existingUser) {
    return;
  }

  if (existingUser.email === email) {
    throw { status: 409, message: 'Email đã được sử dụng' };
  }

  throw { status: 409, message: 'Số điện thoại đã được sử dụng' };
};

export const listInternalAccounts = async (query: {
  role?: unknown;
  isActive?: unknown;
  keyword?: unknown;
  page?: unknown;
  limit?: unknown;
}) => {
  const filter: Record<string, unknown> = { role: { $in: ['admin', 'staff'] } };
  const role = firstString(query.role);
  const keyword = firstString(query.keyword);
  const isActive = parseStatusFilter(query.isActive);

  if (role) {
    if (!['admin', 'staff'].includes(role)) {
      throw { status: 400, message: 'Role không hợp lệ' };
    }

    filter.role = role;
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

  const page = parsePositiveInteger(query.page, 1, 10000);
  const limit = parsePositiveInteger(query.limit, 10, 100);
  const skip = (page - 1) * limit;

  const [accounts, total] = await Promise.all([
    User.find(filter)
      .select(safeAccountSelect)
      .sort({ role: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  return {
    items: accounts,
    totalItems: total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

export const createStaffAccount = async (actorUserId: string, data: {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  password?: unknown;
  permissions?: unknown;
}) => {
  const name = firstString(data.name);
  if (!name || name.length < 2) {
    throw { status: 400, message: 'Tên staff tối thiểu 2 ký tự' };
  }

  const email = normalizeEmail(data.email);
  const phone = firstString(data.phone);
  const password = normalizePassword(data.password);
  const permissions = normalizePermissions(data.permissions);

  await assertNoDuplicateContact(email, phone);

  const staff = await User.create({
    name,
    email,
    phone: phone || undefined,
    password: await bcrypt.hash(password, SALT_ROUNDS),
    role: 'staff',
    permissions,
    isActive: true,
    mustChangePassword: true,
    profileCompleted: false,
    address: [],
    createdBy: actorUserId,
  });

  return User.findById(staff._id).select(safeAccountSelect);
};

export const updateStaffStatus = async (id: string, isActive: boolean, actorUserId: string) => {
  if (typeof isActive !== 'boolean') {
    throw { status: 400, message: 'Trạng thái tài khoản không hợp lệ' };
  }

  if (actorUserId === id && !isActive) {
    throw { status: 400, message: 'Không thể khóa tài khoản đang đăng nhập' };
  }

  const staff = await User.findOneAndUpdate(
    { _id: id, role: 'staff' },
    { isActive },
    { returnDocument: 'after' },
  ).select(safeAccountSelect);

  if (!staff) {
    throw { status: 404, message: 'Tài khoản staff không tồn tại' };
  }

  revokeSupportSocketAccess(id);
  return staff;
};

export const updateStaffPermissions = async (id: string, permissions: unknown) => {
  const normalizedPermissions = normalizePermissions(permissions);

  const staff = await User.findOneAndUpdate(
    { _id: id, role: 'staff' },
    { permissions: normalizedPermissions },
    { returnDocument: 'after' },
  ).select(safeAccountSelect);

  if (!staff) {
    throw { status: 404, message: 'Tài khoản staff không tồn tại' };
  }

  revokeSupportSocketAccess(id);
  return staff;
};

export const resetStaffTemporaryPassword = async (id: string, temporaryPassword: unknown) => {
  const password = normalizePassword(temporaryPassword);

  const staff = await User.findOneAndUpdate(
    { _id: id, role: 'staff' },
    {
      password: await bcrypt.hash(password, SALT_ROUNDS),
      mustChangePassword: true,
      refreshToken: null,
      passwordChangedAt: null,
    },
    { returnDocument: 'after' },
  ).select(safeAccountSelect);

  if (!staff) {
    throw { status: 404, message: 'Tài khoản staff không tồn tại' };
  }

  return staff;
};
