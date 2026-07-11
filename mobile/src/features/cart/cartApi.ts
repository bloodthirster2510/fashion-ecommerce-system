import { apiFetch } from '../../config/api';
import type { ApiResponse, ApiValidationError } from '../auth/types';
import { getRecommendationSessionId } from '../recommendation/recommendationSession';

const CART_READ_TIMEOUT_MS = 20000;
const CART_WRITE_TIMEOUT_MS = 30000;

export type AddCartItemPayload = {
  productId: string;
  variantId: string;
  colorVariantId: string;
  size: string;
  quantity: number;
  isSelected?: boolean;
  replaceQuantity?: boolean;
  recommendationRequestId?: string;
};

export type UpdateCartItemPayload = {
  quantity?: number;
  size?: string;
};

export type CartItem = {
  _id: string;
  productId: string;
  variantId: string;
  colorVariantId: string;
  size: string;
  sku: string;
  quantity: number;
  priceAtAddedTime: number;
  isSelected: boolean;
  lineTotal: number;
  name?: string;
  brand?: {
    _id?: string;
    name: string;
    image?: string;
  };
  color?: string;
  colorCode?: string;
  image?: string;
  originalPrice?: number;
  discount?: number;
  availableQuantity?: number;
  isAvailable?: boolean;
};

export type CartResponse = {
  _id?: string;
  user_id?: string;
  product_list: CartItem[];
  summary: {
    itemCount: number;
    selectedItemCount: number;
    subTotal: number;
  };
};

export type CartPaymentMethod = 'COD' | 'VNPAY' | 'MOMO' | 'CARD' | 'BANK';

export type CreateOrderPayload = {
  cartItemIds: string[];
  addressId?: string;
  shippingAddress?: {
    customerName: string;
    province: string;
    provinceCode?: string | null;
    provinceId?: number | null;
    district?: string | null;
    districtId?: number | null;
    ward: string;
    wardCode: string;
    streetName: string;
    phoneNumber: string;
    ghnProvinceId?: number | null;
    ghnDistrictId?: number | null;
    ghnWardCode?: string | null;
    ghnMappingStatus?: 'mapped' | 'missing' | 'manual';
  };
  quoteVersion: string;
  paymentMethod: CartPaymentMethod;
  paymentMethodId?: string;
  couponCode?: string;
  couponCodes?: string[];
  orderNote?: string;
};

export type CheckoutSummary = {
  subTotal: number;
  shippingFee: number;
  couponDiscountAmount: number;
  shippingDiscountAmount: number;
  membershipDiscountAmount: number;
  taxAmount: number;
  totalAmount: number;
};

export type ValidateCouponPayload = {
  couponCode: string;
  cartItemIds: string[];
  paymentMethod?: CartPaymentMethod;
};

export type CustomerCoupon = {
  _id: string;
  code: string;
  name: string;
  description?: string | null;
  discountType: 'percent' | 'fixed' | 'free_shipping';
  discountValue: number;
  maxDiscountAmount?: number | null;
  minOrderAmount: number;
  endAt: string;
};

export type AppliedCheckoutCoupon = CustomerCoupon & {
  discountAmount: number;
  shippingDiscountAmount: number;
  eligibleSubTotal: number;
};

export type AppliedMembership = {
  tierId?: string;
  name: string;
  discountPercent: number;
  discountAmount: number;
};

export type ValidateCouponResponse = {
  coupon: CustomerCoupon;
  summary: CheckoutSummary;
  appliedMembership?: AppliedMembership | null;
};

export type CheckoutPreviewPayload = {
  cartItemIds: string[];
  addressId?: string;
  shippingAddress?: CreateOrderPayload['shippingAddress'];
  couponCode?: string;
  couponCodes?: string[];
  paymentMethod?: CartPaymentMethod;
};

export type ShippingQuote = {
  provider: 'GHN' | 'FIXED' | string;
  serviceId: number | null;
  serviceTypeId: number | null;
  fee: number;
  status: 'quoted' | 'fallback' | string;
  estimatedDeliveryDate?: string | null;
  rawQuote?: Record<string, unknown> | null;
};

export type ShippingComparisonOption = {
  key: string;
  provider: 'GHN' | 'FIXED' | string;
  serviceId: number | null;
  serviceTypeId: number | null;
  serviceName?: string | null;
  providerCost: number;
  customerFee: number;
  estimatedDeliveryDate?: string | null;
  availability: 'available' | 'fallback' | 'unavailable' | string;
  isRecommended: boolean;
  reason?: string | null;
};

export type ShippingComparison = {
  comparisonStatus: 'live' | 'partial' | 'fallback' | string;
  pricingMode: 'CHEAPEST' | 'RECOMMENDED' | 'FIXED_FALLBACK' | string;
  customerFee: number;
  recommendedOptionKey: string | null;
  selectedOptionKey: string | null;
  quoteVersion: string;
  note?: string | null;
  options: ShippingComparisonOption[];
};

