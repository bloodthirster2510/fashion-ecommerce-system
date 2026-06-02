import { Router } from 'express';
import { authenticate } from '../../../middlewares/auth.middleware';
import { authorize } from '../../../middlewares/role.middleware';
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
const adminOnly = [authenticate, authorize('admin')];
const catalogEditors = [authenticate, authorize('admin', 'staff')];

const productImageUpload = upload.fields([
  { name: 'product_image', maxCount: 1 },
  { name: 'version_images', maxCount: 20 },
]);

router.post('/', adminOnly, productImageUpload, createProduct);
router.post('/create', adminOnly, productImageUpload, createProduct);
router.put('/:id', catalogEditors, productImageUpload, updateProduct);
router.put('/update/:id', catalogEditors, productImageUpload, updateProduct);
router.get('/', getProductList);
router.get('/getAll', catalogEditors, getProducts);
router.get('/:id', getProductById);
router.delete('/:id', adminOnly, deleteProduct);
router.delete('/delete/:id', adminOnly, deleteProduct);

export default router;
