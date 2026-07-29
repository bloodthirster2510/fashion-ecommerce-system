import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { getMyNotificationSummary } from './customer-notification-summary.controller';
import {
  getMyNotifications,
  markAllMyNotificationsRead,
  markMyNotificationRead,
  registerMyPushToken,
  unregisterMyPushToken,
} from './customer-notification.controller';

const router = Router();

router.get('/summary', authenticate, getMyNotificationSummary);
router.post('/push-token', authenticate, registerMyPushToken);
router.delete('/push-token', authenticate, unregisterMyPushToken);
router.get('/', authenticate, getMyNotifications);
router.patch('/read-all', authenticate, markAllMyNotificationsRead);
router.patch('/:id/read', authenticate, markMyNotificationRead);

export default router;
