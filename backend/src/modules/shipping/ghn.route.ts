import { Router } from 'express';
import * as ghnController from './ghn.controller';

const router = Router();

router.get('/provinces', ghnController.getProvinces);
router.get('/districts', ghnController.getDistricts);
router.get('/wards', ghnController.getWards);

router.get('/services', ghnController.getAvailableServices);
router.post('/fee', ghnController.calculateFee);

router.post('/orders', ghnController.createShippingOrder);
router.get('/orders/:orderCode', ghnController.getOrderDetail);
router.post('/orders/cancel', ghnController.cancelOrder);

export default router;
