import { apiFetch } from '../../config/api';
import { invalidateAfterMutation, invalidateFavoriteCaches } from '../../config/cacheInvalidation';
import type { ApiResponse, ApiValidationError } from '../auth/types';
import type { CatalogProduct, ProductSortOption } from '../catalog/catalogApi';

const FAVORITES_READ_TIMEOUT_MS = 20000;
const FAVORITES_WRITE_TIMEOUT_MS = 20000;

export type FavoriteSortOption = Exclude<ProductSortOption, 'relevance'> | 'favorited_desc' | 'favorited_asc';

export type FavoriteProduct = CatalogProduct & {
  favoritedAt: string;
  isFavorited: true;
};

export type FavoriteListParams = {
  keyword?: string;
  categoryId?: string | string[];
  brandId?: string | string[];
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sort?: FavoriteSortOption;
  page?: number;
  limit?: number;
};

export type FavoriteListResponse = {
  items: FavoriteProduct[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
};

export type FavoriteStatusResponse = {
  productId: string;
  isFavorited: boolean;
};

export class FavoriteApiError extends Error {
  errors?: ApiValidationError[];
  status?: number;

  constructor(message: string, errors?: ApiValidationError[], status?: number) {
    super(message);
    this.name = 'FavoriteApiError';
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

const appendQueryParam = (params: string[], key: string, value: unknown) => {
  if (value === undefined || value === null || value === '') {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => appendQueryParam(params, key, item));
    return;
  }

  params.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
};

const toQueryString = (query: Record<string, unknown>) => {
  const params: string[] = [];

  Object.entries(query).forEach(([key, value]) => appendQueryParam(params, key, value));

  return params.length ? `?${params.join('&')}` : '';
};

const request = async <T>(
  path: string,
  token: string,
  options: {
    method?: 'GET' | 'POST' | 'DELETE';
    body?: Record<string, unknown>;
    timeoutMs?: number;
  } = {},
) => {
  const method = options.method ?? 'GET';
  const response = await apiFetch(path, {
    method,
    timeoutMs: options.timeoutMs ?? (method === 'GET' ? FAVORITES_READ_TIMEOUT_MS : FAVORITES_WRITE_TIMEOUT_MS),
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = parseApiResponse<T>(await response.text());

  if (!response.ok || payload.data === undefined) {
    const validationMessage = payload.errors?.map((error) => error.message).join('\n');
    throw new FavoriteApiError(
      validationMessage || payload.message || 'Không thể cập nhật sản phẩm yêu thích',
      payload.errors,
      response.status,
    );
  }

  return payload.data as T;
};

export const favoritesApi = {
  getFavorites: (token: string, params: FavoriteListParams = {}) =>
    request<FavoriteListResponse>(`/favorites${toQueryString(params)}`, token),
  getStatus: (token: string, productId: string) =>
    request<FavoriteStatusResponse>(
      `/favorites/status${toQueryString({ productId })}`,
      token,
    ),
  addFavorite: (token: string, productId: string) =>
    invalidateAfterMutation(
      request<FavoriteStatusResponse>('/favorites', token, {
        method: 'POST',
        body: { productId },
      }),
      invalidateFavoriteCaches,
    ),
  removeFavorite: (token: string, productId: string) =>
    invalidateAfterMutation(
      request<FavoriteStatusResponse>(
        `/favorites/${encodeURIComponent(productId)}`,
        token,
        { method: 'DELETE' },
      ),
      invalidateFavoriteCaches,
    ),
};
