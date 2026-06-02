import { Router } from 'express';
import { authenticate } from '../../../middlewares/auth.middleware';
import { authorize } from '../../../middlewares/role.middleware';
import { createBrand, deleteBrand, getBrands, updateBrand } from './brand.controller';

const router = Router();
const adminOnly = [authenticate, authorize('admin')];

router.post('/', adminOnly, createBrand);
router.post('/create', adminOnly, createBrand);
router.put('/:id', adminOnly, updateBrand);
router.put('/update/:id', adminOnly, updateBrand);
router.get('/getAll', getBrands);
router.delete('/:id', adminOnly, deleteBrand);
router.delete('/delete/:id', adminOnly, deleteBrand);

export default router;
