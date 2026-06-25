import { apiFetch } from '../../config/api';
import type { ApiResponse } from '../auth/types';
import type {
  CreatedReview,
  EligibleReviewItem,
  EligibleReviewItemsResponse,
  MyReviewList,
  PublicReviewList,
  ReviewCriteria,
  ReviewEligibility,
  ReviewImageDraft,
} from './review.types';

const request = async <T>(path: string, token?: string, init?: RequestInit) => {
  const headers = new Headers(init?.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init?.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const response = await apiFetch(path, { ...init, headers, timeoutMs: 30000 });
  const payload = JSON.parse((await response.text()) || '{}') as ApiResponse<T>;
  if (!response.ok || payload.data === undefined) {
    throw new Error(payload.message || 'Không thể xử lý đánh giá');
  }
  return payload.data;
};

export const reviewApi = {
  listProductReviews: (
    productId: string,
    query: { page?: number; limit?: number; rating?: number; sort?: 'newest' | 'oldest' } = {},
  ) => {
    const params = new URLSearchParams({
      page: String(query.page ?? 1),
      limit: String(query.limit ?? 5),
      sort: query.sort ?? 'newest',
    });
    if (query.rating !== undefined) params.set('rating', String(query.rating));
    return request<PublicReviewList>(`/reviews/products/${encodeURIComponent(productId)}?${params.toString()}`);
  },
  getEligibility: (token: string, orderId: string, orderItemId: string) => {
    const query = new URLSearchParams({ orderId, orderItemId });
    return request<ReviewEligibility>(`/reviews/eligibility?${query.toString()}`, token);
  },
  listEligibleItems: (token: string) =>
    request<EligibleReviewItemsResponse>('/reviews/eligible-items?page=1&limit=100&status=all', token),
  create: (token: string, input: {
    orderId: string;
    orderItemId: string;
    rating: number;
    comment: string;
    criteria?: ReviewCriteria;
    images: ReviewImageDraft[];
  }) => {
    const form = new FormData();
    form.append('orderId', input.orderId);
    form.append('orderItemId', input.orderItemId);
    form.append('rating', String(input.rating));
    form.append('comment', input.comment);
    if (input.criteria) form.append('criteria', JSON.stringify(input.criteria));
    input.images.slice(0, 5).forEach((image) => {
      form.append('images', { uri: image.uri, name: image.name, type: image.type } as unknown as Blob);
    });
    return request<CreatedReview>('/reviews', token, { method: 'POST', body: form });
  },
  listMine: (token: string) => request<MyReviewList>('/reviews/me?page=1&limit=100&sort=newest', token),
  update: (token: string, reviewId: string, input: {
    rating: number;
    comment: string;
    keepImageIds?: string[];
    criteria?: ReviewCriteria;
    images?: ReviewImageDraft[];
  }) => {
    const form = new FormData();
    form.append('rating', String(input.rating));
    form.append('comment', input.comment);
    if (input.criteria) form.append('criteria', JSON.stringify(input.criteria));
    if (input.keepImageIds) form.append('keepImageIds', JSON.stringify(input.keepImageIds));
    input.images?.slice(0, 5).forEach((image) => {
      form.append('images', { uri: image.uri, name: image.name, type: image.type } as unknown as Blob);
    });
    return request<CreatedReview>(`/reviews/${encodeURIComponent(reviewId)}`, token, { method: 'PATCH', body: form });
  },
  deleteMine: (token: string, reviewId: string) => request<{ reviewId: string; deleted: true }>(
    `/reviews/${encodeURIComponent(reviewId)}`,
    token,
    { method: 'DELETE' },
  ),
  toggleHelpful: (token: string, reviewId: string) => request<{
    reviewId: string;
    helpfulCount: number;
    hasVotedHelpful: boolean;
  }>(`/reviews/${encodeURIComponent(reviewId)}/helpful`, token, { method: 'POST' }),
};
