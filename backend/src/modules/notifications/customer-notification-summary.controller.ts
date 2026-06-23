import type { Request, Response } from 'express';
import { error, ok } from '../../utils/response';
import { getCustomerNotificationSummary } from './customer-notification-summary.service';

export const getMyNotificationSummary = async (req: Request, res: Response) => {
  try {
    if (!req.user?.userId) return error(res, 'Authentication required', 401);
    return ok(res, await getCustomerNotificationSummary(req.user.userId));
  } catch (caught) {
    const statusCode = caught instanceof Error && 'statusCode' in caught
      ? Number((caught as Error & { statusCode?: unknown }).statusCode)
      : 500;
    return error(
      res,
      statusCode >= 400 && statusCode < 500 && caught instanceof Error
        ? caught.message
        : 'Unable to load notification summary',
      statusCode >= 400 && statusCode < 500 ? statusCode : 500,
    );
  }
};
