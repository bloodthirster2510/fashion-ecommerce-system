import { requestAdmin } from '../services/adminHttp'
import { getAdminSession } from '../modules/auth/adminSession'
import type { NotificationSummary } from './notification-summary.types'

const getDemoSummary = (): NotificationSummary => {
  const orders = { confirmed: 3, packed: 2, returnRequested: 1, online: 2, cod: 4, total: 6 }
  const lowStockVariants = 4
  const expiringCoupons = 2
  const paymentDeadlineSoon = 1
  const supportOpen = 0
  const reviewsPending = 1

  return {
    total: orders.total
      + lowStockVariants
      + expiringCoupons
      + paymentDeadlineSoon
      + supportOpen
      + reviewsPending,
    orders,
    lowStockVariants,
    expiringCoupons,
    paymentDeadlineSoon,
    supportOpen,
    reviewsPending,
    capabilities: {
      orders: true,
      inventory: true,
      promotions: true,
      support: true,
      reviews: true,
    },
    generatedAt: new Date().toISOString(),
  }
}

export const getNotificationSummary = () => {
  if (import.meta.env.DEV && getAdminSession()?.accessToken === 'demo-admin-access-token') {
    return Promise.resolve(getDemoSummary())
  }

  return requestAdmin<NotificationSummary>('/admin/notifications/summary')
}
