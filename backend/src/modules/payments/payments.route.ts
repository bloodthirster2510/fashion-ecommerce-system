import { Router } from 'express';
import {
  adjustOrderPaymentStatus,
  createVNPayUrlFromOrder,
  expireStalePaymentAttempts,
  getOrderPaymentStatus,
  handleVNPayIpn,
  handleVNPayReturn,
} from './payments.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize, requirePermission } from '../../middlewares/role.middleware';

const router = Router();
const adminPaymentRouter = Router();

// Secure VNPay checkout: users create payment URLs only from real orders.
// The backend always uses Order.totalAmount instead of trusting client amount.
router.post(
  '/vnpay/orders/:orderId/create-payment-url',
  authenticate,
  authorize('user'),
  createVNPayUrlFromOrder,
);

router.get(
  '/orders/:orderId/status',
  authenticate,
  authorize('user'),
  getOrderPaymentStatus,
);

// VNPay callbacks are unauthenticated because VNPay calls them directly.
router.get('/vnpay/return', handleVNPayReturn);
router.get('/vnpay/ipn', handleVNPayIpn);

adminPaymentRouter.use(authenticate);
adminPaymentRouter.use(authorize('admin', 'staff'));
adminPaymentRouter.post(
  '/expire-stale',
  requirePermission('orders.update'),
  expireStalePaymentAttempts,
);
adminPaymentRouter.patch(
  '/orders/:orderId/payment-status',
  requirePermission('payments.adjust'),
  adjustOrderPaymentStatus,
);

export { adminPaymentRouter };
export default router;
