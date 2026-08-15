import { Router } from 'express';
import { authenticate } from '../../../middlewares/auth.middleware';
import { authorize, requirePermission } from '../../../middlewares/role.middleware';
import { upload, withMulterErrorHandling } from '../../../middlewares/upload.middleware';
import {
  createCategory,
  deleteCategory,
  deleteCategoryPermanently,
  getCategories,
  getCategoriesForManagement,
  getCategoryById,
  getCategoryTemplate,
  listCategories,
  updateCategory,
  upsertCategoryFitTypeTemplate,
  upsertCategorySizeTemplate,
} from './categories.controller';

const customerCategoryRouter = Router();
const adminCategoryRouter = Router();
const catalogReaders = [authenticate, authorize('admin', 'staff'), requirePermission('catalog.read')];
const catalogWriters = [authenticate, authorize('admin', 'staff'), requirePermission('catalog.write')];
const categoryImageUpload = withMulterErrorHandling(
  upload.fields([{ name: 'image', maxCount: 1 }]),
);
const sizeTemplateImageUpload = withMulterErrorHandling(
  upload.fields([{ name: 'sizeGuideImage', maxCount: 1 }]),
);

customerCategoryRouter.get('/', listCategories);
customerCategoryRouter.get('/:id/product-template', getCategoryTemplate);
customerCategoryRouter.get('/template/:id', getCategoryTemplate);
customerCategoryRouter.get('/:id', getCategoryById);

adminCategoryRouter.get('/', catalogReaders, getCategories);
adminCategoryRouter.get('/management', catalogReaders, getCategoriesForManagement);
adminCategoryRouter.get('/list', catalogReaders, listCategories);
adminCategoryRouter.get('/getAll', catalogReaders, getCategories);
adminCategoryRouter.get('/:id/product-template', catalogReaders, getCategoryTemplate);
adminCategoryRouter.get('/template/:id', catalogReaders, getCategoryTemplate);
adminCategoryRouter.get('/:id', catalogReaders, getCategoryById);
adminCategoryRouter.post('/', catalogWriters, categoryImageUpload, createCategory);
adminCategoryRouter.post('/create', catalogWriters, categoryImageUpload, createCategory);
adminCategoryRouter.patch('/:id/size-template', catalogWriters, sizeTemplateImageUpload, upsertCategorySizeTemplate);
adminCategoryRouter.patch('/:id/fit-type-template', catalogWriters, upsertCategoryFitTypeTemplate);
adminCategoryRouter.put('/:id', catalogWriters, categoryImageUpload, updateCategory);
adminCategoryRouter.put('/update/:id', catalogWriters, categoryImageUpload, updateCategory);
adminCategoryRouter.delete('/:id/permanent', catalogWriters, deleteCategoryPermanently);
adminCategoryRouter.delete('/:id', catalogWriters, deleteCategory);
adminCategoryRouter.delete('/delete/:id', catalogWriters, deleteCategory);

export { adminCategoryRouter, customerCategoryRouter };
export default customerCategoryRouter;
