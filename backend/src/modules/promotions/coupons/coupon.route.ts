import { Router } from 'express';
import { authenticate } from '../../../middlewares/auth.middleware';
import { authorize, requirePermission } from '../../../middlewares/role.middleware';
import { createCouponValidateRateLimitMiddleware } from '../../../middlewares/security.middleware';
import {
  createCoupon,
  deleteCoupon,
  getCouponById,
  listAvailableCoupons,
  listCoupons,
  updateCoupon,
  updateCouponStatus,
  validateCoupon,
} from './coupon.controller';

const customerCouponRouter = Router();
const adminCouponRouter = Router();
const couponValidateRateLimit = createCouponValidateRateLimitMiddleware();

customerCouponRouter.use(authenticate);
customerCouponRouter.use(authorize('user'));
customerCouponRouter.post('/available', listAvailableCoupons);
customerCouponRouter.post('/validate', couponValidateRateLimit, validateCoupon);

adminCouponRouter.use(authenticate);
adminCouponRouter.use(authorize('admin', 'staff'));
adminCouponRouter.get('/', requirePermission('promotions.read'), listCoupons);
adminCouponRouter.get('/:id', requirePermission('promotions.read'), getCouponById);

adminCouponRouter.post('/', requirePermission('promotions.write'), createCoupon);
adminCouponRouter.put('/:id', requirePermission('promotions.write'), updateCoupon);
adminCouponRouter.patch('/:id/status', requirePermission('promotions.write'), updateCouponStatus);
adminCouponRouter.delete('/:id', requirePermission('promotions.write'), deleteCoupon);

export { adminCouponRouter, customerCouponRouter };
