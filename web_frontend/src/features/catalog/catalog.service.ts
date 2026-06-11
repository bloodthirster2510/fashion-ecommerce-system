import { axiosClient } from '../../services/axiosClient'
import type { ApiResponse } from '../../types/api.type'
import type { CatalogCategory, ProductDetail, ProductListQuery, ProductListResponse } from './catalog.types'

class CatalogApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CatalogApiError'
  }
}

// Backend chuẩn hóa response theo dạng { message, data }; service này gom việc
// parse JSON và đổi lỗi network/API thành error dễ dùng cho component.
const request = async <T>(path: string): Promise<T> => {
  let response: Response

  try {
    response = await fetch(`${axiosClient.baseURL}${path}`)
  } catch {
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

const appendListParam = (params: URLSearchParams, key: string, values?: string[]) => {
  values?.forEach((value) => {
    const trimmedValue = value.trim()
    if (trimmedValue) {
      params.append(key, trimmedValue)
    }
  })
}

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

export const catalogService = {
  getActiveCategories() {
    return request<CatalogCategory[]>('/categories?activeOnly=true')
  },
  getProducts(query?: ProductListQuery) {
    const queryString = buildProductListQuery(query)
    return request<ProductListResponse>(`/products${queryString ? `?${queryString}` : ''}`)
  },
  getProductById(productId: string) {
    return request<ProductDetail>(`/products/${productId}`)
  },
}
