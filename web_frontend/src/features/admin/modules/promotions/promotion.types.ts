export type CouponDiscountType = 'percent' | 'fixed' | 'free_shipping'
export type CouponEligibleUserType = 'all' | 'new_user' | 'member'

export type CouponActor = {
  _id: string
  name?: string
  email?: string
  role?: 'admin' | 'staff' | 'user'
}

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
  createdBy?: string | CouponActor | null
  updatedBy?: string | CouponActor | null
  createdAt?: string
  updatedAt?: string
}

export type CouponCodeAvailability = {
  code: string
  available: boolean
}

export type CouponPreview = {
  eligible: boolean
  reason: string | null
  summary: {
    subTotal: number
    shippingFee: number
    discountAmount: number
    shippingDiscountAmount: number
    totalAmount: number
  }
}

export type PromotionCampaign = {
  _id: string
  code: string
  name: string
  description?: string | null
  couponIds: Array<string | Pick<AdminCoupon, '_id' | 'code' | 'name' | 'isActive' | 'startAt' | 'endAt'>>
  allowCouponStacking: boolean
  maxCouponsPerOrder: number
  startAt: string
  endAt: string
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export type PromotionCampaignPayload = {
  code: string
  name: string
  description?: string | null
  couponIds: string[]
  allowCouponStacking: boolean
  maxCouponsPerOrder: number
  startAt: string
  endAt: string
  isActive: boolean
}

export type PromotionAnalytics = {
  range: { from: string; to: string }
  comparison: {
    range: { from: string; to: string }
    orderCountPercent: number | null
    netRevenuePercent: number | null
    couponUsagePercent: number | null
    totalDiscountPercent: number | null
  }
  orders: {
    orderCount: number
    grossMerchandiseValue: number
    netRevenue: number
    couponDiscount: number
    membershipDiscount: number
  }
  coupons: {
    usageCount: number
    productDiscount: number
    shippingDiscount: number
    totalDiscount: number
    topCoupons: Array<{ code: string; usageCount: number; totalDiscount: number }>
  }
  loyalty: Array<{ type: 'earn' | 'redeem' | 'adjust'; transactionCount: number; points: number }>
  campaigns: Array<{
    campaignId: string
    code?: string
    name?: string
    orderCount: number
    netRevenue: number
    discountAmount: number
  }>
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
  discountType?: 'all' | CouponDiscountType
  visibility?: 'all' | 'public' | 'private'
  eligibleUserType?: 'all_filter' | CouponEligibleUserType
  eligibleMembershipRank?: string
  dateFrom?: string
  dateTo?: string
  keyword?: string
  sort?: 'created_desc' | 'created_asc' | 'end_asc' | 'usage_desc' | 'code_asc'
  page?: number
  limit?: number
}

export type CouponListResponse = {
  items: AdminCoupon[]
  summary: { totalCoupons: number; usedCount: number; activeCount: number; publicCount: number }
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

export type CouponUsageItem = {
  _id: string
  userId: string | {
    _id: string
    name?: string
    email?: string
    phone?: string
  }
  orderId: string | {
    _id: string
    orderCode?: string
    status?: string
    totalAmount?: number
  }
  discountAmount: number
  shippingDiscountAmount: number
  usedAt: string
}

export type CouponUsageListResponse = {
  items: CouponUsageItem[]
  summary: { usageCount: number; discountAmount: number; shippingDiscountAmount: number }
  pagination: {
    page: number
    limit: number
    totalItems: number
    totalPages: number
  }
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
