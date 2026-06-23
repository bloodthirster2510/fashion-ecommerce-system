import { requestAdmin } from '../../services/adminHttp'
import type { ModerationRules, ReviewFilters, ReviewListResponse, ReviewStatus } from './review.types'

export const listAdminReviews = (filters: ReviewFilters) => {
  const params = new URLSearchParams({ page: String(filters.page), limit: '10' })
  // Chỉ append filter có giá trị để URL ngắn và backend nhận undefined cho bộ lọc chưa chọn.
  const entries: Array<[string, string]> = [
    ['keyword', filters.keyword.trim()],
    ['rating', filters.rating],
    ['status', filters.status],
    ['productId', filters.productId],
    ['period', filters.period],
    ['hasImages', filters.hasImages],
  ]
  entries.forEach(([key, value]) => { if (value) params.set(key, value) })
  return requestAdmin<ReviewListResponse>(`/admin/reviews?${params.toString()}`)
}

export const getModerationRules = () =>
  requestAdmin<ModerationRules>('/admin/reviews/moderation-rules')

export const setReviewStatus = (id: string, status: ReviewStatus) =>
  requestAdmin<{ reviewId: string; status: ReviewStatus }>(`/admin/reviews/${id}/status`, {
    method: 'PATCH', body: JSON.stringify({ status }),
  })

export const setManyReviewStatuses = (reviewIds: string[], status: Extract<ReviewStatus, 'visible' | 'hidden'>) =>
  // Bulk endpoint chỉ cho visible/hidden; pending được tạo bởi hệ thống moderation tự động.
  requestAdmin<{ updatedCount: number; status: ReviewStatus }>('/admin/reviews/bulk-status', {
    method: 'PATCH', body: JSON.stringify({ reviewIds, status }),
  })

export const replyToReview = (id: string, reply: string) =>
  requestAdmin<{ reviewId: string; adminReply: string; repliedAt: string }>(`/admin/reviews/${id}/reply`, {
    method: 'POST', body: JSON.stringify({ reply }),
  })
