export type ReviewStatus = 'pending' | 'visible' | 'hidden'

export type AdminReview = {
  _id: string
  product: { _id: string; name: string; image?: string } | null
  user: { _id: string; name?: string; email?: string; avatarImage?: string | null } | null
  order: { _id: string; orderCode?: string } | null
  rating: number
  comment: string
  images: string[]
  status: ReviewStatus
  moderationReasons: string[]
  adminReply?: string | null
  repliedAt?: string | null
  createdAt: string
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
