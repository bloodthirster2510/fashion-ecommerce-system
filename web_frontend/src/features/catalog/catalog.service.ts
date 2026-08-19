import { axiosClient } from '../../services/axiosClient'
import { getOptionalCustomerAccessToken, getRefreshedCustomerAccessToken } from '../../services/customerHttp'
import type { ApiResponse } from '../../types/api.type'
import { withRecommendationSessionHeader } from '../recommendation/recommendationSession'
import type {
  CatalogCategory,
  ProductDetail,
  ProductListFilters,
  ProductListQuery,
  ProductListResponse,
  SearchSuggestResponse,
  VisualSearchResponse,
} from './catalog.types'

class CatalogApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CatalogApiError'
  }
}

const isAbortError = (error: unknown) => error instanceof Error && error.name === 'AbortError'

const buildRequestHeaders = (headers?: HeadersInit, accessToken?: string | null) => {
  const nextHeaders = withRecommendationSessionHeader(headers)

  if (accessToken) {
    nextHeaders.set('Authorization', `Bearer ${accessToken}`)
  }

  return nextHeaders
}

// Backend chuẩn hóa response theo dạng { message, data }; service này gom việc
// parse JSON và đổi lỗi network/API thành error dễ dùng cho component.
const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  let response: Response

  try {
    const accessToken = await getOptionalCustomerAccessToken()
    response = await axiosClient.fetch(path, {
      ...init,
      headers: buildRequestHeaders(init?.headers, accessToken),
    })

    if (response.status === 401 && accessToken) {
      try {
        const refreshedAccessToken = await getRefreshedCustomerAccessToken()
        response = await axiosClient.fetch(path, {
          ...init,
          headers: buildRequestHeaders(init?.headers, refreshedAccessToken),
        })
      } catch {
        response = await axiosClient.fetch(path, {
          ...init,
          headers: buildRequestHeaders(init?.headers),
        })
      }
    }
  } catch (requestError) {
    if (isAbortError(requestError)) {
      throw requestError
    }

    throw new CatalogApiError('Không thể kết nối tới server danh mục.')
  }

  let body: ApiResponse<T>

  try {
    body = (await response.json()) as ApiResponse<T>
  } catch {
    throw new CatalogApiError('Server danh mục trả về dữ liệu không hợp lệ.')
  }

  if (!response.ok || body.data === undefined) {
    throw new CatalogApiError(body.message || 'Không thể tải danh mục.')
  }

  return body.data
}

// Thêm nhiều giá trị lọc vào query string, ví dụ nhiều màu hoặc nhiều size.
const appendListParam = (params: URLSearchParams, key: string, values?: string[]) => {
  values?.forEach((value) => {
    const trimmedValue = value.trim()
    if (trimmedValue) {
      params.append(key, trimmedValue)
    }
  })
}

// Chuyển bộ lọc sản phẩm trên giao diện thành query string gửi lên backend.
const buildProductListQuery = (query: ProductListQuery = {}) => {
  const params = new URLSearchParams()

  if (query.keyword) params.set('keyword', query.keyword)
  if (query.gender) params.set('gender', query.gender)
  if (query.categoryId) params.set('categoryId', query.categoryId)
  if (query.brandId) params.set('brandId', query.brandId)
  appendListParam(params, 'color', query.color)
  appendListParam(params, 'fitType', query.fitType)
  appendListParam(params, 'size', query.size)
  if (query.minPrice !== undefined) params.set('minPrice', String(query.minPrice))
  if (query.maxPrice !== undefined) params.set('maxPrice', String(query.maxPrice))
  if (query.isSale !== undefined) params.set('isSale', String(query.isSale))
  if (query.isNew !== undefined) params.set('isNew', String(query.isNew))
  if (query.sort) params.set('sort', query.sort)
  if (query.page) params.set('page', String(query.page))
  if (query.limit) params.set('limit', String(query.limit))

  return params.toString()
}

// Thêm nhiều giá trị lọc vào FormData khi gửi ảnh tìm kiếm.
const appendFormListParam = (formData: FormData, key: string, values?: string[]) => {
  values?.forEach((value) => {
    const trimmedValue = value.trim()
    if (trimmedValue) {
      formData.append(key, trimmedValue)
    }
  })
}

