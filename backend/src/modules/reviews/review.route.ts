import { Router } from 'express';
import { authenticate, requireActiveAccount } from '../../middlewares/auth.middleware';
import { authorize, requirePermission } from '../../middlewares/role.middleware';
import {
  createReview,
  deleteReview,
  getReviewEligibility,
  listMyReviews,
  listProductReviews,
  updateReview,
  getModerationRules,
  listAdminReviews,
  replyToReview,
  updateModerationStatus,
  updateManyModerationStatuses,
} from './review.controller';

const router = Router();
const adminReviewRouter = Router();

// Danh sách review là dữ liệu công khai để hiển thị ở trang chi tiết sản phẩm.
router.get('/products/:productId', listProductReviews);

// Các thao tác còn lại gắn với danh tính người mua nên bắt buộc đăng nhập bằng tài khoản user.
router.get('/eligibility/:productId', authenticate, requireActiveAccount, authorize('user'), getReviewEligibility);
router.get('/me', authenticate, requireActiveAccount, authorize('user'), listMyReviews);
router.post('/', authenticate, requireActiveAccount, authorize('user'), createReview);
router.patch('/:id', authenticate, requireActiveAccount, authorize('user'), updateReview);
router.delete('/:id', authenticate, requireActiveAccount, authorize('user'), deleteReview);

adminReviewRouter.use(authenticate);
adminReviewRouter.use(requireActiveAccount);
adminReviewRouter.use(authorize('admin', 'staff'));
adminReviewRouter.get('/', requirePermission('reviews.moderate'), listAdminReviews);
adminReviewRouter.get('/moderation-rules', requirePermission('reviews.moderate'), getModerationRules);
adminReviewRouter.patch('/bulk-status', requirePermission('reviews.moderate'), updateManyModerationStatuses);
adminReviewRouter.patch('/:id/status', requirePermission('reviews.moderate'), updateModerationStatus);
adminReviewRouter.post('/:id/reply', requirePermission('reviews.moderate'), replyToReview);

export { adminReviewRouter };
export default router;
