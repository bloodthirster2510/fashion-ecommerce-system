import { requestAdmin } from '../../services/adminHttp'
import type {
  AdminCoupon,
  CategoryOption,
  CouponDetailResponse,
  CouponListFilters,
  CouponListResponse,
  CouponPayload,
  CouponUsageListResponse,
  ProductOption,
} from './promotion.types'

type ProductListResponse = {
  items: ProductOption[]
}

const buildCouponListQuery = (filters: CouponListFilters) => {
  const params = new URLSearchParams()
  const keyword = filters.keyword?.trim()

  if (keyword) {
    params.set('keyword', keyword)
  }

  if (filters.status && filters.status !== 'all') {
    params.set('status', filters.status)
  }

  if (filters.sort) {
    params.set('sort', filters.sort)
  }

  params.set('page', String(filters.page ?? 1))
  params.set('limit', String(filters.limit ?? 10))

  return params.toString()
}

export const listCoupons = (filters: CouponListFilters) =>
  requestAdmin<CouponListResponse>(`/admin/coupons?${buildCouponListQuery(filters)}`)

export const getCoupon = (id: string) =>
  requestAdmin<CouponDetailResponse>(`/admin/coupons/${id}`)

export const listCouponUsage = (id: string, page = 1, limit = 10) =>
  requestAdmin<CouponUsageListResponse>(`/admin/coupons/${id}/usage?page=${page}&limit=${limit}`)

export const createCoupon = (payload: CouponPayload) =>
  requestAdmin<AdminCoupon>('/admin/coupons', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const updateCoupon = (id: string, payload: CouponPayload) =>
  requestAdmin<AdminCoupon>(`/admin/coupons/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })

export const updateCouponStatus = (id: string, isActive: boolean) =>
  requestAdmin<AdminCoupon>(`/admin/coupons/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  })

export const deleteCoupon = (id: string) =>
  requestAdmin<AdminCoupon>(`/admin/coupons/${id}`, {
    method: 'DELETE',
  })

export const listCouponCategories = () =>
  requestAdmin<CategoryOption[]>('/admin/categories/list?activeOnly=true')

export const listCouponProducts = (keyword = '', page = 1, limit = 20) => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (keyword.trim()) {
    params.set('keyword', keyword.trim())
  }

  return requestAdmin<ProductListResponse>(`/admin/products/list?${params.toString()}`)
    .then((response) => response.items)
}
