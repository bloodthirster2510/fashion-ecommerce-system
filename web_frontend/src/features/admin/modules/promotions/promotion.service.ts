import { requestAdmin } from '../../services/adminHttp'
import type {
  AdminCoupon,
  CategoryOption,
  CouponCodeAvailability,
  CouponDetailResponse,
  CouponListFilters,
  CouponListResponse,
  CouponPayload,
  CouponPreview,
  CouponUsageListResponse,
  ProductOption,
  PromotionAnalytics,
  PromotionCampaign,
  PromotionCampaignPayload,
} from './promotion.types'

export type ProductListResponse = {
  items: ProductOption[]
  pagination: {
    page: number
    limit: number
    totalItems: number
    totalPages: number
  }
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

  if (filters.discountType && filters.discountType !== 'all') {
    params.set('discountType', filters.discountType)
  }

  if (filters.visibility && filters.visibility !== 'all') {
    params.set('visibility', filters.visibility)
  }

  if (filters.eligibleUserType && filters.eligibleUserType !== 'all_filter') {
    params.set('eligibleUserType', filters.eligibleUserType)
  }
  if (filters.eligibleMembershipRank) params.set('eligibleMembershipRank', filters.eligibleMembershipRank)
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
  if (filters.dateTo) params.set('dateTo', filters.dateTo)

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

export const checkCouponCodeAvailability = (code: string, excludeId?: string) => {
  const params = new URLSearchParams({ code })
  if (excludeId) {
    params.set('excludeId', excludeId)
  }

  return requestAdmin<CouponCodeAvailability>(`/admin/coupons/check-code?${params.toString()}`)
}

export const listCouponUsage = (
  id: string,
  page = 1,
  limit = 10,
  filters: { keyword?: string; dateFrom?: string; dateTo?: string } = {},
) => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (filters.keyword?.trim()) params.set('keyword', filters.keyword.trim())
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
  if (filters.dateTo) params.set('dateTo', filters.dateTo)
  return requestAdmin<CouponUsageListResponse>(`/admin/coupons/${id}/usage?${params.toString()}`)
}

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
}

export const listPromotionCampaigns = () =>
  requestAdmin<PromotionCampaign[]>('/admin/promotion-campaigns')

export const createPromotionCampaign = (payload: PromotionCampaignPayload) =>
  requestAdmin<PromotionCampaign>('/admin/promotion-campaigns', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const previewCoupon = (coupon: CouponPayload, sampleSubTotal: number, sampleShippingFee: number) =>
  requestAdmin<CouponPreview>('/admin/coupons/preview', {
    method: 'POST',
    body: JSON.stringify({ coupon, sampleSubTotal, sampleShippingFee }),
  })

export const duplicateCoupon = (id: string, payload: CouponPayload) =>
  requestAdmin<AdminCoupon>(`/admin/coupons/${id}/duplicate`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const updatePromotionCampaign = (id: string, payload: Partial<PromotionCampaignPayload>) =>
  requestAdmin<PromotionCampaign>(`/admin/promotion-campaigns/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })

export const deletePromotionCampaign = (id: string) =>
  requestAdmin<PromotionCampaign>(`/admin/promotion-campaigns/${id}`, { method: 'DELETE' })

export const getPromotionAnalytics = (from?: string, to?: string) => {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const query = params.toString()
  return requestAdmin<PromotionAnalytics>(`/admin/promotion-analytics${query ? `?${query}` : ''}`)
}
