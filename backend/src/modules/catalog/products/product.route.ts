import { Router } from 'express';
import { upload } from '../../../middlewares/upload.middleware';
import {
  createProduct,
  deleteProduct,
  getProductById,
  getProducts,
  updateProduct,
} from './product.controller';

const router = Router();

const productImageUpload = upload.fields([
  { name: 'product_image', maxCount: 1 },
  { name: 'version_images', maxCount: 20 },
]);

router.post('/create', productImageUpload, createProduct);
router.put('/update/:id', productImageUpload, updateProduct);
router.get('/getAll', getProducts);
router.get('/:id', getProductById);
router.delete('/delete/:id', deleteProduct);

export default router;
