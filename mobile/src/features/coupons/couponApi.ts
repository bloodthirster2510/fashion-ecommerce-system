import { apiFetch } from '../../config/api';
import type { ApiResponse, ApiValidationError } from '../auth/types';
import type {
  AppliedMembership,
  CartPaymentMethod,
  CheckoutSummary,
  CustomerCoupon,
} from '../cart/cartApi';

const COUPON_READ_TIMEOUT_MS = 20000;

export type AvailableCouponsPayload = {
  cartItemIds?: string[];
  paymentMethod?: CartPaymentMethod;
};

export type AvailableCouponItem = {
  coupon: CustomerCoupon;
  isApplicable: boolean | null;
  reason?: string | null;
  summary?: CheckoutSummary | null;
  appliedMembership?: AppliedMembership | null;
  estimatedDiscountAmount: number;
  estimatedShippingDiscountAmount: number;
};

export type AvailableCouponsResponse = {
  items: AvailableCouponItem[];
};

export type ValidateCouponPayload = {
  couponCode: string;
  cartItemIds: string[];
  paymentMethod: CartPaymentMethod;
};

export class CouponApiError extends Error {
  errors?: ApiValidationError[];
  status?: number;

  constructor(message: string, errors?: ApiValidationError[], status?: number) {
    super(message);
    this.name = 'CouponApiError';
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
  } = {},
) => {
  const response = await apiFetch(path, {
    method: options.method ?? 'GET',
    timeoutMs: options.timeoutMs ?? COUPON_READ_TIMEOUT_MS,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = parseApiResponse<T>(await response.text());

  if (!response.ok) {
    const validationMessage = payload.errors?.map((error) => error.message).join('\n');
    throw new CouponApiError(
      validationMessage || payload.message || 'Không thể tải voucher',
      payload.errors,
      response.status,
    );
  }

  return payload.data as T;
};

export const couponApi = {
  getAvailableCoupons: (token: string, payload: AvailableCouponsPayload = {}) =>
    request<AvailableCouponsResponse>('/coupons/available', token, {
      method: 'POST',
      body: payload,
    }),
  validateCoupon: (token: string, payload: ValidateCouponPayload) =>
    request<unknown>('/coupons/validate', token, {
      method: 'POST',
      body: payload,
    }),
};
