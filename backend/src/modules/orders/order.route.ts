import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize, requirePermission } from '../../middlewares/role.middleware';
import {
  cancelOrder,
  confirmOrderReceived,
  createOrder,
  getMyOrders,
  getOrderById,
  getOrderTransactions,
  getOrders,
  previewCheckout,
  requestReturn,
  reviewReturnRequest,
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
customerOrderRouter.patch('/:id/confirm-received', confirmOrderReceived);
customerOrderRouter.patch('/:id/request-return', requestReturn);

adminOrderRouter.use(authenticate);
adminOrderRouter.use(authorize('admin', 'staff'));
adminOrderRouter.get('/', requirePermission('orders.read'), getOrders);
adminOrderRouter.get('/:id/transactions', requirePermission('orders.read'), getOrderTransactions);
adminOrderRouter.get('/:id', requirePermission('orders.read'), getOrderById);
adminOrderRouter.patch('/:id/cancel', requirePermission('orders.update'), cancelOrder);
adminOrderRouter.patch('/:id/return-request', requirePermission('orders.update'), reviewReturnRequest);
adminOrderRouter.patch('/:id/status', requirePermission('orders.update'), updateOrderStatus);
adminOrderRouter.patch('/:id/shipping', requirePermission('orders.update'), updateOrderShipping);

export { adminOrderRouter, customerOrderRouter };
export default customerOrderRouter;
