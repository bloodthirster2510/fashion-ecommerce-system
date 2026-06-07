import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { getShippingRates } from './shipping.controller';

const router = Router();

router.use(authenticate);

router.post('/rates', getShippingRates);

export default router;
