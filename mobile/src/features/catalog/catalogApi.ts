import { apiFetch } from '../../config/api';
import { withCache } from '../../config/apiCache';
import type { ApiResponse, ApiValidationError } from '../auth/types';
import { getRecommendationSessionId } from '../recommendation/recommendationSession';

export type CatalogGender = 'male' | 'female' | 'unisex';

export type ProductSortOption =
  | 'name_asc'
  | 'name_desc'
  | 'price_asc'
  | 'price_desc'
  | 'newest'
  | 'best_seller'
  | 'rating_desc';

export type CatalogProduct = {
  _id: string;
  name: string;
  image: string;
  price: number;
  originalPrice?: number;
  discount: number;
  finalPrice: number;
  isSale: boolean;
  isNew: boolean;
  isAvailable: boolean;
  soldQuantity: number;
  averageRating: number;
  reviewCount: number;
  brand: {
    _id: string;
    name: string;
    image?: string;
  } | null;
  category: {
    _id: string;
    name: string;
    gender?: CatalogGender;
    image?: string;
  } | null;
};

export type ProductDetailColor = {
  _id: string;
  color: string;
  colorCode?: string;
  image: string;
};

export type ProductCategoryBreadcrumbItem = {
  _id: string;
  name: string;
  gender?: CatalogGender;
  parent_id?: string | null;
  level?: number;
};

export type ProductDetailSize = {
  size: string;
  measurements: Array<{
    key: string;
    label?: string;
    unit?: string;
    value: number;
  }>;
  isAvailable: boolean;
  availableQuantity?: number;
};

export type ProductDetailInventoryItem = {
  colorVariantId: string;
  size: string;
  sku: string;
  availableQuantity: number;
  isAvailable: boolean;
};

export type ProductDetailVariant = {
  _id: string;
  fitTypeId: string;
  fitType: {
    _id: string;
    key: string;
    label: string;
  } | null;
  price: number;
  originalPrice: number;
  discount: number;
  finalPrice: number;
  isSale: boolean;
  isActive: boolean;
  colors: ProductDetailColor[];
  sizes: ProductDetailSize[];
  inventory: ProductDetailInventoryItem[];
};

export type CatalogProductDetail = {
  _id: string;
  name: string;
  description: string;
  productImage: string;
  gallery: string[];
  price: number;
  originalPrice: number;
  discount: number;
  finalPrice: number;
  isSale: boolean;
  isNew: boolean;
  isAvailable: boolean;
  soldQuantity: number;
  averageRating: number;
  reviewCount: number;
  brand: {
    _id: string;
    name: string;
    image?: string;
  } | null;
  category: {
    _id: string;
    name: string;
    gender?: CatalogGender;
    image?: string;
  } | null;
  categoryBreadcrumb: ProductCategoryBreadcrumbItem[];
  variants: ProductDetailVariant[];
  selectedVariantId?: string;
  colors: ProductDetailColor[];
  sizes: string[];
  ratingSummary: {
    averageRating: number;
    reviewCount: number;
    distribution: Array<{ rating: 1 | 2 | 3 | 4 | 5; count: number; percent: number }>;
  };
  policies: Array<{ icon: string; title: string; description: string }>;
};

export type CatalogCategory = {
  _id: string;
  name: string;
  parent_id?: string | null;
  level: number;
  gender: CatalogGender;
  image: string;
  description?: string;
  isActive?: boolean;
};

export type ProductListParams = {
  keyword?: string;
  searchEventId?: string;
  searchSource?: 'mobile_manual' | 'mobile_history' | 'mobile_suggestion';
  gender?: CatalogGender;
  categoryId?: string | string[];
  brandId?: string | string[];
  color?: string[];
  fitTypeId?: string[];
  size?: string[];
  minPrice?: number;
  maxPrice?: number;
  isSale?: boolean;
  isNew?: boolean;
  sort?: ProductSortOption;
  page?: number;
  limit?: number;
};

export type ProductListResponse = {
  items: CatalogProduct[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
  filters: {
    brands: Array<{ _id: string; name: string; image?: string }>;
    colors: string[];
    fitTypes: string[];
    sizes: string[];
    categories: CatalogCategory[];
  };
};

export type CategoryListParams = {
  gender?: CatalogGender;
  parentId?: string;
  activeOnly?: boolean;
};

export class CatalogApiError extends Error {
  errors?: ApiValidationError[];
  status?: number;

  constructor(message: string, errors?: ApiValidationError[], status?: number) {
    super(message);
    this.name = 'CatalogApiError';
    this.errors = errors;
    this.status = status;
  }
}

export const parseApiResponse = <T>(text: string): ApiResponse<T> => {
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

const request = async <T>(path: string, signal?: AbortSignal, token?: string): Promise<T> => {
  const sessionId = await getRecommendationSessionId();
  const response = await apiFetch(path, {
    signal,
    headers: {
      'X-Session-Id': sessionId,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const payload = parseApiResponse<T>(await response.text());

  if (!response.ok) {
    const validationMessage = payload.errors?.map((error) => error.message).join('\n');
    throw new CatalogApiError(
      validationMessage || payload.message || 'Không thể tải dữ liệu catalog',
      payload.errors,
      response.status,
    );
  }

  if (payload.data === undefined) {
    throw new CatalogApiError(payload.message || 'Dữ liệu catalog không hợp lệ');
  }

  return payload.data;
};

const CATEGORIES_CACHE_TTL_MS = 5 * 60 * 1000;
const PRODUCT_DETAIL_CACHE_TTL_MS = 60 * 1000;
const PRODUCT_DETAIL_STALE_MS = 5 * 60 * 1000;

const getProducts = (params: ProductListParams = {}, signal?: AbortSignal, token?: string) => {
  return request<ProductListResponse>(`/products${toQueryString(params)}`, signal, token);
};

const getProductById = (productId: string, signal?: AbortSignal) => {
  const key = `product:${productId}`;
  return withCache(
    key,
    () => request<CatalogProductDetail>(`/products/${encodeURIComponent(productId)}`, signal),
    { ttlMs: PRODUCT_DETAIL_CACHE_TTL_MS, staleWhileRevalidateMs: PRODUCT_DETAIL_STALE_MS },
  );
};

const getCategories = (params: CategoryListParams = {}, signal?: AbortSignal) => {
  const query = toQueryString({ activeOnly: true, ...params });
  const key = `categories:${query}`;
  return withCache(
    key,
    () => request<CatalogCategory[]>(`/categories${query}`, signal),
    { ttlMs: CATEGORIES_CACHE_TTL_MS },
  );
};

export const catalogApi = {
  getProducts,
  getProductById,
  getCategories,
  getBestSellers: (limit = 4, signal?: AbortSignal) => getProducts({ sort: 'best_seller', page: 1, limit }, signal),
  getRecommended: (limit = 4, signal?: AbortSignal) => getProducts({ sort: 'newest', page: 1, limit }, signal),
};
