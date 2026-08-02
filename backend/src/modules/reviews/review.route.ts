import { Router, type RequestHandler } from 'express';
import { authenticate, optionalAuthenticate, requireActiveAccount } from '../../middlewares/auth.middleware';
import { authorize, requirePermission } from '../../middlewares/role.middleware';
import {
  createReviewCreateRateLimitMiddleware,
  createReviewHelpfulRateLimitMiddleware,
  createReviewMutationRateLimitMiddleware,
} from '../../middlewares/security.middleware';
import { uploadMultiple, withMulterErrorHandling } from '../../middlewares/upload.middleware';
import {
  createReview,
  deleteReviewReply,
  deletePendingReviewAsAdmin,
  deleteReview,
  getReviewEligibility,
  listEligibleReviewItems,
  listMyReviews,
  listProductReviews,
  toggleHelpfulVote,
  updateReview,
  getModerationRules,
  getAdminReviewDetail,
  listAdminReviews,
  replyToReview,
  updateModerationStatus,
  updateManyModerationStatuses,
} from './review.controller';

const router = Router();
const adminReviewRouter = Router();
const reviewCreateLimiter = createReviewCreateRateLimitMiddleware();
const reviewMutationLimiter = createReviewMutationRateLimitMiddleware();
const reviewHelpfulLimiter = createReviewHelpfulRateLimitMiddleware();
const reviewImageUpload = withMulterErrorHandling(uploadMultiple.array('images', 5));
const reviewImageTotalLimit = 20 * 1024 * 1024;
const enforceReviewImageTotalLimit: RequestHandler = (req, res, next) => {
  const totalSize = ((req.files as Express.Multer.File[] | undefined) ?? [])
    .reduce((total, file) => total + file.size, 0);
  if (totalSize > reviewImageTotalLimit) {
    res.status(400).json({ message: 'Total review image size exceeds 20MB limit' });
    return;
  }
  next();
};

// Danh sách review là dữ liệu công khai để hiển thị ở trang chi tiết sản phẩm.
router.get('/products/:productId', optionalAuthenticate, listProductReviews);

// Các thao tác còn lại gắn với danh tính người mua nên bắt buộc đăng nhập bằng tài khoản user.
router.get('/eligibility', authenticate, requireActiveAccount, authorize('user'), getReviewEligibility);
router.get('/eligible-items', authenticate, requireActiveAccount, authorize('user'), listEligibleReviewItems);
router.get('/me', authenticate, requireActiveAccount, authorize('user'), listMyReviews);
router.post('/', authenticate, requireActiveAccount, authorize('user'), reviewCreateLimiter, reviewImageUpload, enforceReviewImageTotalLimit, createReview);
router.post('/:id/helpful', authenticate, requireActiveAccount, authorize('user'), reviewHelpfulLimiter, toggleHelpfulVote);
router.patch('/:id', authenticate, requireActiveAccount, authorize('user'), reviewMutationLimiter, reviewImageUpload, enforceReviewImageTotalLimit, updateReview);
router.delete('/:id', authenticate, requireActiveAccount, authorize('user'), reviewMutationLimiter, deleteReview);

adminReviewRouter.use(authenticate);
adminReviewRouter.use(requireActiveAccount);
adminReviewRouter.use(authorize('admin', 'staff'));
adminReviewRouter.get('/', requirePermission('reviews.read'), listAdminReviews);
adminReviewRouter.get('/moderation-rules', requirePermission('reviews.moderate'), getModerationRules);
adminReviewRouter.get('/:id', requirePermission('reviews.read'), getAdminReviewDetail);
adminReviewRouter.patch('/bulk-status', requirePermission('reviews.moderate'), updateManyModerationStatuses);
adminReviewRouter.patch('/:id/status', requirePermission('reviews.moderate'), updateModerationStatus);
adminReviewRouter.put('/:id/reply', requirePermission('reviews.reply'), replyToReview);
adminReviewRouter.delete('/:id/reply', requirePermission('reviews.reply'), deleteReviewReply);
adminReviewRouter.delete('/:id', requirePermission('reviews.moderate'), deletePendingReviewAsAdmin);

export { adminReviewRouter };
export default router;
