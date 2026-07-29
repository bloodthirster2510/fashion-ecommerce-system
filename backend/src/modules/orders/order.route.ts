import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize, requirePermission } from '../../middlewares/role.middleware';
import {
  bulkProcessGhnShipments,
  bulkUpdateOrderStatus,
  cancelOrder,
  cancelGhnShipment,
  confirmOrderReceived,
  createGhnShipment,
  createOrder,
  getMyOrders,
  getOrderById,
  getOrderTransactions,
  getOrders,
  exportOrdersCsv,
  previewCheckout,
  requestReturn,
  reviewReturnRequest,
  simulateShippingWebhook,
  syncGhnShipment,
  updateOrderShipping,
  updateOrderGhnMapping,
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
adminOrderRouter.get('/export.csv', requirePermission('orders.read'), exportOrdersCsv);
adminOrderRouter.patch('/bulk-status', requirePermission('orders.update'), bulkUpdateOrderStatus);
adminOrderRouter.post('/bulk-ghn', requirePermission('orders.update'), bulkProcessGhnShipments);
adminOrderRouter.get('/:id/transactions', requirePermission('orders.read'), getOrderTransactions);
adminOrderRouter.get('/:id', requirePermission('orders.read'), getOrderById);
adminOrderRouter.patch('/:id/cancel', requirePermission('orders.update'), cancelOrder);
adminOrderRouter.patch('/:id/return-request', requirePermission('orders.update'), reviewReturnRequest);
adminOrderRouter.patch('/:id/status', requirePermission('orders.update'), updateOrderStatus);
adminOrderRouter.patch('/:id/shipping', requirePermission('orders.update'), updateOrderShipping);
adminOrderRouter.patch('/:id/ghn-mapping', requirePermission('orders.update'), updateOrderGhnMapping);
adminOrderRouter.post('/:id/ghn-shipment', requirePermission('orders.update'), createGhnShipment);
adminOrderRouter.post('/:id/ghn-shipment/cancel', requirePermission('orders.update'), cancelGhnShipment);
adminOrderRouter.post('/:id/ghn-shipment/sync', requirePermission('orders.update'), syncGhnShipment);
adminOrderRouter.post('/:id/shipping-webhook-simulation', requirePermission('orders.update'), simulateShippingWebhook);

export { adminOrderRouter, customerOrderRouter };
export default customerOrderRouter;
