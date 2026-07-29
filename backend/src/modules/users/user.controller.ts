import { Request, Response } from 'express';
import * as userService from './user.service';
import { validateUpdateProfile, validateAddress } from '../../validators/user.validator';
import { ok, created, noContent } from '../../utils/response';

const getParam = (value: unknown): string => {
  return typeof value === 'string' ? value : '';
};

const handleAddressError = (res: Response, err: unknown) => {
  if (err && typeof err === 'object' && 'status' in err && 'message' in err) {
    return res.status((err as { status: number }).status).json({ message: (err as { message: string }).message });
  }

  if (err && typeof err === 'object' && 'name' in err && (err as { name?: string }).name === 'ValidationError') {
    const validationErrors = Object.values(
      (err as { errors?: Record<string, { path?: string; message?: string }> }).errors ?? {},
    ).map((error) => ({
      field: error.path ?? 'address',
      message: error.message ?? 'Dữ liệu không hợp lệ',
    }));

    return res.status(400).json({
      message: 'Dữ liệu không hợp lệ',
      ...(validationErrors.length > 0 ? { errors: validationErrors } : {}),
    });
  }

  return res.status(500).json({ message: 'Lỗi server' });
};

export const getMe = async (req: Request, res: Response) => {
  try {
    const user = await userService.getMe(req.user!.userId);
    return ok(res, user);
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err && 'message' in err) {
      return res.status((err as { status: number }).status).json({ message: (err as { message: string }).message });
    }
    if (err && typeof err === 'object' && 'name' in err && (err as { name?: string }).name === 'ValidationError') {
      return handleAddressError(res, err);
    }
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

export const updateMe = async (req: Request, res: Response) => {
  const errors = validateUpdateProfile(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ message: 'Dữ liệu không hợp lệ', errors });
  }

  try {
    const user = await userService.updateMe(req.user!.userId, req.body);
    return ok(res, user, 'Cập nhật thông tin thành công');
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err && 'message' in err) {
      return res.status((err as { status: number }).status).json({ message: (err as { message: string }).message });
    }
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

export const uploadAvatar = async (req: Request, res: Response) => {
  try {
    const user = await userService.uploadAvatar(req.user!.userId, req.body);
    return ok(res, user, 'Cập nhật ảnh đại diện thành công');
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err && 'message' in err) {
      return res.status((err as { status: number }).status).json({ message: (err as { message: string }).message });
    }
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

export const getAddresses = async (req: Request, res: Response) => {
  try {
    const addresses = await userService.getAddresses(req.user!.userId);
    return ok(res, addresses);
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err && 'message' in err) {
      return res.status((err as { status: number }).status).json({ message: (err as { message: string }).message });
    }
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

export const addAddress = async (req: Request, res: Response) => {
  const errors = validateAddress(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ message: 'Dữ liệu không hợp lệ', errors });
  }

  try {
    const addresses = await userService.addAddress(req.user!.userId, req.body);
    return created(res, addresses, 'Thêm địa chỉ thành công');
  } catch (err: unknown) {
    return handleAddressError(res, err);
  }
};

export const updateAddress = async (req: Request, res: Response) => {
  try {
    const addresses = await userService.updateAddress(req.user!.userId, getParam(req.params.addressId), req.body);
    return ok(res, addresses, 'Cập nhật địa chỉ thành công');
  } catch (err: unknown) {
    return handleAddressError(res, err);
  }
};

export const deleteAddress = async (req: Request, res: Response) => {
  try {
    await userService.deleteAddress(req.user!.userId, getParam(req.params.addressId));
    return noContent(res);
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err && 'message' in err) {
      return res.status((err as { status: number }).status).json({ message: (err as { message: string }).message });
    }
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

export const setDefaultAddress = async (req: Request, res: Response) => {
  try {
    const addresses = await userService.setDefaultAddress(req.user!.userId, getParam(req.params.addressId));
    return ok(res, addresses, 'Đã đặt địa chỉ mặc định');
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err && 'message' in err) {
      return res.status((err as { status: number }).status).json({ message: (err as { message: string }).message });
    }
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

export const getUsers = async (req: Request, res: Response) => {
  try {
    const result = await userService.getUsers(req.query);
    return ok(res, result);
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err && 'message' in err) {
      return res.status((err as { status: number }).status).json({ message: (err as { message: string }).message });
    }
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

export const getCustomerSummary = async (req: Request, res: Response) => {
  try {
    const result = await userService.getCustomerSummary(req.query);
    return ok(res, result);
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err && 'message' in err) {
      return res.status((err as { status: number }).status).json({ message: (err as { message: string }).message });
    }
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

export const getUserById = async (req: Request, res: Response) => {
  try {
    const user = await userService.getUserById(getParam(req.params.id));
    return ok(res, user);
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err && 'message' in err) {
      return res.status((err as { status: number }).status).json({ message: (err as { message: string }).message });
    }
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

export const updateUserStatus = async (req: Request, res: Response) => {
  try {
    const user = await userService.updateUserStatus(getParam(req.params.id), req.body.isActive, req.user!.userId);
    return ok(res, user, 'Cập nhật trạng thái thành công');
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err && 'message' in err) {
      return res.status((err as { status: number }).status).json({ message: (err as { message: string }).message });
    }
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

export const updateUserRole = async (req: Request, res: Response) => {
  try {
    const user = await userService.updateUserRole(getParam(req.params.id), req.body.role, req.user!.userId);
    return ok(res, user, 'Cập nhật quyền thành công');
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err && 'message' in err) {
      return res.status((err as { status: number }).status).json({ message: (err as { message: string }).message });
    }
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

export const forcePasswordReset = async (req: Request, res: Response) => {
  try {
    const delivery = await userService.forcePasswordReset(getParam(req.params.id));
    return ok(res, delivery, 'Đã yêu cầu đặt lại mật khẩu');
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err && 'message' in err) {
      return res.status((err as { status: number }).status).json({ message: (err as { message: string }).message });
    }
    return res.status(500).json({ message: 'Lỗi server' });
  }
};
