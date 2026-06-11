import { Router } from 'express';
import * as locationController from './location.controller';

const router = Router();

router.get('/provinces', locationController.getProvinces);
router.get('/wards', locationController.getWards);
router.get('/meta', locationController.getMeta);
router.get('/search', locationController.searchLocations);
router.get('/provinces/:provinceCode/wards', locationController.getWards);

export default router;
