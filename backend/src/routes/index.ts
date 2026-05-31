import { Router } from 'express';
import brandRouter from '../modules/catalog/brands/brand.route';
import categoryRouter from '../modules/catalog/categories/categories.route';
import productRouter from '../modules/catalog/products/product.route';

const router = Router();

router.use('/brands', brandRouter);
router.use('/categories', categoryRouter);
router.use('/products', productRouter);

export default router;
