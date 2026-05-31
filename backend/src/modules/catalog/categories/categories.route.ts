import { Router } from 'express';
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

router.post('/', createCategory);
router.post('/create', createCategory);
router.put('/:id', updateCategory);
router.put('/update/:id', updateCategory);
router.get('/', listCategories);
router.get('/getAll', getCategories);
router.get('/:id/product-template', getCategoryTemplate);
router.get('/template/:id', getCategoryTemplate);
router.get('/:id', getCategoryById);
router.delete('/:id', deleteCategory);
router.delete('/delete/:id', deleteCategory);

export default router;
