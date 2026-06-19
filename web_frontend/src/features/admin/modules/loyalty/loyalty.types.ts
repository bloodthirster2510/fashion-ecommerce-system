export type MembershipRanking = {
  _id?: string
  name: string
  level: number
  minPoint: number
  maxPoint?: number | null
  discountPercent: number
  benefitDescription?: string
  cardColor?: string
  textColor?: string
  badgeColor?: string
  iconName?: string
  isActive?: boolean
  memberCount?: number
}

export type MembershipRankingPayload = {
  name: string
  level: number
  minPoint: number
  maxPoint?: number | null
  discountPercent: number
  benefitDescription: string
  cardColor: string
  textColor: string
  badgeColor: string
  iconName: string
  isActive: boolean
}

export type LoyaltyUser = {
  _id: string
  name: string
  email: string
  phone?: string
  loyaltyPoint: number
  isActive?: boolean
}

export type LoyaltyHistoryPerson = {
  _id: string
  name: string
  email: string
}

export type LoyaltyPointHistory = {
  _id: string
  userId: LoyaltyHistoryPerson | string
  orderId?: string | null
  type: 'earn' | 'redeem' | 'adjust'
  delta: number
  balanceAfter: number
  reason: string
  actorId?: LoyaltyHistoryPerson | string | null
  actorRole: 'user' | 'admin' | 'staff' | 'system'
  createdAt: string
}

export type LoyaltyPagination = {
  page: number
  limit: number
  totalItems: number
  totalPages: number
}

export type LoyaltyUserList = {
  items: LoyaltyUser[]
  pagination: LoyaltyPagination
}

export type LoyaltyPointHistoryList = {
  items: LoyaltyPointHistory[]
  pagination: LoyaltyPagination
}

export type LoyaltyPointAdjustmentResult = {
  user: LoyaltyUser
  history: LoyaltyPointHistory
  balanceBefore: number
  balanceAfter: number
}

export type LoyaltyRuleRoundMode = 'floor' | 'round' | 'ceil'

export type LoyaltyRule = {
  _id: string
  name: string
  spendAmount: number
  pointsEarned: number
  minOrderAmount: number
  roundMode: LoyaltyRuleRoundMode
  startAt?: string | null
  endAt?: string | null
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export type LoyaltyRulePayload = {
  name: string
  spendAmount: number
  pointsEarned: number
  minOrderAmount: number
  roundMode: LoyaltyRuleRoundMode
  startAt?: string | null
  endAt?: string | null
  isActive: boolean
}
