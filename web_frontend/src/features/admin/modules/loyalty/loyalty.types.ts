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
