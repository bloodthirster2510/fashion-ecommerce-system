import { apiFetch } from '../../config/api';
import type { ApiResponse, ApiValidationError } from '../auth/types';
import type { CatalogProduct } from '../catalog/catalogApi';
import { getRecommendationSessionId } from './recommendationSession';

export type RecommendationContext =
  | 'home'
  | 'product_detail_similar'
  | 'cart';

export type RecommendationEventType = 'impression' | 'click' | 'add_to_cart' | 'purchase';

export type RecommendationReasonCode =
  | 'same_category'
  | 'same_brand'
  | 'same_gender'
  | 'same_color'
  | 'similar_price'
  | 'preferred_category'
  | 'preferred_brand'
  | 'preferred_color'
  | 'completes_outfit'
  | 'matches_cart_style'
  | 'popular'
  | 'on_sale'
  | 'new_arrival';

export type RecommendationItem = {
  product: CatalogProduct;
  score: number;
  rank: number;
  reason: string;
  reasonCodes: RecommendationReasonCode[];
};

export type RecommendationResponse = {
  requestId: string;
  algorithmVersion: string;
  items: RecommendationItem[];
  fallbackUsed: boolean;
};

export type RecommendationEventPayload = {
  requestId: string;
  eventType: RecommendationEventType;
  context: RecommendationContext;
  recommendedProductId: string;
  sourceProductId?: string;
  algorithmVersion?: string;
  score?: number;
  rank?: number;
  reasonCodes?: string[];
};

type RequestOptions = {
  token?: string;
  signal?: AbortSignal;
  method?: 'GET' | 'POST';
  body?: Record<string, unknown>;
};

export class RecommendationApiError extends Error {
  errors?: ApiValidationError[];
  status?: number;

  constructor(message: string, errors?: ApiValidationError[], status?: number) {
    super(message);
    this.name = 'RecommendationApiError';
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

const toQueryString = (query: Record<string, unknown>) => {
  const params = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);

  return params.length ? `?${params.join('&')}` : '';
};

const request = async <T>(path: string, options: RequestOptions = {}) => {
  const sessionId = await getRecommendationSessionId();
  const response = await apiFetch(path, {
    method: options.method ?? 'GET',
    signal: options.signal,
    retryOnTimeout: options.method === undefined || options.method === 'GET',
    headers: {
      'X-Session-Id': sessionId,
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify({ ...options.body, sessionId }) : undefined,
  });
  const payload = parseApiResponse<T>(await response.text());

  if (!response.ok || payload.data === undefined) {
    const validationMessage = payload.errors?.map((error) => error.message).join('\n');
    throw new RecommendationApiError(
      validationMessage || payload.message || 'Không tải được gợi ý sản phẩm',
      payload.errors,
      response.status,
    );
  }

  return payload.data;
};

export const recommendationApi = {
  getPersonalRecommendations: (limit = 10, token?: string, signal?: AbortSignal) =>
    request<RecommendationResponse>(`/recommendations/me${toQueryString({ limit })}`, {
      token,
      signal,
    }),
  getSimilarProducts: (productId: string, limit = 8, token?: string, signal?: AbortSignal) =>
    request<RecommendationResponse>(
      `/recommendations/products/${encodeURIComponent(productId)}/similar${toQueryString({ limit })}`,
      { token, signal },
    ),
  getCartRecommendations: (limit = 8, token?: string, signal?: AbortSignal) =>
    request<RecommendationResponse>(`/recommendations/cart${toQueryString({ limit })}`, {
      token,
      signal,
    }),
  recordEvent: (payload: RecommendationEventPayload, token?: string) =>
    request<{ recorded: boolean; eventId: string }>('/recommendations/events', {
      method: 'POST',
      token,
      body: payload,
    }),
};
