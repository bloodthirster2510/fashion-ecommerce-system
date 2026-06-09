import { Router } from 'express';
import { adminBrandRouter } from '../modules/catalog/brands/brand.route';
import { adminCategoryRouter } from '../modules/catalog/categories/categories.route';
import { adminProductRouter } from '../modules/catalog/products/product.route';
import inventoryRouter from '../modules/inventory/inventory.route';
import { adminOrderRouter } from '../modules/orders/order.route';
import { adminCouponRouter } from '../modules/promotions/coupons/coupon.route';
import { adminUserRouter } from '../modules/users/user.routes';

const adminRouter = Router();

adminRouter.use('/brands', adminBrandRouter);
adminRouter.use('/categories', adminCategoryRouter);
adminRouter.use('/products', adminProductRouter);
adminRouter.use('/inventory', inventoryRouter);
adminRouter.use('/orders', adminOrderRouter);
adminRouter.use('/coupons', adminCouponRouter);
adminRouter.use('/users', adminUserRouter);

export default adminRouter;
