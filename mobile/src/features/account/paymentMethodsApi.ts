import { apiFetch } from '../../config/api';
import type { ApiResponse, ApiValidationError } from '../auth/types';

const PAYMENT_METHOD_READ_TIMEOUT_MS = 20000;
const PAYMENT_METHOD_WRITE_TIMEOUT_MS = 30000;

export type PaymentMethodType = 'VNPAY' | 'MOMO' | 'BANK' | 'CARD';
export type PaymentMethodStatus = 'pending' | 'verified' | 'expired' | 'disabled';

export type PaymentMethodRecord = {
  _id: string;
  user_id?: string;
  type: PaymentMethodType;
  provider: string;
  displayName: string;
  maskedInfo?: string | null;
  bankCode?: string | null;
  bankName?: string | null;
  status: PaymentMethodStatus;
  isDefault: boolean;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};

export type CreatePaymentMethodPayload = {
  type: PaymentMethodType;
  provider?: string;
  displayName?: string;
  maskedInfo?: string | null;
  bankCode?: string | null;
  bankName?: string | null;
  isDefault?: boolean;
  metadata?: Record<string, unknown>;
};

export class PaymentMethodsApiError extends Error {
  errors?: ApiValidationError[];
  status?: number;

  constructor(message: string, errors?: ApiValidationError[], status?: number) {
    super(message);
    this.name = 'PaymentMethodsApiError';
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
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: Record<string, unknown>;
  } = {},
) => {
  const method = options.method ?? 'GET';
  const response = await apiFetch(path, {
    method,
    timeoutMs: method === 'GET' ? PAYMENT_METHOD_READ_TIMEOUT_MS : PAYMENT_METHOD_WRITE_TIMEOUT_MS,
    retryOnTimeout: method === 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = parseApiResponse<T>(await response.text());

  if (!response.ok) {
    const validationMessage = payload.errors?.map((error) => error.message).join('\n');
    throw new PaymentMethodsApiError(
      validationMessage || payload.message || 'Khong the cap nhat phuong thuc thanh toan',
      payload.errors,
      response.status,
    );
  }

  return payload.data as T;
};

export const paymentMethodsApi = {
  list: (token: string) => request<PaymentMethodRecord[]>('/payment-methods', token),
  create: (token: string, payload: CreatePaymentMethodPayload) =>
    request<PaymentMethodRecord>('/payment-methods', token, { method: 'POST', body: payload }),
  setDefault: (token: string, id: string) =>
    request<PaymentMethodRecord>(`/payment-methods/${encodeURIComponent(id)}/default`, token, {
      method: 'PATCH',
    }),
  remove: (token: string, id: string) =>
    request<PaymentMethodRecord>(`/payment-methods/${encodeURIComponent(id)}`, token, {
      method: 'DELETE',
    }),
};