export type CheckoutPreviewResponse = {
  items: Array<{
    productId: string;
    variantId: string;
    colorVariantId: string;
    size: string;
    sku: string;
    name: string;
    fitType: string;
    color: string;
    image: string;
    quantity: number;
    priceAtPurchased: number;
    categoryId: string;
  }>;
  quoteVersion: string;
  summary: CheckoutSummary;
  shippingQuote?: ShippingQuote;
  shippingComparison?: ShippingComparison;
  coupon?: AppliedCheckoutCoupon | null;
  coupons?: AppliedCheckoutCoupon[];
  campaign?: { campaignId: string; code: string; name: string } | null;
  appliedMembership?: AppliedMembership | null;
};

export type OrderResponse = {
  _id: string;
  orderCode: string;
  subTotal: number;
  shippingFee: number;
  couponDiscountAmount: number;
  shippingDiscountAmount: number;
  membershipDiscountAmount: number;
  taxAmount: number;
  totalAmount: number;
  status: string;
  paymentMethod: string;
  paymentMethodId?: string | null;
  paymentStatus: string;
};

export class CartApiError extends Error {
  errors?: ApiValidationError[];
  status?: number;
  errorCode?: string;
  data?: unknown;

  constructor(
    message: string,
    errors?: ApiValidationError[],
    status?: number,
    errorCode?: string,
    data?: unknown,
  ) {
    super(message);
    this.name = 'CartApiError';
    this.errors = errors;
    this.status = status;
    this.errorCode = errorCode;
    this.data = data;
  }
}

const parseApiResponse = <T>(text: string): ApiResponse<T> => {
  if (!text) return {};

  try {
    return JSON.parse(text) as ApiResponse<T>;
  } catch {
    return { message: text };
  }
};

const request = async <T>(
  path: string,
  token: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: Record<string, unknown>;
    timeoutMs?: number;
    retryOnTimeout?: boolean;
    idempotencyKey?: string;
  } = {},
) => {
  const method = options.method ?? 'GET';
  const recommendationSessionId = await getRecommendationSessionId();
  const response = await apiFetch(path, {
    method,
    timeoutMs: options.timeoutMs ?? (method === 'GET' ? CART_READ_TIMEOUT_MS : CART_WRITE_TIMEOUT_MS),
    retryOnTimeout: options.retryOnTimeout ?? method === 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Session-Id': recommendationSessionId,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : '';
    const isTimeout = /AbortError|aborted/i.test(message);

    throw new CartApiError(
      isTimeout
        ? 'Kết nối tới máy chủ quá lâu. Bạn kiểm tra backend đang chạy và cùng mạng với điện thoại, rồi thử lại nha.'
        : 'Không kết nối được tới máy chủ giỏ hàng. Bạn kiểm tra lại địa chỉ API hoặc mạng nội bộ.',
    );
  });
  const payload = parseApiResponse<T>(await response.text());

  if (!response.ok) {
    const validationMessage = payload.errors?.map((error) => error.message).join('\n');
    throw new CartApiError(
      validationMessage || payload.message || 'Không thể cập nhật giỏ hàng',
      payload.errors,
      response.status,
      payload.errorCode,
      payload.data,
    );
  }

  return payload.data as T;
};

export const cartApi = {
  getCart: (token: string) => request<CartResponse>('/cart', token),
  addItem: (token: string, payload: AddCartItemPayload) =>
    request<CartResponse>('/cart/items', token, { method: 'POST', body: payload }),
  updateItem: (token: string, itemId: string, payload: UpdateCartItemPayload) =>
    request<CartResponse>(`/cart/items/${encodeURIComponent(itemId)}`, token, { method: 'PUT', body: payload }),
  selectItem: (token: string, itemId: string, isSelected: boolean) =>
    request<CartResponse>(`/cart/items/${encodeURIComponent(itemId)}/selected`, token, {
      method: 'PATCH',
      body: { isSelected },
    }),
  selectAll: (token: string, isSelected: boolean) =>
    request<CartResponse>('/cart/select-all', token, { method: 'PATCH', body: { isSelected } }),
  deleteItem: (token: string, itemId: string) =>
    request<CartResponse>(`/cart/items/${encodeURIComponent(itemId)}`, token, { method: 'DELETE' }),
  validateCoupon: (token: string, payload: ValidateCouponPayload) =>
    request<ValidateCouponResponse>('/coupons/validate', token, {
      method: 'POST',
      body: payload,
    }),
  previewCheckout: (token: string, payload: CheckoutPreviewPayload) =>
    request<CheckoutPreviewResponse>('/orders/preview', token, {
      method: 'POST',
      body: payload,
    }),
  createOrder: (token: string, payload: CreateOrderPayload, idempotencyKey: string) =>
    request<OrderResponse>('/orders', token, { method: 'POST', body: payload, idempotencyKey }),
};
