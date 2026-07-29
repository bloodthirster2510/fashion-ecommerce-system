import {
  canSubmitCheckout,
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
      { paymentMethod: 'MOMO' },
    ]) {
      expect(canSubmitCheckout({ ...validSubmitState, ...override })).toBe(false);
    }
  });

  it('resolves shipping copy in UI priority order', () => {
    const base = {
      isPreviewLoading: false,
      selectedItemCount: 1,
      hasSelectedAddress: true,
      needsAddressMapping: false,
    };

    expect(getShippingStatusText({ ...base, isPreviewLoading: true })).toContain('Đang tính');
    expect(getShippingStatusText({ ...base, selectedItemCount: 0 })).toContain('Chọn sản phẩm');
    expect(getShippingStatusText({ ...base, hasSelectedAddress: false })).toContain('Chọn địa chỉ');
    expect(getShippingStatusText({ ...base, comparisonNote: 'Phí riêng từ đối tác' })).toBe(
      'Phí riêng từ đối tác',
    );
    expect(getShippingStatusText({ ...base, needsAddressMapping: true })).toContain('phí tạm tính');
    expect(getShippingStatusText({ ...base, comparisonStatus: 'partial' })).toContain('tối ưu');
    expect(getShippingStatusText({ ...base, quoteStatus: 'quoted' })).toContain('Đã tính phí');
    expect(getShippingStatusText(base)).toContain('đối soát lại');
  });
});
