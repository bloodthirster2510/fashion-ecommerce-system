const couponMessageTranslations: Record<string, string> = {
  'cartitemids is required': 'Vui lòng chọn sản phẩm trong giỏ hàng trước khi dùng voucher.',
  'invalid cart item id': 'Sản phẩm trong giỏ hàng không hợp lệ.',
  'cart not found': 'Không tìm thấy giỏ hàng của bạn.',
  'one or more cart items were not found': 'Một hoặc nhiều sản phẩm trong giỏ hàng không còn tồn tại.',
  'user not found': 'Không tìm thấy tài khoản của bạn.',
  'coupon is not available': 'Voucher hiện không khả dụng.',
  'coupon usage limit reached': 'Voucher đã hết lượt sử dụng.',
  'coupon is not available for this user': 'Voucher không áp dụng cho tài khoản này.',
  'coupon is not available for this membership rank': 'Voucher không áp dụng cho hạng thành viên hiện tại.',
  'coupon per-user limit reached': 'Bạn đã dùng hết số lượt của voucher này.',
  'coupon not found': 'Không tìm thấy voucher.',
  'coupon does not apply to selected items': 'Voucher không áp dụng cho các sản phẩm đã chọn.',
  'order does not meet coupon minimum amount': 'Đơn hàng chưa đạt giá trị tối thiểu của voucher.',
  'coupon not applied': 'Chưa thể áp dụng voucher.',
  'couponcode is required': 'Vui lòng chọn voucher.',
};

const hasVietnameseCharacters = (value: string) => /[À-ỹĐđ]/.test(value);

const formatCurrency = (value: number) =>
  `${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}đ`;

export const getCouponDisplayMessage = (
  message: string | null | undefined,
  fallback: string,
) => {
  const normalizedMessage = message?.trim();
  if (!normalizedMessage) return fallback;

  const minimumAmountMatch = normalizedMessage.match(/^Order must reach\s+([\d,.]+)$/i);
  if (minimumAmountMatch) {
    const minimumAmount = Number(minimumAmountMatch[1].replace(/,/g, ''));
    return Number.isFinite(minimumAmount)
      ? `Đơn hàng cần đạt tối thiểu ${formatCurrency(minimumAmount)}.`
      : 'Đơn hàng chưa đạt giá trị tối thiểu của voucher.';
  }

  const translatedMessage = couponMessageTranslations[normalizedMessage.toLowerCase()];
  if (translatedMessage) return translatedMessage;

  return hasVietnameseCharacters(normalizedMessage) ? normalizedMessage : fallback;
};

export const getCouponErrorMessage = (error: unknown) => getCouponDisplayMessage(
  error instanceof Error ? error.message : undefined,
  'Không thể tải danh sách voucher lúc này. Bạn thử lại sau nhé.',
);
