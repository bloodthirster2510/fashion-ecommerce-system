import { requestAdmin } from '../../services/adminHttp'
import type { MembershipRanking, MembershipRankingPayload } from './loyalty.types'

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
