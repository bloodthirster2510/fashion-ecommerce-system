type CheckoutItemSummary = {
  name?: string;
  sku: string;
  quantity: number;
  availableQuantity?: number;
};

type CheckoutRequestError = {
  message?: string;
  status?: number;
  errorCode?: string;
  data?: unknown;
};

type CheckoutCouponRouteParams = {
  couponCode?: string | null;
  couponCodes?: string[];
};

export const getCouponCodesFromRouteParams = (
  params?: CheckoutCouponRouteParams,
): string[] | null => {
  if (params?.couponCodes === undefined && params?.couponCode == null) {
    return null;
  }

  const rawCodes = params.couponCodes ?? [params.couponCode ?? ''];
  return Array.from(
    new Set(rawCodes.map((code) => code.trim().toUpperCase()).filter(Boolean)),
  ).slice(0, 2);
};

export type CheckoutErrorPresentation = {
  kind: 'quote_changed' | 'coupon_exhausted' | 'coupon_user_limit' | 'generic';
  title: string;
  message: string;
  couponCode?: string;
};

const getCouponCodeFromError = (error: CheckoutRequestError) => {
  if (!error.data || typeof error.data !== 'object' || !('couponCode' in error.data)) return undefined;
  const couponCode = (error.data as { couponCode?: unknown }).couponCode;
  return typeof couponCode === 'string' && couponCode.trim()
    ? couponCode.trim().toUpperCase()
    : undefined;
};

export const getCheckoutErrorPresentation = (error: unknown): CheckoutErrorPresentation => {
  const requestError = error && typeof error === 'object' ? error as CheckoutRequestError : {};

  if (requestError.status === 409 && requestError.errorCode === 'QUOTE_CHANGED') {
    return {
      kind: 'quote_changed',
      title: 'Phí giao hàng đã thay đổi',
      message: 'Phí giao hàng vừa thay đổi. Mình cần cập nhật lại tổng tiền trước khi đặt hàng.',
    };
  }

  if (requestError.status === 409 && requestError.errorCode === 'COUPON_USAGE_LIMIT_REACHED') {
    const couponCode = getCouponCodeFromError(requestError);
    return {
      kind: 'coupon_exhausted',
      title: 'Voucher đã hết lượt',
      message: couponCode
        ? `Voucher ${couponCode} vừa được khách hàng khác sử dụng hết. Mình đã gỡ voucher và cập nhật lại đơn hàng.`
        : 'Voucher vừa được khách hàng khác sử dụng hết. Mình đã gỡ voucher và cập nhật lại đơn hàng.',
      couponCode,
    };
  }

  if (requestError.status === 409 && requestError.errorCode === 'COUPON_PER_USER_LIMIT_REACHED') {
    const couponCode = getCouponCodeFromError(requestError);
    return {
      kind: 'coupon_user_limit',
      title: 'Đã hết lượt dùng voucher',
      message: couponCode
        ? `Bạn đã dùng hết số lượt cho voucher ${couponCode}. Mình đã gỡ voucher và cập nhật lại đơn hàng.`
        : 'Bạn đã dùng hết số lượt cho voucher này. Mình đã gỡ voucher và cập nhật lại đơn hàng.',
      couponCode,
    };
  }

  const message = error instanceof Error ? error.message : undefined;
  return {
    kind: 'generic',
    title: 'Không đặt được hàng',
    message: message || 'Bạn thử lại sau nha.',
  };
};

export type CheckoutValidationIssue =
  | {
      kind: 'missing_address';
      title: string;
      message: string;
    }
  | {
      kind: 'insufficient_stock';
      title: string;
      message: string;
    };

export const getCheckoutItemTitle = (item: Pick<CheckoutItemSummary, 'name' | 'sku'>) =>
  item.name || `Sản phẩm ${item.sku}`;

export const getCheckoutValidationIssue = (
  hasSelectedAddress: boolean,
  selectedItems: CheckoutItemSummary[],
): CheckoutValidationIssue | null => {
  if (!hasSelectedAddress) {
    return {
      kind: 'missing_address',
      title: 'Thiếu địa chỉ nhận hàng',
      message: 'Bạn chọn hoặc thêm địa chỉ trong hồ sơ trước khi đặt hàng.',
    };
  }

  const overStockItem = selectedItems.find(
    (item) =>
      item.availableQuantity !== undefined &&
      item.quantity > item.availableQuantity,
  );
  if (!overStockItem) return null;

  return {
    kind: 'insufficient_stock',
    title: 'Không đủ tồn kho',
    message: `${getCheckoutItemTitle(overStockItem)} chỉ còn ${overStockItem.availableQuantity}.`,
  };
};

export const canSubmitCheckout = (input: {
  selectedItemCount: number;
  unavailableItemCount: number;
  hasSelectedAddress: boolean;
  hasQuoteVersion: boolean;
  previewIsCurrent: boolean;
  isPreviewLoading: boolean;
  isSubmitting: boolean;
  paymentMethod: string;
}) =>
  input.selectedItemCount > 0 &&
  input.unavailableItemCount === 0 &&
  input.hasSelectedAddress &&
  input.hasQuoteVersion &&
  input.previewIsCurrent &&
  !input.isPreviewLoading &&
  !input.isSubmitting &&
  (input.paymentMethod === 'COD' || input.paymentMethod === 'VNPAY');

export const getShippingStatusText = (input: {
  isPreviewLoading: boolean;
  selectedItemCount: number;
  hasSelectedAddress: boolean;
  quoteStatus?: string | null;
}) => {
  if (input.isPreviewLoading) return 'Đang tính phí giao hàng...';
  if (!input.selectedItemCount) return 'Chọn sản phẩm để tính phí giao hàng.';
  if (!input.hasSelectedAddress) return 'Chọn địa chỉ nhận hàng để tính phí giao hàng.';
  if (input.quoteStatus === 'quoted' || input.quoteStatus === 'fallback') {
    return 'Đã tính phí giao hàng theo địa chỉ nhận hàng.';
  }
  return 'Phí giao hàng sẽ được cập nhật tự động.';
};
