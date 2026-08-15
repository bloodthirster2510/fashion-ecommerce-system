import { cacheDeleteNamespace, cacheGetJson, cacheSetJson } from '../../../utils/cache';
import { normalizeVietnamese } from './search.util';
import type {
  ProductDetailResponse,
  ProductListFilters,
  ProductListQueryInput,
  ProductListResponse,
} from './product.types';

export const PRODUCT_LIST_CACHE_TTL_MS = 15_000;
export const PRODUCT_DETAIL_CACHE_TTL_MS = 30_000;
export const PRODUCT_FILTERS_CACHE_TTL_MS = 5 * 60_000;

const PRODUCT_LIST_CACHE_NAMESPACE = 'product-list';
const PRODUCT_DETAIL_CACHE_NAMESPACE = 'product-detail';
const PRODUCT_FILTERS_CACHE_NAMESPACE = 'product-filters';

const normalizeValues = (values?: string[]) => (
  Array.from(new Set(
    (values ?? [])
      .map((value) => normalizeVietnamese(String(value)))
      .filter(Boolean),
  )).sort()
);

const getEffectiveSort = (query: ProductListQueryInput) => (
  query.sort ?? (query.keyword?.trim() ? 'relevance' : undefined)
);

const buildQueryKey = (query: ProductListQueryInput, includePaging: boolean) => JSON.stringify({
  keyword: query.keyword ? normalizeVietnamese(query.keyword) : undefined,
  gender: query.gender,
  categoryId: normalizeValues(query.categoryId),
  brandId: normalizeValues(query.brandId),
  color: normalizeValues(query.color),
  fitType: normalizeValues(query.fitType),
  size: normalizeValues(query.size),
  minPrice: query.minPrice,
  maxPrice: query.maxPrice,
  isSale: query.isSale,
  isNew: query.isNew,
  sort: getEffectiveSort(query),
  ...(includePaging
    ? {
        page: query.page ?? 1,
        limit: query.limit ?? 10,
        includeFilters: query.includeFilters !== false,
      }
    : {}),
});

export const getProductListCache = (query: ProductListQueryInput) =>
  cacheGetJson<ProductListResponse>(PRODUCT_LIST_CACHE_NAMESPACE, buildQueryKey(query, true));

export const setProductListCache = (query: ProductListQueryInput, value: ProductListResponse) =>
  cacheSetJson(PRODUCT_LIST_CACHE_NAMESPACE, buildQueryKey(query, true), value, PRODUCT_LIST_CACHE_TTL_MS);

export const getProductDetailCache = (id: string, activeOnly: boolean) =>
  cacheGetJson<ProductDetailResponse>(PRODUCT_DETAIL_CACHE_NAMESPACE, `${id}:${activeOnly ? 'active' : 'all'}`);

export const setProductDetailCache = (
  id: string,
  activeOnly: boolean,
  value: ProductDetailResponse,
) => cacheSetJson(
  PRODUCT_DETAIL_CACHE_NAMESPACE,
  `${id}:${activeOnly ? 'active' : 'all'}`,
  value,
  PRODUCT_DETAIL_CACHE_TTL_MS,
);

export const getProductFiltersCache = (query: ProductListQueryInput) =>
  cacheGetJson<ProductListFilters>(PRODUCT_FILTERS_CACHE_NAMESPACE, buildQueryKey(query, false));

export const setProductFiltersCache = (query: ProductListQueryInput, value: ProductListFilters) =>
  cacheSetJson(PRODUCT_FILTERS_CACHE_NAMESPACE, buildQueryKey(query, false), value, PRODUCT_FILTERS_CACHE_TTL_MS);

export const invalidateProductCatalogCache = async () => {
  await Promise.all([
    cacheDeleteNamespace(PRODUCT_LIST_CACHE_NAMESPACE),
    cacheDeleteNamespace(PRODUCT_DETAIL_CACHE_NAMESPACE),
    cacheDeleteNamespace(PRODUCT_FILTERS_CACHE_NAMESPACE),
  ]);
};
