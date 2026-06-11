import { Router } from 'express';
import {
  createVNPayUrl,
  createVNPayUrlFromOrder,
  handleVNPayIpn,
  handleVNPayReturn,
} from './payments.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/role.middleware';

const router = Router();

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

// ---------------------------------------------------------------------------
// Callback từ VNPay — không yêu cầu auth vì VNPay server gọi trực tiếp.
// ---------------------------------------------------------------------------
router.get('/vnpay/return', handleVNPayReturn);
router.get('/vnpay/ipn', handleVNPayIpn);

export default router;
