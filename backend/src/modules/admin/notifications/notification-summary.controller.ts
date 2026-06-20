import type { Request, Response } from 'express';
import { ok, serverError } from '../../../utils/response';
import { getNotificationSummary } from './notification-summary.service';

export const getAdminNotificationSummary = async (req: Request, res: Response) => {
  try {
    const summary = await getNotificationSummary({
      userId: req.user!.userId,
      role: req.user!.role,
    });

    return ok(res, summary);
  } catch {
    return serverError(res, 'Không thể tải tổng hợp thông báo');
  }
};
