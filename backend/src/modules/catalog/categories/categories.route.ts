import { Router } from 'express';
import { authenticate } from '../../../middlewares/auth.middleware';
import { authorize, requirePermission } from '../../../middlewares/role.middleware';
import {
  createCategory,
  deleteCategory,
  getCategories,
  getCategoryById,
  getCategoryTemplate,
  listCategories,
  updateCategory,
} from './categories.controller';

const customerCategoryRouter = Router();
const adminCategoryRouter = Router();
const catalogReaders = [authenticate, authorize('admin', 'staff'), requirePermission('catalog.read')];
const catalogWriters = [authenticate, authorize('admin', 'staff'), requirePermission('catalog.write')];

customerCategoryRouter.get('/', listCategories);
customerCategoryRouter.get('/:id/product-template', getCategoryTemplate);
customerCategoryRouter.get('/template/:id', getCategoryTemplate);
customerCategoryRouter.get('/:id', getCategoryById);

adminCategoryRouter.get('/', catalogReaders, getCategories);
adminCategoryRouter.get('/list', catalogReaders, listCategories);
adminCategoryRouter.get('/getAll', catalogReaders, getCategories);
adminCategoryRouter.get('/:id/product-template', catalogReaders, getCategoryTemplate);
adminCategoryRouter.get('/template/:id', catalogReaders, getCategoryTemplate);
adminCategoryRouter.get('/:id', catalogReaders, getCategoryById);
adminCategoryRouter.post('/', catalogWriters, createCategory);
adminCategoryRouter.post('/create', catalogWriters, createCategory);
adminCategoryRouter.put('/:id', catalogWriters, updateCategory);
adminCategoryRouter.put('/update/:id', catalogWriters, updateCategory);
adminCategoryRouter.delete('/:id', catalogWriters, deleteCategory);
adminCategoryRouter.delete('/delete/:id', catalogWriters, deleteCategory);

export { adminCategoryRouter, customerCategoryRouter };
export default customerCategoryRouter;
