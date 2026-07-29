import {
  getAvailableReviewImageSlots,
  getReviewCommentError,
  getReviewEligibilityMessage,
} from '../reviewPresentation';

describe('review presentation helpers', () => {
  it('calculates remaining image capacity without returning a negative value', () => {
    expect(getAvailableReviewImageSlots(2, 1)).toBe(2);
    expect(getAvailableReviewImageSlots(5, 0)).toBe(0);
    expect(getAvailableReviewImageSlots(4, 3)).toBe(0);
  });

  it('validates the trimmed review comment', () => {
    expect(getReviewCommentError('   ngắn   ')).toContain('10 ký tự');
    expect(getReviewCommentError('  Sản phẩm rất tốt  ')).toBe('');
  });

  it('explains duplicate and generic eligibility failures', () => {
    expect(getReviewEligibilityMessage('ALREADY_REVIEWED')).toContain('đã đánh giá');
    expect(getReviewEligibilityMessage('ORDER_NOT_COMPLETED')).toContain('chưa đủ điều kiện');
    expect(getReviewEligibilityMessage()).toContain('chưa đủ điều kiện');
  });
});
