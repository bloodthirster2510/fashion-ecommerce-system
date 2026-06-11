import { apiFetch } from '../../config/api';
import type { ApiResponse } from '../auth/types';

const PAYMENT_WRITE_TIMEOUT_MS = 30000;

export type VNPayOrderPaymentUrlResponse = {
  paymentUrl: string;
  transactionId: string;
  orderCode: string;
  amount: number;
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
        ? 'Kết nối tạo link thanh toán bị timeout. Kiểm tra backend đang chạy rồi thử lại.'
        : 'Không kết nối được tới máy chủ. Kiểm tra lại mạng nội bộ.',
    );
  });

  const payload = parseApiResponse<T>(await response.text());

  if (!response.ok) {
    throw new PaymentApiError(
      payload.message || 'Không thể tạo link thanh toán',
      response.status,
      payload.errorCode,
    );
  }

  return payload.data as T;
};

export const paymentApi = {
  /**
   * Tạo VNPay payment URL từ orderId đã được tạo.
   * Backend tự lấy amount từ Order.totalAmount — an toàn, không cần gửi amount từ client.
   */
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
};
