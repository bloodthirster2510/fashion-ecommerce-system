import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize, requirePermission } from '../../middlewares/role.middleware';
import * as ghnController from './ghn.controller';

const router = Router();

router.get('/provinces', ghnController.getProvinces);
router.get('/districts', ghnController.getDistricts);
router.get('/wards', ghnController.getWards);

router.get('/services', ghnController.getAvailableServices);
router.post('/fee', ghnController.calculateFee);

router.post(
  '/orders',
  authenticate,
  authorize('admin', 'staff'),
  requirePermission('orders.update'),
  ghnController.createShippingOrder,
);
router.get(
  '/orders/:orderCode',
  authenticate,
  authorize('admin', 'staff'),
  requirePermission('orders.read'),
  ghnController.getOrderDetail,
);
router.post(
  '/orders/cancel',
  authenticate,
  authorize('admin', 'staff'),
  requirePermission('orders.update'),
  ghnController.cancelOrder,
);

export default router;
