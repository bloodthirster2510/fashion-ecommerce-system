import { apiFetch } from '../../config/api';
import { Platform } from 'react-native';
import type { ApiResponse } from '../auth/types';
import type {
  FaqArticle,
  SupportCategory,
  SupportImage,
  SupportMessage,
  SupportSummary,
  SupportTicket,
  SupportTicketDetail,
  SupportTicketType,
} from './support.types';

type Pagination<T> = { items: T[]; pagination: { page: number; totalItems: number; totalPages: number } };

export class SupportApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) { super(message); this.name = 'SupportApiError'; this.status = status; }
}

const parse = async <T>(response: Response) => {
  const payload = JSON.parse((await response.text()) || '{}') as ApiResponse<T>;
  if (!response.ok || payload.data === undefined) throw new SupportApiError(payload.message || 'Không thể kết nối máy chủ', response.status);
  return payload.data;
};

const request = async <T>(path: string, token?: string, init?: RequestInit) => {
  const headers = new Headers(init?.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init?.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  return parse<T>(await apiFetch(path, { ...init, headers, timeoutMs: 30000 }));
};

const appendImages = (form: FormData, images: SupportImage[]) => images.forEach((image) => {
  form.append('attachments', { uri: image.uri, name: image.name, type: image.type } as unknown as Blob);
});

export const supportApi = {
  listFaqs: (search = '', category?: string) => {
    const params = new URLSearchParams({ page: '1', limit: '50' });
    if (search.trim()) params.set('search', search.trim());
    if (category) params.set('category', category);
    return request<Pagination<FaqArticle>>(`/support/faqs?${params.toString()}`);
  },
  voteFaq: (token: string, id: string, value: 'helpful' | 'not_helpful') =>
    request<FaqArticle>(`/support/faqs/${id}/vote`, token, { method: 'POST', body: JSON.stringify({ value }) }),
  listTickets: (token: string) => request<Pagination<SupportTicket>>('/support/tickets?page=1&limit=50', token),
  getTicket: (token: string, id: string) => request<SupportTicketDetail>(`/support/tickets/${id}`, token),
  getSummary: (token: string) => request<SupportSummary>('/support/summary', token),
  createTicket: (token: string, payload: {
    type: SupportTicketType; category: SupportCategory; subject: string; body: string;
    requiresReply: boolean; orderId?: string; couponCode?: string; images: SupportImage[];
  }) => {
    const form = new FormData();
    form.append('type', payload.type); form.append('category', payload.category); form.append('subject', payload.subject);
    form.append('body', payload.body); form.append('requiresReply', String(payload.requiresReply));
    form.append('context', JSON.stringify({
      source: payload.orderId ? 'order_detail' : 'support_home',
      appPlatform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'web' ? 'web' : 'android',
    }));
    if (payload.orderId) form.append('orderId', payload.orderId);
    if (payload.couponCode) form.append('couponCode', payload.couponCode);
    appendImages(form, payload.images);
    return request<SupportTicketDetail>('/support/tickets', token, { method: 'POST', body: form });
  },
  addMessage: (token: string, id: string, body: string, images: SupportImage[]) => {
    const form = new FormData(); form.append('body', body); appendImages(form, images);
    return request<SupportMessage>(`/support/tickets/${id}/messages`, token, { method: 'POST', body: form });
  },
  markRead: (token: string, id: string) => request<SupportTicket>(`/support/tickets/${id}/read`, token, { method: 'PATCH' }),
  closeTicket: (token: string, id: string) => request<SupportTicket>(`/support/tickets/${id}/close`, token, { method: 'PATCH' }),
  reopenTicket: (token: string, id: string) => request<SupportTicket>(`/support/tickets/${id}/reopen`, token, { method: 'PATCH' }),
};
