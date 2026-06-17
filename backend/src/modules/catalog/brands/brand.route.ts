import { Router } from 'express';
import { authenticate } from '../../../middlewares/auth.middleware';
import { authorize, requirePermission } from '../../../middlewares/role.middleware';
import { upload, withMulterErrorHandling } from '../../../middlewares/upload.middleware';
import {
  createBrand,
  deleteBrand,
  deleteBrandPermanently,
  getBrands,
  getBrandsForManagement,
  updateBrand,
} from './brand.controller';

const customerBrandRouter = Router();
const adminBrandRouter = Router();
const catalogReaders = [authenticate, authorize('admin', 'staff'), requirePermission('catalog.read')];
const catalogWriters = [authenticate, authorize('admin', 'staff'), requirePermission('catalog.write')];
const brandImageUpload = withMulterErrorHandling(upload.single('image'));

customerBrandRouter.get('/', getBrands);
customerBrandRouter.get('/getAll', getBrands);

adminBrandRouter.get('/', catalogReaders, getBrands);
adminBrandRouter.get('/management', catalogReaders, getBrandsForManagement);
adminBrandRouter.get('/getAll', catalogReaders, getBrands);
adminBrandRouter.post('/', catalogWriters, brandImageUpload, createBrand);
adminBrandRouter.post('/create', catalogWriters, brandImageUpload, createBrand);
adminBrandRouter.put('/:id', catalogWriters, brandImageUpload, updateBrand);
adminBrandRouter.put('/update/:id', catalogWriters, brandImageUpload, updateBrand);
adminBrandRouter.delete('/:id/permanent', catalogWriters, deleteBrandPermanently);
adminBrandRouter.delete('/:id', catalogWriters, deleteBrand);
adminBrandRouter.delete('/delete/:id', catalogWriters, deleteBrand);

export { adminBrandRouter, customerBrandRouter };
export default customerBrandRouter;
