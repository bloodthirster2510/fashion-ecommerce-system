import { Router } from 'express';
import {
  createVNPayUrl,
  handleVNPayIpn,
  handleVNPayReturn,
} from './payments.controller';

const router = Router();

router.post('/vnpay/create-payment-url', createVNPayUrl);
router.get('/vnpay/return', handleVNPayReturn);
router.get('/vnpay/ipn', handleVNPayIpn);

export default router;
