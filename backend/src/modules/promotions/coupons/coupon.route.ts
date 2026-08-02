import { Router } from 'express';
import { authenticate, requireActiveAccount } from '../../../middlewares/auth.middleware';
import { authorize, requirePermission } from '../../../middlewares/role.middleware';
import { createCouponValidateRateLimitMiddleware } from '../../../middlewares/security.middleware';
import {
  createCoupon,
  previewCoupon,
  duplicateCoupon,
  checkCouponCodeAvailability,
  deleteCoupon,
  getCouponById,
  listAvailableCoupons,
  listCoupons,
  listCouponUsage,
  updateCoupon,
  updateCouponStatus,
  validateCoupon,
} from './coupon.controller';

const customerCouponRouter = Router();
const adminCouponRouter = Router();
const couponValidateRateLimit = createCouponValidateRateLimitMiddleware();

customerCouponRouter.use(authenticate);
customerCouponRouter.use(requireActiveAccount);
customerCouponRouter.use(authorize('user'));
customerCouponRouter.post('/available', couponValidateRateLimit, listAvailableCoupons);
customerCouponRouter.post('/validate', couponValidateRateLimit, validateCoupon);

adminCouponRouter.use(authenticate);
adminCouponRouter.use(requireActiveAccount);
adminCouponRouter.use(authorize('admin', 'staff'));
adminCouponRouter.get('/', requirePermission('promotions.read'), listCoupons);
adminCouponRouter.get('/check-code', requirePermission('promotions.read'), checkCouponCodeAvailability);
adminCouponRouter.get('/:id/usage', requirePermission('promotions.read'), listCouponUsage);
adminCouponRouter.get('/:id', requirePermission('promotions.read'), getCouponById);

adminCouponRouter.post('/', requirePermission('promotions.write'), createCoupon);
adminCouponRouter.post('/preview', requirePermission('promotions.write'), previewCoupon);
adminCouponRouter.post('/:id/duplicate', requirePermission('promotions.write'), duplicateCoupon);
adminCouponRouter.put('/:id', requirePermission('promotions.write'), updateCoupon);
adminCouponRouter.patch('/:id/status', requirePermission('promotions.write'), updateCouponStatus);
adminCouponRouter.delete('/:id', requirePermission('promotions.write'), deleteCoupon);

export { adminCouponRouter, customerCouponRouter };
