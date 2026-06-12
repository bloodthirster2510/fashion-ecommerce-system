import { apiFetch } from '../../config/api';
import type { ApiResponse } from '../auth/types';

const PAYMENT_WRITE_TIMEOUT_MS = 30000;

export type VNPayOrderPaymentUrlResponse = {
  paymentUrl: string;
  transactionId: string;
  txnRef?: string;
  attemptNo?: number;
  expiredAt?: string | null;
  orderCode: string;
  amount: number;
};

export type OrderPaymentStatusResponse = {
  orderId: string;
  orderCode: string;
  paymentMethod: string;
  paymentStatus: string;
  canPayNow: boolean;
  latestTransaction: {
    id: string;
    txnRef: string | null;
    attemptNo: number | null;
    status: string;
    expiredAt: string | null;
    resolvedAt: string | null;
    failureReason: string | null;
  } | null;
};

export class PaymentApiError extends Error {
  status?: number;
  errorCode?: string;

  constructor(message: string, status?: number, errorCode?: string) {
    super(message);
    this.name = 'PaymentApiError';
    this.status = status;
    this.errorCode = errorCode;
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
    method?: 'GET' | 'POST';
    body?: Record<string, unknown>;
  } = {},
): Promise<T> => {
  const method = options.method ?? 'POST';
  const response = await apiFetch(path, {
    method,
    timeoutMs: PAYMENT_WRITE_TIMEOUT_MS,
    retryOnTimeout: false,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : '';
    const isTimeout = /AbortError|aborted/i.test(message);

    throw new PaymentApiError(
      isTimeout
        ? 'Ket noi tao link thanh toan bi timeout. Kiem tra backend dang chay roi thu lai.'
        : 'Khong ket noi duoc toi may chu. Kiem tra lai mang noi bo.',
    );
  });

  const payload = parseApiResponse<T>(await response.text());

  if (!response.ok) {
    throw new PaymentApiError(
      payload.message || 'Khong the tao link thanh toan',
      response.status,
      payload.errorCode,
    );
  }

  return payload.data as T;
};

export const paymentApi = {
  createVNPayUrlFromOrder: (
    token: string,
    orderId: string,
    options?: { bankCode?: string; locale?: 'vn' | 'en' },
  ) =>
    request<VNPayOrderPaymentUrlResponse>(
      `/payments/vnpay/orders/${encodeURIComponent(orderId)}/create-payment-url`,
      token,
      {
        method: 'POST',
        body: {
          ...(options?.bankCode ? { bankCode: options.bankCode } : {}),
          locale: options?.locale ?? 'vn',
        },
      },
    ),
  getOrderPaymentStatus: (token: string, orderId: string) =>
    request<OrderPaymentStatusResponse>(
      `/payments/orders/${encodeURIComponent(orderId)}/status`,
      token,
      { method: 'GET' },
    ),
};
