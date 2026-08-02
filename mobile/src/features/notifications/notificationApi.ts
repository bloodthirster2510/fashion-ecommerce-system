import { apiFetch } from '../../config/api';
import { invalidateAfterMutation, invalidateNotificationCaches } from '../../config/cacheInvalidation';
import type { ApiResponse } from '../auth/types';
import type { PushNotificationPreferences } from './pushNotifications';

export type CustomerNotificationSummary = {
  total: number;
  unreadCount: number;
  attentionTotal: number;
  cartItems: number;
  ordersNeedAction: number;
  support: {
    unreadReplies: number;
    waitingCustomer: number;
    total: number;
  };
  generatedAt: string;
};

export type CustomerNotificationCategory = 'order' | 'promotion' | 'support' | 'account' | 'virtual_try_on' | 'system';

export type CustomerNotificationItem = {
  _id: string;
  category: CustomerNotificationCategory;
  type: string;
  title: string;
  body: string;
  imageUrl?: string | null;
  action?: {
    type: 'order_detail' | 'support_ticket_detail' | 'product_detail' | 'coupons' | 'membership' | 'profile' |
      'virtual_try_on_result' | 'virtual_try_on_processing' | 'virtual_try_on_home';
    label?: string | null;
    entityId?: string | null;
  } | null;
  data: Record<string, unknown>;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomerNotificationList = {
  items: CustomerNotificationItem[];
  pagination: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
  unreadCount: number;
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
  getNotifications: async (
    token: string,
    input: { limit?: number; cursor?: string | null; category?: CustomerNotificationCategory } = {},
  ) => {
    const params = new URLSearchParams();
    if (input.limit) params.set('limit', String(input.limit));
    if (input.cursor) params.set('cursor', input.cursor);
    if (input.category) params.set('category', input.category);
    const query = params.toString();
    return parse<CustomerNotificationList>(await apiFetch(`/notifications${query ? `?${query}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
      timeoutMs: 20_000,
    }));
  },
  markRead: async (token: string, notificationId: string) =>
    invalidateAfterMutation(
      parse<CustomerNotificationItem>(await apiFetch(`/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        retryOnTimeout: false,
      })),
      invalidateNotificationCaches,
    ),
  markAllRead: async (token: string) =>
    invalidateAfterMutation(
      parse<{ updatedCount: number; readAt: string }>(await apiFetch('/notifications/read-all', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        retryOnTimeout: false,
      })),
      invalidateNotificationCaches,
    ),
  registerPushToken: async (
    token: string,
    pushToken: string,
    platform: 'ios' | 'android',
    preferences: PushNotificationPreferences,
  ) => parse(await apiFetch('/notifications/push-token', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token: pushToken, platform, preferences }),
    retryOnTimeout: false,
  })),
  unregisterPushToken: async (token: string, pushToken: string) =>
    parse<{ disabled: boolean }>(await apiFetch('/notifications/push-token', {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: pushToken }),
      retryOnTimeout: false,
    })),
};
