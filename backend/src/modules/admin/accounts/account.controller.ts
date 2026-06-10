import { Request, Response } from 'express';
import { ok, created } from '../../../utils/response';
import * as accountService from './account.service';

const getParam = (value: unknown) => (typeof value === 'string' ? value : '');

const handleAccountError = (res: Response, err: unknown) => {
  if (err && typeof err === 'object' && 'status' in err && 'message' in err) {
    return res.status((err as { status: number }).status).json({
      message: (err as { message: string }).message,
    });
  }

  return res.status(500).json({ message: 'Lỗi server' });
};

export const listAccounts = async (req: Request, res: Response) => {
  try {
    const result = await accountService.listInternalAccounts(req.query);
    return ok(res, result);
  } catch (err: unknown) {
    return handleAccountError(res, err);
  }
};

export const createStaffAccount = async (req: Request, res: Response) => {
  try {
    const staff = await accountService.createStaffAccount(req.user!.userId, req.body);
    return created(res, staff, 'Đã tạo tài khoản staff');
  } catch (err: unknown) {
    return handleAccountError(res, err);
  }
};

export const updateStaffStatus = async (req: Request, res: Response) => {
  try {
    const staff = await accountService.updateStaffStatus(
      getParam(req.params.id),
      req.body.isActive,
      req.user!.userId,
    );
    return ok(res, staff, 'Đã cập nhật trạng thái staff');
  } catch (err: unknown) {
    return handleAccountError(res, err);
  }
};

export const updateStaffPermissions = async (req: Request, res: Response) => {
  try {
    const staff = await accountService.updateStaffPermissions(
      getParam(req.params.id),
      req.body.permissions,
    );
    return ok(res, staff, 'Đã cập nhật quyền staff');
  } catch (err: unknown) {
    return handleAccountError(res, err);
  }
};

export const resetStaffTemporaryPassword = async (req: Request, res: Response) => {
  try {
    const staff = await accountService.resetStaffTemporaryPassword(
      getParam(req.params.id),
      req.body.temporaryPassword,
    );
    return ok(res, staff, 'Đã đặt mật khẩu tạm cho staff');
  } catch (err: unknown) {
    return handleAccountError(res, err);
  }
};
