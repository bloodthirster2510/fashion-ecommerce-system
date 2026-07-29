import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize, requirePermission } from '../../middlewares/role.middleware';
import * as ghnController from './ghn.controller';

const router = Router();

router.get('/provinces', ghnController.getProvinces);
router.get('/districts', ghnController.getDistricts);
router.get('/wards', ghnController.getWards);

router.get('/services', authenticate, ghnController.getAvailableServices);
router.post('/fee', authenticate, ghnController.calculateFee);

// Tạo vận đơn chỉ đi qua /api/admin/orders/:id/ghn-shipment để bắt buộc
// kiểm tra payment, trạng thái đơn và mapping địa chỉ đã xác minh.
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
