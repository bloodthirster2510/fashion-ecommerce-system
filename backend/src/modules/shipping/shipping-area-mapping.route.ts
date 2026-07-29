import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize, requirePermission } from '../../middlewares/role.middleware';
import {
  importShippingAreaMappings,
  getShippingAreaMappingCoverage,
  listShippingAreaMappings,
  reviewShippingAreaMapping,
} from './shipping-area-mapping.controller';

const router = Router();

router.use(authenticate);
router.use(authorize('admin', 'staff'));
router.get('/coverage', requirePermission('orders.read'), getShippingAreaMappingCoverage);
router.get('/', requirePermission('orders.read'), listShippingAreaMappings);
router.post('/import', requirePermission('orders.update'), importShippingAreaMappings);
router.patch('/:id/review', requirePermission('orders.update'), reviewShippingAreaMapping);

export default router;
