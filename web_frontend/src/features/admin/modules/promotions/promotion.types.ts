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
