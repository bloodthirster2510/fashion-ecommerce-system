import { Router } from 'express';
import { authenticate, requireActiveAccount } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/role.middleware';
import { getMyNotificationSummary } from './customer-notification-summary.controller';
import {
  getMyNotifications,
  markAllMyNotificationsRead,
  markMyNotificationRead,
  registerMyPushToken,
  unregisterMyPushToken,
} from './customer-notification.controller';

const router = Router();

router.use(authenticate, requireActiveAccount, authorize('user'));
router.get('/summary', getMyNotificationSummary);
router.post('/push-token', registerMyPushToken);
router.delete('/push-token', unregisterMyPushToken);
router.get('/', getMyNotifications);
router.patch('/read-all', markAllMyNotificationsRead);
router.patch('/:id/read', markMyNotificationRead);

export default router;
