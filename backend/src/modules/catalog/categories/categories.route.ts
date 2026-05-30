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

router.post('/create', createCategory);
router.put('/update/:id', updateCategory);
router.get('/', listCategories);
router.get('/getAll', getCategories);
router.get('/template/:id', getCategoryTemplate);
router.get('/:id', getCategoryById);
router.delete('/delete/:id', deleteCategory);

export default router;
