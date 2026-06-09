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

const customerProductRouter = Router();
const adminProductRouter = Router();
const adminOnly = [authenticate, authorize('admin')];
const catalogEditors = [authenticate, authorize('admin', 'staff')];

const productImageUpload = upload.fields([
  { name: 'product_image', maxCount: 1 },
  { name: 'version_images', maxCount: 20 },
]);

customerProductRouter.get('/', getProductList);
customerProductRouter.get('/:id', getProductById);

adminProductRouter.get('/', catalogEditors, getProducts);
adminProductRouter.get('/list', catalogEditors, getProductList);
adminProductRouter.get('/getAll', catalogEditors, getProducts);
adminProductRouter.get('/:id', catalogEditors, getProductById);
adminProductRouter.post('/', adminOnly, productImageUpload, createProduct);
adminProductRouter.post('/create', adminOnly, productImageUpload, createProduct);
adminProductRouter.put('/:id', catalogEditors, productImageUpload, updateProduct);
adminProductRouter.put('/update/:id', catalogEditors, productImageUpload, updateProduct);
adminProductRouter.delete('/:id', adminOnly, deleteProduct);
adminProductRouter.delete('/delete/:id', adminOnly, deleteProduct);

export { adminProductRouter, customerProductRouter };
export default customerProductRouter;
