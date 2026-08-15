export type ProductReview = {
  _id: string
  productId: string
  orderId: string
  orderItemId: string
  rating: number
  comment: string
  moderationStatus?: 'pending' | 'visible' | 'hidden'
  moderationReasons?: string[]
  isContentRemoved?: boolean
  images: ReviewImage[]
  helpfulCount: number
  hasVotedHelpful: boolean
  criteria?: {
    productQuality?: number
    descriptionMatch?: number
    sizeFit?: 'small' | 'true_to_size' | 'large'
  } | null
  adminReply: { content: string; repliedAt: string | null } | null
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
  canEdit?: boolean
  canDelete?: boolean
  mutationDeadline?: string
  createdAt: string
  updatedAt: string
}

export type ReviewImage = {
  _id: string | null
  url: string
  thumbnailUrl: string
  width: number | null
  height: number | null
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
  orderId: string
  orderItemId: string
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
  sort?: 'newest' | 'oldest' | 'rating_desc' | 'rating_asc' | 'helpful'
}

export type CreateReviewPayload = {
  orderId: string
  orderItemId: string
  rating: number
  comment: string
  criteria?: {
    productQuality?: number
    descriptionMatch?: number
    sizeFit?: 'small' | 'true_to_size' | 'large'
  }
}

export type EligibleReviewItem = {
  orderId: string
  orderCode: string
  deliveredAt: string | null
  orderItemId: string
  product: { _id: string; name: string; image: string }
  variant: {
    variantId: string
    colorVariantId: string
    fitType: string
    color: string
    size: string
    sku: string
  }
  canReview: boolean
  reason: 'PRODUCT_UNAVAILABLE' | 'ALREADY_REVIEWED' | null
  review: {
    _id: string
    rating: number
    comment: string
    status: 'pending' | 'visible' | 'hidden'
    moderationReasons: string[]
    createdAt: string
  } | null
}

export type EligibleReviewItemsResponse = {
  items: EligibleReviewItem[]
  pagination: { page: number; limit: number; totalItems: number; totalPages: number }
}

export type MyReview = ProductReview & {
  product: { _id: string; name: string; image: string }
}

export type MyReviewsResponse = {
  items: MyReview[]
  pagination: { page: number; limit: number; totalItems: number; totalPages: number }
}
