import { axiosClient } from '../../../services/axiosClient'
import { requestCustomer } from '../../../services/customerHttp'
import type { ApiResponse } from '../../../types/api.type'
import type {
  CreateReviewPayload,
  ProductReview,
  ProductReviewResponse,
  ReviewEligibility,
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

  getEligibility(productId: string) {
    return requestCustomer<ReviewEligibility>(`/reviews/eligibility/${encodeURIComponent(productId)}`)
  },

  createReview(input: CreateReviewPayload) {
    return requestCustomer<ProductReview>('/reviews', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },
}
