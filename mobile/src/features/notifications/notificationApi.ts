import { apiFetch } from '../../config/api';
import type { ApiResponse } from '../auth/types';

export type CustomerNotificationSummary = {
  total: number;
  cartItems: number;
  ordersNeedAction: number;
  support: {
    unreadReplies: number;
    waitingCustomer: number;
    total: number;
  };
  generatedAt: string;
};

const parse = async <T,>(response: Response) => {
  const payload = JSON.parse((await response.text()) || '{}') as ApiResponse<T>;
  if (!response.ok || payload.data === undefined) {
    throw Object.assign(new Error(payload.message || 'Không thể tải thông báo.'), { status: response.status });
  }
  return payload.data;
};

export const notificationApi = {
  getSummary: async (token: string) => parse<CustomerNotificationSummary>(await apiFetch('/notifications/summary', {
    headers: { Authorization: `Bearer ${token}` },
    timeoutMs: 20_000,
  })),
};
