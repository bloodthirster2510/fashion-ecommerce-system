import { Router } from 'express';
import { authenticate } from '../../../middlewares/auth.middleware';
import { authorize } from '../../../middlewares/role.middleware';
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

customerCouponRouter.use(authenticate);
customerCouponRouter.use(authorize('user'));
customerCouponRouter.post('/available', listAvailableCoupons);
customerCouponRouter.post('/validate', validateCoupon);

adminCouponRouter.use(authenticate);
adminCouponRouter.use(authorize('admin', 'staff'));
adminCouponRouter.get('/', listCoupons);
adminCouponRouter.get('/:id', getCouponById);

adminCouponRouter.post('/', authorize('admin'), createCoupon);
adminCouponRouter.put('/:id', authorize('admin'), updateCoupon);
adminCouponRouter.patch('/:id/status', authorize('admin'), updateCouponStatus);
adminCouponRouter.delete('/:id', authorize('admin'), deleteCoupon);

export { adminCouponRouter, customerCouponRouter };
