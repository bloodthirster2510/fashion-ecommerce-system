export type ReviewStatus = 'pending' | 'visible' | 'hidden'

export type AdminReview = {
  _id: string
  product: { _id: string; name: string; image?: string } | null
  user: { _id: string; name?: string; email?: string; avatarImage?: string | null } | null
  order: { _id: string; orderCode?: string } | null
  rating: number
  comment: string
  images: Array<{
    _id: string | null
    url: string
    thumbnailUrl: string
    width: number | null
    height: number | null
  }>
  status: ReviewStatus
  moderationReasons: string[]
  adminReply?: string | null
  repliedAt?: string | null
  createdAt: string
}

export type AdminReviewDetail = AdminReview & {
  criteria?: { productQuality?: number; descriptionMatch?: number; sizeFit?: string } | null
  moderationHistory: Array<{
    action: string
    fromStatus: ReviewStatus
    toStatus: ReviewStatus
    reason?: string | null
    actorRole: 'system' | 'admin' | 'staff'
    createdAt: string
  }>
  order: (NonNullable<AdminReview['order']> & {
    item?: { color?: string; size?: string; fitType?: string; sku?: string } | null
  }) | null
  updatedAt: string
}

export type ReviewListResponse = {
  items: AdminReview[]
  summary: { total: number; high: number; low: number; pending: number }
  products: Array<{ _id: string; name: string }>
  pagination: { page: number; limit: number; totalItems: number; totalPages: number }
}

export type ModerationRules = {
  offensiveWords: readonly string[]
  holdLinks: boolean
  holdRepeatedSpam: boolean
}

export type ReviewFilters = {
  keyword: string
  rating: string
  status: string
  productId: string
  period: string
  hasImages: string
  page: number
}
