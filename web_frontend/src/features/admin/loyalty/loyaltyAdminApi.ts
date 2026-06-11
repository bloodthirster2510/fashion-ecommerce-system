import { requestAdmin } from '../services/adminHttp'

export type MembershipRanking = {
  _id?: string
  name: string
  level: number
  minPoint: number
  maxPoint: number | null
  discountPercent: number
  benefitDescription?: string
  cardColor?: string
  textColor?: string
  badgeColor?: string
  iconName?: string
  isActive?: boolean
}

export type MembershipRankingPayload = {
  name: string
  level: number
  minPoint: number
  maxPoint: number | null
  discountPercent: number
  benefitDescription: string
  cardColor: string
  textColor: string
  badgeColor: string
  iconName: string
  isActive: boolean
}

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
