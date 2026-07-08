import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize, requirePermission } from '../../middlewares/role.middleware';
import { previewRecommendations } from './recommendation.controller';

const adminRecommendationRouter = Router();

adminRecommendationRouter.use(authenticate, authorize('admin', 'staff'));
adminRecommendationRouter.get('/preview', requirePermission('reports.read'), previewRecommendations);

export default adminRecommendationRouter;
