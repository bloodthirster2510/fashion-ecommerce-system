import { getCouponDisplayMessage, getCouponErrorMessage } from '../couponPresentation';

describe('coupon presentation', () => {
  it('translates coupon availability reasons returned by the API', () => {
    expect(getCouponDisplayMessage('Coupon does not apply to selected items', 'fallback'))
      .toBe('Voucher không áp dụng cho các sản phẩm đã chọn.');
    expect(getCouponDisplayMessage('Order does not meet coupon minimum amount', 'fallback'))
      .toBe('Đơn hàng chưa đạt giá trị tối thiểu của voucher.');
  });

  it('formats the minimum order amount in Vietnamese', () => {
    expect(getCouponDisplayMessage('Order must reach 250000', 'fallback'))
      .toBe('Đơn hàng cần đạt tối thiểu 250.000đ.');
  });

  it('keeps Vietnamese server messages and hides unknown English details', () => {
    expect(getCouponDisplayMessage('Voucher đã hết hạn.', 'fallback')).toBe('Voucher đã hết hạn.');
    expect(getCouponDisplayMessage('Unexpected upstream failure', 'Thông báo mặc định'))
      .toBe('Thông báo mặc định');
    expect(getCouponErrorMessage(new Error('Network request failed')))
      .toBe('Không thể tải danh sách voucher lúc này. Bạn thử lại sau nhé.');
  });
});
