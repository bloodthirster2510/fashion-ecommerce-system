export type ProductReview = {
  _id: string
  productId: string
  orderId: string
  rating: number
  comment: string
  moderationStatus: 'pending' | 'visible' | 'hidden'
  moderationReasons: string[]
  isContentRemoved?: boolean
  verifiedPurchase: boolean
  purchasedVariant: {
    variantId: string
    colorVariantId: string
    fitType: string
    color: string
    size: string
    sku: string
  } | null
  user: {
    _id: string
    name: string | null
    avatarImage: string | null
  }
  createdAt: string
  updatedAt: string
}

export type ReviewDistribution = {
  rating: number
  count: number
  percent: number
}

export type ProductReviewResponse = {
  items: ProductReview[]
  summary: {
    averageRating: number
    reviewCount: number
    distribution: ReviewDistribution[]
  }
  pagination: {
    page: number
    limit: number
    totalItems: number
    totalPages: number
  }
}

export type ReviewEligibility = {
  productId: string
  canReview: boolean
  hasPurchased: boolean
  hasReviewed: boolean
  reviewId: string | null
  reviewStatus: 'pending' | 'visible' | 'hidden' | null
  moderationReasons: string[]
}

export type ReviewListQuery = {
  page?: number
  limit?: number
  rating?: number
  sort?: 'newest' | 'oldest' | 'rating_desc' | 'rating_asc'
}

export type CreateReviewPayload = {
  productId: string
  rating: number
  comment: string
}
