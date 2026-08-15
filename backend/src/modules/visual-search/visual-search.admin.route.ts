import { Router } from 'express';
import { authenticate, requireActiveAccount } from '../../middlewares/auth.middleware';
import { authorize, requirePermission } from '../../middlewares/role.middleware';
import {
  backfillAdminVisualIndex,
  getAdminVisualIndexStatus,
} from './visual-search.admin.controller';

const adminVisualSearchRouter = Router();

adminVisualSearchRouter.use(authenticate, requireActiveAccount, authorize('admin', 'staff'));
adminVisualSearchRouter.get('/index', requirePermission('products.read'), getAdminVisualIndexStatus);
adminVisualSearchRouter.post('/index/backfill', requirePermission('products.write'), backfillAdminVisualIndex);

export default adminVisualSearchRouter;
