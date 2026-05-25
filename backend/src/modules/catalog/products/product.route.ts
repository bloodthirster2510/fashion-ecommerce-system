import { Router } from 'express';
import {
  createProduct,
  deleteProduct,
  getProductById,
  getProducts,
  updateProduct,
} from './product.controller';

const router = Router();

router.post('/create', createProduct);
router.put('/update/:id', updateProduct);
router.get('/getAll', getProducts);
router.get('/:id', getProductById);
router.delete('/delete/:id', deleteProduct);

export default router;
