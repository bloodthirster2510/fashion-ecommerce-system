import { requestAdmin } from '../../services/adminHttp'
import type {
  LoyaltyPointAdjustmentResult,
  LoyaltyPointHistoryList,
  LoyaltyUserList,
  LoyaltyRule,
  LoyaltyRulePayload,
  MembershipRanking,
  MembershipRankingPayload,
} from './loyalty.types'

export const listMembershipRankings = () =>
  requestAdmin<MembershipRanking[]>('/admin/membership-rankings')

export const createMembershipRanking = (payload: MembershipRankingPayload) =>
  requestAdmin<MembershipRanking>('/admin/membership-rankings', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const updateMembershipRanking = (id: string, payload: MembershipRankingPayload) =>
  requestAdmin<MembershipRanking>(`/admin/membership-rankings/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })

export const updateMembershipRankingStatus = (id: string, isActive: boolean) =>
  requestAdmin<MembershipRanking>(`/admin/membership-rankings/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  })

export const deleteMembershipRanking = (id: string) =>
  requestAdmin<MembershipRanking>(`/admin/membership-rankings/${id}`, {
    method: 'DELETE',
  })

export const listLoyaltyUsers = (keyword: string, page = 1, limit = 10, tierId?: string) => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (keyword.trim()) {
    params.set('keyword', keyword.trim())
  }
  if (tierId) {
    params.set('tierId', tierId)
  }

  return requestAdmin<LoyaltyUserList>(`/admin/membership-rankings/users?${params.toString()}`)
}

export const listLoyaltyPointHistory = (userId: string, page = 1, limit = 10) => {
  const params = new URLSearchParams({ userId, page: String(page), limit: String(limit) })
  return requestAdmin<LoyaltyPointHistoryList>(
    `/admin/membership-rankings/point-history?${params.toString()}`,
  )
}

export const adjustLoyaltyPoints = (payload: { userId: string; delta: number; reason: string }) =>
  requestAdmin<LoyaltyPointAdjustmentResult>('/admin/membership-rankings/point-adjustments', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const listLoyaltyRules = () =>
  requestAdmin<LoyaltyRule[]>('/admin/membership-rankings/rules')

export const createLoyaltyRule = (payload: LoyaltyRulePayload) =>
  requestAdmin<LoyaltyRule>('/admin/membership-rankings/rules', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const updateLoyaltyRule = (id: string, payload: Partial<LoyaltyRulePayload>) =>
  requestAdmin<LoyaltyRule>(`/admin/membership-rankings/rules/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })

export const deleteLoyaltyRule = (id: string) =>
  requestAdmin<LoyaltyRule>(`/admin/membership-rankings/rules/${id}`, { method: 'DELETE' })
