import { Router } from 'express';
import { adminBrandRouter } from '../modules/catalog/brands/brand.route';
import { adminCategoryRouter } from '../modules/catalog/categories/categories.route';
import { adminProductRouter } from '../modules/catalog/products/product.route';
import inventoryRouter from '../modules/inventory/inventory.route';
import { adminOrderRouter } from '../modules/orders/order.route';
import { adminCouponRouter } from '../modules/promotions/coupons/coupon.route';
import { adminPromotionCampaignRouter } from '../modules/promotions/campaigns/promotion-campaign.route';
import { adminPromotionAnalyticsRouter } from '../modules/promotions/analytics/promotion-analytics.route';
import { adminUserRouter } from '../modules/users/user.routes';
import accountRouter from '../modules/admin/accounts/account.routes';
import membershipRankingAdminRouter from '../modules/admin/loyalty/membership-ranking.routes';
import { adminAuditLogRouter } from '../modules/audit-logs/audit-log.route';
import { adminPaymentRouter } from '../modules/payments/payments.route';
import { adminPaymentMethodRouter } from '../modules/payment-methods/payment-method.route';

const adminRouter = Router();

adminRouter.use('/brands', adminBrandRouter);
adminRouter.use('/categories', adminCategoryRouter);
adminRouter.use('/products', adminProductRouter);
adminRouter.use('/inventory', inventoryRouter);
adminRouter.use('/orders', adminOrderRouter);
adminRouter.use('/coupons', adminCouponRouter);
adminRouter.use('/promotion-campaigns', adminPromotionCampaignRouter);
adminRouter.use('/promotion-analytics', adminPromotionAnalyticsRouter);
adminRouter.use('/users', adminUserRouter);
adminRouter.use('/accounts', accountRouter);
adminRouter.use('/audit-logs', adminAuditLogRouter);
adminRouter.use('/membership-rankings', membershipRankingAdminRouter);
adminRouter.use('/payments', adminPaymentRouter);
adminRouter.use('/', adminPaymentMethodRouter);

export default adminRouter;
