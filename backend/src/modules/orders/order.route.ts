import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize, requirePermission } from '../../middlewares/role.middleware';
import {
  cancelOrder,
  createOrder,
  getMyOrders,
  getOrderById,
  getOrders,
  previewCheckout,
  updateOrderShipping,
  updateOrderStatus,
} from './order.controller';

const customerOrderRouter = Router();
const adminOrderRouter = Router();

customerOrderRouter.use(authenticate);
customerOrderRouter.use(authorize('user'));
customerOrderRouter.post('/preview', previewCheckout);
customerOrderRouter.post('/', createOrder);
customerOrderRouter.get('/me', getMyOrders);
customerOrderRouter.get('/:id', getOrderById);
customerOrderRouter.patch('/:id/cancel', cancelOrder);

adminOrderRouter.use(authenticate);
adminOrderRouter.use(authorize('admin', 'staff'));
adminOrderRouter.get('/', requirePermission('orders.read'), getOrders);
adminOrderRouter.get('/:id', requirePermission('orders.read'), getOrderById);
adminOrderRouter.patch('/:id/cancel', requirePermission('orders.update'), cancelOrder);
adminOrderRouter.patch('/:id/status', requirePermission('orders.update'), updateOrderStatus);
adminOrderRouter.patch('/:id/shipping', requirePermission('orders.update'), updateOrderShipping);

export { adminOrderRouter, customerOrderRouter };
export default customerOrderRouter;
