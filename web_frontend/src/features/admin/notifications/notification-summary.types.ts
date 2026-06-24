export type NotificationSummary = {
  total: number
  orders: {
    confirmed: number
    packed: number
    returnRequested: number
    online: number
    cod: number
    total: number
  }
  lowStockVariants: number
  expiringCoupons: number
  paymentDeadlineSoon: number
  inactiveAccounts: number
  supportOpen: number
  reviewsPending: number
  capabilities: {
    orders: boolean
    inventory: boolean
    promotions: boolean
    accounts: boolean
    support: boolean
    reviews: boolean
    loyaltyApprovals: boolean
    reports: boolean
  }
  generatedAt: string
}
