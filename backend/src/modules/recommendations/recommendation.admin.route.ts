import { Router } from 'express';
import { authenticate, requireActiveAccount } from '../../middlewares/auth.middleware';
import { authorize, requirePermission } from '../../middlewares/role.middleware';
import {
  getRecommendationAnalytics,
  previewRecommendations,
} from './recommendation.controller';

const adminRecommendationRouter = Router();

adminRecommendationRouter.use(authenticate, requireActiveAccount, authorize('admin', 'staff'));
adminRecommendationRouter.get('/analytics', requirePermission('reports.read'), getRecommendationAnalytics);
adminRecommendationRouter.get('/preview', requirePermission('reports.read'), previewRecommendations);

export default adminRecommendationRouter;
