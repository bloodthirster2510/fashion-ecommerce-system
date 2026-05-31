import { Router } from 'express';
import { upload } from '../../../middlewares/upload.middleware';
import {
  createProduct,
  deleteProduct,
  getProductList,
  getProductById,
  getProducts,
  updateProduct,
} from './product.controller';

const router = Router();

const productImageUpload = upload.fields([
  { name: 'product_image', maxCount: 1 },
  { name: 'version_images', maxCount: 20 },
]);

router.post('/', productImageUpload, createProduct);
router.post('/create', productImageUpload, createProduct);
router.put('/:id', productImageUpload, updateProduct);
router.put('/update/:id', productImageUpload, updateProduct);
router.get('/', getProductList);
router.get('/getAll', getProducts);
router.get('/:id', getProductById);
router.delete('/:id', deleteProduct);
router.delete('/delete/:id', deleteProduct);

export default router;
