import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/role.middleware';
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
adminOrderRouter.get('/', getOrders);
adminOrderRouter.get('/:id', getOrderById);
adminOrderRouter.patch('/:id/cancel', cancelOrder);
adminOrderRouter.patch('/:id/status', updateOrderStatus);
adminOrderRouter.patch('/:id/shipping', updateOrderShipping);

export { adminOrderRouter, customerOrderRouter };
export default customerOrderRouter;
