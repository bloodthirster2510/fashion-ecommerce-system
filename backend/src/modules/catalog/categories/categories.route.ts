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

const router = Router();
const adminOnly = [authenticate, authorize('admin')];

router.post('/', adminOnly, createCategory);
router.post('/create', adminOnly, createCategory);
router.put('/:id', adminOnly, updateCategory);
router.put('/update/:id', adminOnly, updateCategory);
router.get('/', listCategories);
router.get('/getAll', getCategories);
router.get('/:id/product-template', getCategoryTemplate);
router.get('/template/:id', getCategoryTemplate);
router.get('/:id', getCategoryById);
router.delete('/:id', adminOnly, deleteCategory);
router.delete('/delete/:id', adminOnly, deleteCategory);

export default router;
