import { apiFetch } from '../../config/api';
import type { ApiResponse, ApiValidationError } from '../auth/types';

const CART_READ_TIMEOUT_MS = 20000;
const CART_WRITE_TIMEOUT_MS = 30000;

export type AddCartItemPayload = {
  productId: string;
  variantId: string;
  colorVariantId: string;
  size: string;
  quantity: number;
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
  shippingAddress: {
    customerName: string;
    province: string;
    district: string;
    ward: string;
    streetName: string;
    phoneNumber: string;
  };
  paymentMethod: CartPaymentMethod;
  couponCode?: string;
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
  couponCode?: string;
  paymentMethod?: CartPaymentMethod;
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
  summary: CheckoutSummary;
  coupon?: AppliedCheckoutCoupon | null;
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
  paymentStatus: string;
};

export class CartApiError extends Error {
  errors?: ApiValidationError[];
  status?: number;

  constructor(message: string, errors?: ApiValidationError[], status?: number) {
    super(message);
    this.name = 'CartApiError';
    this.errors = errors;
    this.status = status;
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
  } = {},
) => {
  const method = options.method ?? 'GET';
  const response = await apiFetch(path, {
    method,
    timeoutMs: options.timeoutMs ?? (method === 'GET' ? CART_READ_TIMEOUT_MS : CART_WRITE_TIMEOUT_MS),
    retryOnTimeout: options.retryOnTimeout ?? method === 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
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
      validationMessage || payload.message || 'Khong the cap nhat gio hang',
      payload.errors,
      response.status,
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
  createOrder: (token: string, payload: CreateOrderPayload) =>
    request<OrderResponse>('/orders', token, { method: 'POST', body: payload }),
};
