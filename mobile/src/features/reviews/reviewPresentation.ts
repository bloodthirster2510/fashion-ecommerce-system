const MAX_REVIEW_IMAGES = 5;

export const getAvailableReviewImageSlots = (
  existingImageCount: number,
  draftImageCount: number,
) => Math.max(0, MAX_REVIEW_IMAGES - existingImageCount - draftImageCount);

export const getReviewCommentError = (comment: string) =>
  comment.trim().length < 10 ? 'Đánh giá cần ít nhất 10 ký tự.' : '';

export const getReviewEligibilityMessage = (reason?: string | null) =>
  reason === 'ALREADY_REVIEWED'
    ? 'Bạn đã đánh giá sản phẩm trong lần mua này.'
    : 'Đơn hàng chưa đủ điều kiện đánh giá.';
