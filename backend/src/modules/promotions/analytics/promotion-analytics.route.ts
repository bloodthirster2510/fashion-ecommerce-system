import { Router } from 'express';
import { authenticate } from '../../../middlewares/auth.middleware';
import { authorize, requirePermission } from '../../../middlewares/role.middleware';
import { getPromotionAnalytics } from './promotion-analytics.controller';

export const adminPromotionAnalyticsRouter = Router();
adminPromotionAnalyticsRouter.get(
  '/',
  authenticate,
  authorize('admin', 'staff'),
  requirePermission('promotions.read'),
  getPromotionAnalytics,
);
