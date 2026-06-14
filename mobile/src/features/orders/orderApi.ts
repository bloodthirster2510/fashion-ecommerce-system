import { apiFetch } from '../../config/api';
import type { ApiResponse, ApiValidationError } from '../auth/types';

const ORDER_READ_TIMEOUT_MS = 20000;
const ORDER_WRITE_TIMEOUT_MS = 30000;

export type OrderStatus =
  | 'confirmed'
  | 'packed'
  | 'shipping'
  | 'delivered'
  | 'cancelled'
  | 'return_requested'
  | 'returned';

export type OrderFilterStatus = 'all' | OrderStatus;

export type OrderPaymentMethod = 'COD' | 'VNPAY' | 'MOMO' | 'CARD' | 'BANK' | string;
export type OrderPaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | string;
export type OrderReturnRequestStatus = 'requested' | 'approved' | 'rejected';

export type OrderItem = {
  _id?: string;
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
};

export type OrderShippingAddress = {
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
};

export type OrderShipping = {
  provider?: string | null;
  serviceId?: number | null;
  serviceTypeId?: number | null;
  customerFee?: number | null;
  quotedProviderCost?: number | null;
  actualProviderCost?: number | null;
  comparisonStatus?: 'live' | 'partial' | 'fallback' | string | null;
  pricingMode?: 'CHEAPEST' | 'RECOMMENDED' | 'FIXED_FALLBACK' | string | null;
  selectedOptionKey?: string | null;
  recommendedOptionKey?: string | null;
  quoteVersion?: string | null;
  status?: string | null;
  trackingCode?: string | null;
  labelUrl?: string | null;
  estimatedDeliveryDate?: string | null;
};

export type OrderReturnRequest = {
  reason: string;
  imageUrls?: string[];
  status: OrderReturnRequestStatus;
  requestedAt: string;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  reviewReason?: string | null;
};

export type OrderCancellation = {
  reason?: string | null;
  imageUrls?: string[];
  cancelledAt: string;
  cancelledBy?: string | null;
  actorRole?: 'user' | 'admin' | 'staff' | 'system' | string | null;
};

export type OrderEvidenceImageAttachment = {
  imageBase64: string;
  mimeType?: string;
};

export type CustomerOrder = {
  _id: string;
  orderCode: string;
  invoiceCode?: string | null;
  order_list: OrderItem[];
  subTotal: number;
  shippingFee: number;
  couponCode?: string | null;
  couponDiscountAmount: number;
  shippingDiscountAmount: number;
  membershipDiscountAmount: number;
  taxAmount: number;
  totalAmount: number;
  status: OrderStatus;
  paymentMethod: OrderPaymentMethod;
  paymentMethodId?: string | null;
  paymentStatus: OrderPaymentStatus;
  returnRequest?: OrderReturnRequest | null;
  cancellation?: OrderCancellation | null;
  shipping?: OrderShipping | null;
  shippingAddress: OrderShippingAddress;
  orderNote?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OrderStatusSummary = Record<OrderStatus, number> & {
  all: number;
};

export type OrderListResponse = {
  items: CustomerOrder[];
  statusSummary?: OrderStatusSummary;
  pagination?: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
};

export class OrderApiError extends Error {
  errors?: ApiValidationError[];
  status?: number;

  constructor(message: string, errors?: ApiValidationError[], status?: number) {
    super(message);
    this.name = 'OrderApiError';
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
    timeoutMs: options.timeoutMs ?? (method === 'GET' ? ORDER_READ_TIMEOUT_MS : ORDER_WRITE_TIMEOUT_MS),
    retryOnTimeout: options.retryOnTimeout ?? method === 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : '';
    const isTimeout = /AbortError|aborted/i.test(message);

    throw new OrderApiError(
      isTimeout
        ? 'Kết nối tới máy chủ quá lâu. Bạn kiểm tra backend đang chạy rồi thử lại nha.'
        : 'Không kết nối được tới máy chủ đơn hàng.',
    );
  });
  const payload = parseApiResponse<T>(await response.text());

  if (!response.ok || payload.data === undefined) {
    const validationMessage = payload.errors?.map((error) => error.message).join('\n');
    throw new OrderApiError(
      validationMessage || payload.message || 'Không thể xử lý đơn hàng',
      payload.errors,
      response.status,
    );
  }

  return payload.data as T;
};

export const orderApi = {
  getMyOrders: (
    token: string,
    options: {
      status?: OrderFilterStatus;
      paymentMethod?: OrderPaymentMethod | 'all';
      paymentStatus?: OrderPaymentStatus | 'all';
      keyword?: string;
      page?: number;
      limit?: number;
    } = {},
  ) => {
    const query = new URLSearchParams({
      page: String(options.page ?? 1),
      limit: String(options.limit ?? 20),
    });

    if (options.status && options.status !== 'all') {
      query.set('status', options.status);
    }

    if (options.paymentMethod && options.paymentMethod !== 'all') {
      query.set('paymentMethod', options.paymentMethod);
    }

    if (options.paymentStatus && options.paymentStatus !== 'all') {
      query.set('paymentStatus', options.paymentStatus);
    }

    if (options.keyword?.trim()) {
      query.set('keyword', options.keyword.trim());
    }

    return request<OrderListResponse>(`/orders/me?${query.toString()}`, token);
  },
  getOrderById: (token: string, orderId: string) =>
    request<CustomerOrder>(`/orders/${encodeURIComponent(orderId)}`, token),
  cancelOrder: (
    token: string,
    orderId: string,
    payload?: {
      reason?: string;
      imageUrls?: string[];
      imageAttachments?: OrderEvidenceImageAttachment[];
    },
  ) =>
    request<CustomerOrder>(`/orders/${encodeURIComponent(orderId)}/cancel`, token, {
      method: 'PATCH',
      body: payload,
    }),
  confirmReceived: (token: string, orderId: string) =>
    request<CustomerOrder>(`/orders/${encodeURIComponent(orderId)}/confirm-received`, token, { method: 'PATCH' }),
  requestReturn: (
    token: string,
    orderId: string,
    reason: string,
    options?: {
      imageUrls?: string[];
      imageAttachments?: OrderEvidenceImageAttachment[];
    },
  ) =>
    request<CustomerOrder>(`/orders/${encodeURIComponent(orderId)}/request-return`, token, {
      method: 'PATCH',
      body: {
        reason,
        ...(options?.imageUrls?.length ? { imageUrls: options.imageUrls } : {}),
        ...(options?.imageAttachments?.length ? { imageAttachments: options.imageAttachments } : {}),
      },
    }),
};
