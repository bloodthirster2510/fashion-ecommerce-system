import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/role.middleware';
import {
  cancelOrder,
  createOrder,
  getMyOrders,
  getOrderById,
  getOrders,
  updateOrderShipping,
  updateOrderStatus,
} from './order.controller';

const router = Router();

router.use(authenticate);

router.post('/', createOrder);
router.get('/me', getMyOrders);
router.get('/', authorize('admin', 'staff'), getOrders);
router.get('/:id', getOrderById);
router.patch('/:id/cancel', cancelOrder);
router.patch('/:id/status', authorize('admin', 'staff'), updateOrderStatus);
router.patch('/:id/shipping', authorize('admin', 'staff'), updateOrderShipping);

export default router;
