import { requestAdmin } from '../services/adminHttp'

export type CouponDiscountType = 'percent' | 'fixed' | 'free_shipping'
export type CouponEligibleUserType = 'all' | 'new_user' | 'member'

export type AdminCoupon = {
  _id: string
  code: string
  name: string
  description?: string | null
  discountType: CouponDiscountType
  discountValue: number
  maxDiscountAmount?: number | null
  minOrderAmount: number
  usageLimit?: number | null
  usedCount: number
  perUserLimit: number
  isPublic: boolean
  eligibleUserTypes: CouponEligibleUserType[]
  eligibleMembershipRanks: string[]
  applicableProducts: string[]
  applicableCategories: string[]
  startAt: string
  endAt: string
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export type CouponPayload = {
  code: string
  name: string
  description?: string | null
  discountType: CouponDiscountType
  discountValue: number
  maxDiscountAmount?: number | null
  minOrderAmount: number
  usageLimit?: number | null
  perUserLimit: number
  isPublic: boolean
  eligibleUserTypes: CouponEligibleUserType[]
  eligibleMembershipRanks: string[]
  applicableProducts: string[]
  applicableCategories: string[]
  startAt: string
  endAt: string
  isActive: boolean
}

export type CouponListFilters = {
  status?: 'all' | 'active' | 'inactive' | 'expired' | 'upcoming'
  keyword?: string
  page?: number
  limit?: number
}

export type CouponListResponse = {
  items: AdminCoupon[]
  pagination: {
    page: number
    limit: number
    totalItems: number
    totalPages: number
  }
}

export type CouponDetailResponse = {
  coupon: AdminCoupon
  usageCount: number
}

export type CategoryOption = {
  _id: string
  name: string
  gender?: 'male' | 'female' | 'unisex'
  level?: number
  parent_id?: string | null
  isActive?: boolean
}

export type ProductOption = {
  _id: string
  name: string
  category?: {
    _id: string
    name: string
  } | null
}

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

  params.set('page', String(filters.page ?? 1))
  params.set('limit', String(filters.limit ?? 10))

  return params.toString()
}

export const listCoupons = (filters: CouponListFilters) =>
  requestAdmin<CouponListResponse>(`/admin/coupons?${buildCouponListQuery(filters)}`)

export const getCoupon = (id: string) =>
  requestAdmin<CouponDetailResponse>(`/admin/coupons/${id}`)

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

export const listCouponProducts = () =>
  requestAdmin<ProductListResponse>('/admin/products/list?limit=60')
    .then((response) => response.items)
