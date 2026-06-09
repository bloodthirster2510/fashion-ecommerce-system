import { Router } from 'express';
import { authenticate } from '../../../middlewares/auth.middleware';
import { authorize } from '../../../middlewares/role.middleware';
import { createBrand, deleteBrand, getBrands, updateBrand } from './brand.controller';

const customerBrandRouter = Router();
const adminBrandRouter = Router();
const adminOnly = [authenticate, authorize('admin')];

customerBrandRouter.get('/', getBrands);
customerBrandRouter.get('/getAll', getBrands);

adminBrandRouter.get('/', authenticate, authorize('admin', 'staff'), getBrands);
adminBrandRouter.get('/getAll', authenticate, authorize('admin', 'staff'), getBrands);
adminBrandRouter.post('/', adminOnly, createBrand);
adminBrandRouter.post('/create', adminOnly, createBrand);
adminBrandRouter.put('/:id', adminOnly, updateBrand);
adminBrandRouter.put('/update/:id', adminOnly, updateBrand);
adminBrandRouter.delete('/:id', adminOnly, deleteBrand);
adminBrandRouter.delete('/delete/:id', adminOnly, deleteBrand);

export { adminBrandRouter, customerBrandRouter };
export default customerBrandRouter;
