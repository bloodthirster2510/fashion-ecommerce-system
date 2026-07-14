import { Router } from 'express';
import { authenticate } from '../../../middlewares/auth.middleware';
import { authorize } from '../../../middlewares/role.middleware';
import { getAdminDashboardOverview } from './dashboard.controller';

const dashboardRouter = Router();

dashboardRouter.get(
  '/overview',
  authenticate,
  authorize('admin', 'staff'),
  getAdminDashboardOverview,
);

export default dashboardRouter;

