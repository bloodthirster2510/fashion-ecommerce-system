import {
  canSubmitCheckout,
  getCheckoutErrorPresentation,
  getCheckoutValidationIssue,
  getShippingStatusText,
} from '../checkoutPresentation';

describe('checkout presentation helpers', () => {
  const validSubmitState = {
    selectedItemCount: 1,
    unavailableItemCount: 0,
    hasSelectedAddress: true,
    hasQuoteVersion: true,
    previewIsCurrent: true,
    isPreviewLoading: false,
    isSubmitting: false,
    paymentMethod: 'COD',
  };

  it('prioritizes a missing address before stock validation', () => {
    expect(
      getCheckoutValidationIssue(false, [
        { sku: 'SKU-1', quantity: 3, availableQuantity: 1 },
      ]),
    ).toMatchObject({ kind: 'missing_address', title: 'Thiếu địa chỉ nhận hàng' });
  });

  it('describes the first item exceeding stock and accepts valid stock', () => {
    expect(
      getCheckoutValidationIssue(true, [
        { sku: 'SKU-1', name: 'Áo linen', quantity: 3, availableQuantity: 1 },
      ]),
    ).toEqual({
      kind: 'insufficient_stock',
      title: 'Không đủ tồn kho',
      message: 'Áo linen chỉ còn 1.',
    });
    expect(
      getCheckoutValidationIssue(true, [
        { sku: 'SKU-1', quantity: 1, availableQuantity: 1 },
      ]),
    ).toBeNull();
  });

  it('allows only a current, idle COD or VNPay quote with usable items', () => {
    expect(canSubmitCheckout(validSubmitState)).toBe(true);
    expect(canSubmitCheckout({ ...validSubmitState, paymentMethod: 'VNPAY' })).toBe(true);

    for (const override of [
      { selectedItemCount: 0 },
      { unavailableItemCount: 1 },
      { hasSelectedAddress: false },
      { hasQuoteVersion: false },
      { previewIsCurrent: false },
      { isPreviewLoading: true },
      { isSubmitting: true },
      { paymentMethod: 'BANK' },
    ]) {
      expect(canSubmitCheckout({ ...validSubmitState, ...override })).toBe(false);
    }
  });

  it('resolves shipping copy in UI priority order', () => {
    const base = {
      isPreviewLoading: false,
      selectedItemCount: 1,
      hasSelectedAddress: true,
    };

    expect(getShippingStatusText({ ...base, isPreviewLoading: true })).toContain('Đang tính');
    expect(getShippingStatusText({ ...base, selectedItemCount: 0 })).toContain('Chọn sản phẩm');
    expect(getShippingStatusText({ ...base, hasSelectedAddress: false })).toContain('Chọn địa chỉ');
    expect(getShippingStatusText({ ...base, quoteStatus: 'quoted' })).toContain('Đã tính phí');
    expect(getShippingStatusText({ ...base, quoteStatus: 'fallback' })).toContain('Đã tính phí');
    expect(getShippingStatusText(base)).toContain('cập nhật tự động');
  });

  it('presents and identifies a voucher exhausted by a concurrent checkout', () => {
    expect(getCheckoutErrorPresentation({
      status: 409,
      errorCode: 'COUPON_USAGE_LIMIT_REACHED',
      data: { couponCode: 'save10' },
      message: 'Coupon usage limit reached',
    })).toEqual({
      kind: 'coupon_exhausted',
      title: 'Voucher đã hết lượt',
      message: 'Voucher SAVE10 vừa được khách hàng khác sử dụng hết. Mình đã gỡ voucher và cập nhật lại đơn hàng.',
      couponCode: 'SAVE10',
    });
  });

  it('keeps quote conflicts separate from voucher conflicts', () => {
    expect(getCheckoutErrorPresentation({
      status: 409,
      errorCode: 'QUOTE_CHANGED',
    })).toMatchObject({
      kind: 'quote_changed',
      title: 'Phí giao hàng đã thay đổi',
    });
  });
});
