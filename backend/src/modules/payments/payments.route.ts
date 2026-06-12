import { Router } from 'express';
import {
  adjustOrderPaymentStatus,
  createVNPayUrl,
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

// ---------------------------------------------------------------------------
// [Legacy sandbox test] Tạo URL thanh toán trực tiếp — không cần auth.
// Chỉ dùng để test VNPay Sandbox; KHÔNG dùng trong checkout thật.
// ---------------------------------------------------------------------------
router.post('/vnpay/create-payment-url', createVNPayUrl);

// ---------------------------------------------------------------------------
// [Secure] Tạo URL thanh toán từ Order thật — yêu cầu auth.
// Backend tự lấy amount từ Order.totalAmount, không tin amount từ client.
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Callback từ VNPay — không yêu cầu auth vì VNPay server gọi trực tiếp.
// ---------------------------------------------------------------------------
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
