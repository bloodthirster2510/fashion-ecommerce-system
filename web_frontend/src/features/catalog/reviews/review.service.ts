import { axiosClient } from '../../../services/axiosClient'
import { requestCustomer } from '../../../services/customerHttp'
import type { ApiResponse } from '../../../types/api.type'
import type {
  CreateReviewPayload,
  EligibleReviewItemsResponse,
  MyReviewsResponse,
  ProductReview,
  ProductReviewResponse,
  ReviewListQuery,
} from './review.types'

class ReviewApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ReviewApiError'
  }
}

const requestPublic = async <T>(path: string) => {
  const response = await axiosClient.fetch(path)
  const body = (await response.json().catch(() => ({}))) as ApiResponse<T>

  // Public endpoint không cần token, nhưng vẫn chuẩn hóa lỗi theo message từ backend.
  if (!response.ok || body.data === undefined) {
    throw new ReviewApiError(body.message || 'Không thể tải đánh giá sản phẩm.')
  }

  return body.data
}

const buildQuery = (query: ReviewListQuery) => {
  const params = new URLSearchParams()
  if (query.page) params.set('page', String(query.page))
  if (query.limit) params.set('limit', String(query.limit))
  if (query.rating) params.set('rating', String(query.rating))
  if (query.sort) params.set('sort', query.sort)
  return params.toString()
}

export const reviewService = {
  listProductReviews(productId: string, query: ReviewListQuery = {}) {
    const queryString = buildQuery(query)
    return requestPublic<ProductReviewResponse>(
      `/reviews/products/${encodeURIComponent(productId)}${queryString ? `?${queryString}` : ''}`,
    )
  },

  listEligibleItems(productId?: string) {
    const params = new URLSearchParams({ status: 'all', page: '1', limit: '100' })
    if (productId) params.set('productId', productId)
    return requestCustomer<EligibleReviewItemsResponse>(`/reviews/eligible-items?${params.toString()}`)
  },

  createReview(input: CreateReviewPayload, images: File[] = []) {
    const data = new FormData()
    data.set('orderId', input.orderId)
    data.set('orderItemId', input.orderItemId)
    data.set('rating', String(input.rating))
    data.set('comment', input.comment)
    if (input.criteria) data.set('criteria', JSON.stringify(input.criteria))
    images.slice(0, 5).forEach((file) => data.append('images', file))
    return requestCustomer<ProductReview>('/reviews', {
      method: 'POST',
      body: data,
    })
  },

  toggleHelpful(reviewId: string) {
    return requestCustomer<{ reviewId: string; helpfulCount: number; hasVotedHelpful: boolean }>(
      `/reviews/${encodeURIComponent(reviewId)}/helpful`,
      { method: 'POST' },
    )
  },

  listMyReviews() {
    return requestCustomer<MyReviewsResponse>('/reviews/me?page=1&limit=100&sort=newest')
  },

  deleteReview(reviewId: string) {
    return requestCustomer<{ reviewId: string; deleted: true }>(`/reviews/${encodeURIComponent(reviewId)}`, {
      method: 'DELETE',
    })
  },

  updateReview(reviewId: string, input: {
    rating?: number
    comment?: string
    criteria?: { productQuality?: number; descriptionMatch?: number; sizeFit?: 'small' | 'true_to_size' | 'large' }
    keepImageIds?: string[]
    images?: File[]
  }) {
    const data = new FormData()
    if (input.rating !== undefined) data.set('rating', String(input.rating))
    if (input.comment !== undefined) data.set('comment', input.comment)
    if (input.criteria) data.set('criteria', JSON.stringify(input.criteria))
    if (input.keepImageIds !== undefined) data.set('keepImageIds', JSON.stringify(input.keepImageIds))
    input.images?.slice(0, 5).forEach((file) => data.append('images', file))
    return requestCustomer<ProductReview>(`/reviews/${encodeURIComponent(reviewId)}`, {
      method: 'PATCH',
      body: data,
    })
  },
}
