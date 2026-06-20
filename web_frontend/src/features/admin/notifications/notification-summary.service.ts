import { requestAdmin } from '../services/adminHttp'
import { getAdminSession } from '../modules/auth/adminSession'
import type { NotificationSummary } from './notification-summary.types'

const getDemoSummary = (): NotificationSummary => ({
  total: 14,
  orders: { confirmed: 3, packed: 2, returnRequested: 1, online: 2, cod: 4, total: 6 },
  lowStockVariants: 4,
  expiringCoupons: 2,
  inactiveAccounts: 2,
  supportOpen: 0,
  reviewsPending: 0,
  capabilities: {
    orders: true,
    inventory: true,
    promotions: true,
    accounts: true,
    support: false,
    reviews: false,
    loyaltyApprovals: false,
    reports: false,
  },
  generatedAt: new Date().toISOString(),
})

export const getNotificationSummary = () => {
  if (import.meta.env.DEV && getAdminSession()?.accessToken === 'demo-admin-access-token') {
    return Promise.resolve(getDemoSummary())
  }

  return requestAdmin<NotificationSummary>('/admin/notifications/summary')
}
