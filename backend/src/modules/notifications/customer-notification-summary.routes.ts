import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { getMyNotificationSummary } from './customer-notification-summary.controller';

const router = Router();

router.get('/summary', authenticate, getMyNotificationSummary);

export default router;
