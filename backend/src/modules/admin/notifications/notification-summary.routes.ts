import { Router } from 'express';
import { authenticate } from '../../../middlewares/auth.middleware';
import { authorize } from '../../../middlewares/role.middleware';
import { getAdminNotificationSummary } from './notification-summary.controller';

const notificationSummaryRouter = Router();

notificationSummaryRouter.get(
  '/summary',
  authenticate,
  authorize('admin', 'staff'),
  getAdminNotificationSummary,
);

export default notificationSummaryRouter;
