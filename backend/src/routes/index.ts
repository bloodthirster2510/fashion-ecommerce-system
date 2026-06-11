import { Router } from 'express';
import adminRouter from './admin.routes';
import authRouter from '../modules/auth/auth.routes';
import brandRouter from '../modules/catalog/brands/brand.route';
import cartRouter from '../modules/cart/cart.route';
import categoryRouter from '../modules/catalog/categories/categories.route';
import favoriteRouter from '../modules/favorites/favorite.route';
import locationRouter from '../modules/locations/location.routes';
import productRouter from '../modules/catalog/products/product.route';
import orderRouter from '../modules/orders/order.route';
import paymentRoutes from '../modules/payments/payments.route';
import ghnRoutes from '../modules/shipping/ghn.route';
import shippingRoutes from '../modules/shipping/shipping.route';
import { customerCouponRouter } from '../modules/promotions/coupons/coupon.route';
import userRouter from '../modules/users/user.routes';

const router = Router();

router.use('/admin', adminRouter);
router.use('/auth', authRouter);
router.use('/brands', brandRouter);
router.use('/cart', cartRouter);
router.use('/categories', categoryRouter);
router.use('/favorites', favoriteRouter);
router.use('/locations', locationRouter);
router.use('/products', productRouter);
router.use('/orders', orderRouter);
router.use('/payments', paymentRoutes);
router.use('/ghn', ghnRoutes);
router.use('/shipping', shippingRoutes);
router.use('/coupons', customerCouponRouter);
router.use('/users', userRouter);

export default router;
