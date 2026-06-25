import { requestAdmin } from '../../services/adminHttp'
import type { AdminReviewDetail, ModerationRules, ReviewFilters, ReviewListResponse, ReviewStatus } from './review.types'

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

export const getAdminReviewDetail = (id: string) =>
  requestAdmin<AdminReviewDetail>(`/admin/reviews/${id}`)

export const setReviewStatus = (id: string, status: ReviewStatus, reason?: string) =>
  requestAdmin<{ reviewId: string; status: ReviewStatus }>(`/admin/reviews/${id}/status`, {
    method: 'PATCH', body: JSON.stringify({ status, ...(reason ? { reason } : {}) }),
  })

export const setManyReviewStatuses = (reviewIds: string[], status: Extract<ReviewStatus, 'visible' | 'hidden'>, reason?: string) =>
  // Bulk endpoint chỉ cho visible/hidden; pending được tạo bởi hệ thống moderation tự động.
  requestAdmin<{ updatedCount: number; status: ReviewStatus }>('/admin/reviews/bulk-status', {
    method: 'PATCH', body: JSON.stringify({ reviewIds, status, ...(reason ? { reason } : {}) }),
  })

export const replyToReview = (id: string, reply: string) =>
  requestAdmin<{ reviewId: string; adminReply: string; repliedAt: string }>(`/admin/reviews/${id}/reply`, {
    method: 'PUT', body: JSON.stringify({ content: reply }),
  })

export const deleteReviewReply = (id: string) =>
  requestAdmin<{ reviewId: string; deleted: true }>(`/admin/reviews/${id}/reply`, {
    method: 'DELETE',
  })
