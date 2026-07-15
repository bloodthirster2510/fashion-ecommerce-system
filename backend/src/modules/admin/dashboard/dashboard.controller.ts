import type { Request, Response } from 'express';
import { error, ok, serverError } from '../../../utils/response';
import { getDashboardOverview } from './dashboard.service';

export const getAdminDashboardOverview = async (req: Request, res: Response) => {
  try {
    const overview = await getDashboardOverview(
      {
        userId: req.user!.userId,
        role: req.user!.role,
      },
      req.query,
    );

    return ok(res, overview);
  } catch (caught) {
    const statusCode = typeof caught === 'object' && caught && 'statusCode' in caught
      ? Number(caught.statusCode)
      : 500;
    const message = caught instanceof Error ? caught.message : 'Không thể tải tổng quan cửa hàng';

    if (statusCode >= 400 && statusCode < 500) return error(res, message, statusCode);
    return serverError(res, 'Không thể tải tổng quan cửa hàng');
  }
};

