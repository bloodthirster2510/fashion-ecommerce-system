import { Router } from 'express';
import { authenticate } from '../../../middlewares/auth.middleware';
import { authorize } from '../../../middlewares/role.middleware';
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
const adminOnly = [authenticate, authorize('admin')];

customerCategoryRouter.get('/', listCategories);
customerCategoryRouter.get('/:id/product-template', getCategoryTemplate);
customerCategoryRouter.get('/template/:id', getCategoryTemplate);
customerCategoryRouter.get('/:id', getCategoryById);

adminCategoryRouter.get('/', authenticate, authorize('admin', 'staff'), getCategories);
adminCategoryRouter.get('/list', authenticate, authorize('admin', 'staff'), listCategories);
adminCategoryRouter.get('/getAll', authenticate, authorize('admin', 'staff'), getCategories);
adminCategoryRouter.get('/:id/product-template', authenticate, authorize('admin', 'staff'), getCategoryTemplate);
adminCategoryRouter.get('/template/:id', authenticate, authorize('admin', 'staff'), getCategoryTemplate);
adminCategoryRouter.get('/:id', authenticate, authorize('admin', 'staff'), getCategoryById);
adminCategoryRouter.post('/', adminOnly, createCategory);
adminCategoryRouter.post('/create', adminOnly, createCategory);
adminCategoryRouter.put('/:id', adminOnly, updateCategory);
adminCategoryRouter.put('/update/:id', adminOnly, updateCategory);
adminCategoryRouter.delete('/:id', adminOnly, deleteCategory);
adminCategoryRouter.delete('/delete/:id', adminOnly, deleteCategory);

export { adminCategoryRouter, customerCategoryRouter };
export default customerCategoryRouter;
