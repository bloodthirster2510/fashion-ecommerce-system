import { Router } from 'express';
import brandRouter from '../modules/catalog/brands/brand.route';
import cartRouter from '../modules/cart/cart.route';
import categoryRouter from '../modules/catalog/categories/categories.route';
import productRouter from '../modules/catalog/products/product.route';
import inventoryRouter from '../modules/inventory/inventory.route';
import orderRouter from '../modules/orders/order.route';
import { adminCouponRouter, customerCouponRouter } from '../modules/promotions/coupons/coupon.route';

const router = Router();

router.use('/brands', brandRouter);
router.use('/cart', cartRouter);
router.use('/categories', categoryRouter);
router.use('/products', productRouter);
router.use('/inventory', inventoryRouter);
router.use('/orders', orderRouter);
router.use('/coupons', customerCouponRouter);
router.use('/admin/coupons', adminCouponRouter);

export default router;