// Tạo form upload ảnh kèm các filter hiện tại để tìm sản phẩm tương tự.
const buildVisualSearchFormData = (image: File, query: ProductListQuery = {}) => {
  const formData = new FormData()

  formData.append('image', image)
  formData.set('limit', String(query.limit ?? 20))
  if (query.gender) formData.set('gender', query.gender)
  if (query.categoryId) formData.set('categoryId', query.categoryId)
  if (query.brandId) formData.set('brandId', query.brandId)
  appendFormListParam(formData, 'color', query.color)
  if (query.minPrice !== undefined) formData.set('minPrice', String(query.minPrice))
  if (query.maxPrice !== undefined) formData.set('maxPrice', String(query.maxPrice))

  return formData
}

// Tạo payload JSON cho text-to-image search bằng FashionCLIP.
const buildVisualSearchTextPayload = (text: string, query: ProductListQuery = {}) => ({
  text,
  limit: query.limit ?? 20,
  ...(query.gender ? { gender: query.gender } : {}),
  ...(query.categoryId ? { categoryId: query.categoryId } : {}),
  ...(query.brandId ? { brandId: query.brandId } : {}),
  ...(query.color?.length ? { color: query.color } : {}),
  ...(query.fitType?.length ? { fitType: query.fitType } : {}),
  ...(query.size?.length ? { size: query.size } : {}),
  ...(query.minPrice !== undefined ? { minPrice: query.minPrice } : {}),
  ...(query.maxPrice !== undefined ? { maxPrice: query.maxPrice } : {}),
  ...(query.isSale !== undefined ? { isSale: query.isSale } : {}),
  ...(query.isNew !== undefined ? { isNew: query.isNew } : {}),
})

const CATEGORY_CACHE_TTL_MS = 5 * 60 * 1000
let categoryCache: { data: CatalogCategory[]; expiresAt: number } | null = null
let categoryRequest: Promise<CatalogCategory[]> | null = null

// Lấy danh mục đang hoạt động và cache ngắn hạn để tránh gọi API lặp lại.
const getActiveCategories = () => {
  if (categoryCache && categoryCache.expiresAt > Date.now()) {
    return Promise.resolve(categoryCache.data)
  }

  if (categoryRequest) {
    return categoryRequest
  }

  categoryRequest = request<CatalogCategory[]>('/categories?activeOnly=true')
    .then((data) => {
      categoryCache = {
        data,
        expiresAt: Date.now() + CATEGORY_CACHE_TTL_MS,
      }
      return data
    })
    .finally(() => {
      categoryRequest = null
    })

  return categoryRequest
}

export const catalogService = {
  getActiveCategories,
  getProducts(query?: ProductListQuery, includeFilters = true, init?: RequestInit) {
    const queryString = buildProductListQuery(query)
    const params = new URLSearchParams(queryString)
    params.set('includeFilters', String(includeFilters))
    return request<ProductListResponse>(`/products?${params.toString()}`, init)
  },
  getProductFilters(query?: ProductListQuery, init?: RequestInit) {
    const queryString = buildProductListQuery(query)
    return request<ProductListFilters>(`/products/filters${queryString ? `?${queryString}` : ''}`, init)
  },
  getProductById(productId: string) {
    return request<ProductDetail>(`/products/${productId}`)
  },
  suggestSearch(query: string, init?: RequestInit) {
    const params = new URLSearchParams({
      q: query.trim(),
      limit: '5',
    })
    return request<SearchSuggestResponse>(`/products/suggest?${params.toString()}`, init)
  },
  searchProductsByImage(image: File, query?: ProductListQuery) {
    return request<VisualSearchResponse>('/products/visual-search', {
      method: 'POST',
      body: buildVisualSearchFormData(image, query),
    })
  },
  searchProductsByText(text: string, query?: ProductListQuery) {
    return request<VisualSearchResponse>('/products/visual-search/text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildVisualSearchTextPayload(text, query)),
    })
  },
}
