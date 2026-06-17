import { Router } from 'express';
import { authenticate } from '../../../middlewares/auth.middleware';
import { authorize, requirePermission } from '../../../middlewares/role.middleware';
import { upload, withMulterErrorHandling } from '../../../middlewares/upload.middleware';
import {
  createProduct,
  deleteProduct,
  getProductFilters,
  getProductList,
  getProductById,
  getProducts,
  permanentlyDeleteProduct,
  updateProduct,
} from './product.controller';

const customerProductRouter = Router();
const adminProductRouter = Router();
const productReaders = [authenticate, authorize('admin', 'staff'), requirePermission('products.read')];
const productWriters = [authenticate, authorize('admin', 'staff'), requirePermission('products.write')];

const productImageUpload = withMulterErrorHandling(
  upload.fields([
    { name: 'product_image', maxCount: 1 },
    { name: 'version_images', maxCount: 20 },
  ]),
);

customerProductRouter.get('/', getProductList);
customerProductRouter.get('/filters', getProductFilters);
customerProductRouter.get('/:id', getProductById);

adminProductRouter.get('/', productReaders, getProducts);
adminProductRouter.get('/list', productReaders, getProductList);
adminProductRouter.get('/filters', productReaders, getProductFilters);
adminProductRouter.get('/getAll', productReaders, getProducts);
adminProductRouter.get('/:id', productReaders, getProductById);
adminProductRouter.post('/', productWriters, productImageUpload, createProduct);
adminProductRouter.post('/create', productWriters, productImageUpload, createProduct);
adminProductRouter.put('/:id', productWriters, productImageUpload, updateProduct);
adminProductRouter.put('/update/:id', productWriters, productImageUpload, updateProduct);
adminProductRouter.delete('/:id/permanent', productWriters, permanentlyDeleteProduct);
adminProductRouter.delete('/:id', productWriters, deleteProduct);
adminProductRouter.delete('/delete/:id/permanent', productWriters, permanentlyDeleteProduct);
adminProductRouter.delete('/delete/:id', productWriters, deleteProduct);

export { adminProductRouter, customerProductRouter };
export default customerProductRouter;
