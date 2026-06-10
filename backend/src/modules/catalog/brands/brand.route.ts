import { Router } from 'express';
import { authenticate } from '../../../middlewares/auth.middleware';
import { authorize, requirePermission } from '../../../middlewares/role.middleware';
import { createBrand, deleteBrand, getBrands, updateBrand } from './brand.controller';

const customerBrandRouter = Router();
const adminBrandRouter = Router();
const catalogReaders = [authenticate, authorize('admin', 'staff'), requirePermission('catalog.read')];
const catalogWriters = [authenticate, authorize('admin', 'staff'), requirePermission('catalog.write')];

customerBrandRouter.get('/', getBrands);
customerBrandRouter.get('/getAll', getBrands);

adminBrandRouter.get('/', catalogReaders, getBrands);
adminBrandRouter.get('/getAll', catalogReaders, getBrands);
adminBrandRouter.post('/', catalogWriters, createBrand);
adminBrandRouter.post('/create', catalogWriters, createBrand);
adminBrandRouter.put('/:id', catalogWriters, updateBrand);
adminBrandRouter.put('/update/:id', catalogWriters, updateBrand);
adminBrandRouter.delete('/:id', catalogWriters, deleteBrand);
adminBrandRouter.delete('/delete/:id', catalogWriters, deleteBrand);

export { adminBrandRouter, customerBrandRouter };
export default customerBrandRouter;
