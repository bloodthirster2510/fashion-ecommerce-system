import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { getShippingRates } from './shipping.controller';
import { handleGhnShippingWebhook, handleSimulatedShippingWebhook } from '../orders/order.controller';

const router = Router();

router.post('/webhooks/ghn', handleGhnShippingWebhook);
router.post('/webhooks/simulated', handleSimulatedShippingWebhook);

router.use(authenticate);

router.post('/rates', getShippingRates);

export default router;
