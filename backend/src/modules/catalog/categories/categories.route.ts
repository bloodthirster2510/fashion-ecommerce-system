import { Router } from 'express';
import {
  createCategory,
  deleteCategory,
  getCategories,
  getCategoryById,
  updateCategory,
} from './categories.controller';

const router = Router();

router.post('/create', createCategory);
router.put('/update/:id', updateCategory);
router.get('/getAll', getCategories);
router.get('/:id', getCategoryById);
router.delete('/delete/:id', deleteCategory);

export default router;
