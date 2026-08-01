import { expect, test } from '@playwright/test'
import type { NotificationSummary } from '../../notifications/notification-summary.types'
import { buildDashboardAttentionItems } from './dashboard.presentation'
import {
  normalizeDashboardDays,
  parseAdminDashboardOverview,
} from './dashboard.service'

const capabilities = {
  reports: true,
  orders: true,
  inventory: true,
  customers: true,
  promotions: true,
  support: true,
}

const minimalOverview = {
  generatedAt: '2026-08-02T10:00:00.000Z',
  range: {
    days: 30,
    from: '2026-07-04T00:00:00.000Z',
    to: '2026-08-02T10:00:00.000Z',
    previousFrom: '2026-06-04T00:00:00.000Z',
    previousTo: '2026-07-04T00:00:00.000Z',
  },
  capabilities,
  business: null,
  orderHealth: [],
  inventory: null,
}

const notificationSummary = (overrides: Partial<NotificationSummary> = {}): NotificationSummary => ({
  total: 8,
  orders: {
    confirmed: 1,
    packed: 1,
    returnRequested: 1,
    online: 2,
    cod: 1,
    total: 3,
  },
  lowStockVariants: 1,
  expiringCoupons: 1,
  paymentDeadlineSoon: 1,
  supportOpen: 1,
  reviewsPending: 1,
  capabilities: {
    orders: true,
    inventory: true,
    promotions: true,
    support: true,
    reviews: true,
  },
  generatedAt: '2026-08-02T10:00:00.000Z',
  ...overrides,
})

test.describe('admin dashboard contract', () => {
  test('accepts a permission-scoped overview with no business section', () => {
    expect(parseAdminDashboardOverview(minimalOverview)).toEqual(minimalOverview)
  })

  test('rejects malformed payloads before the page renders them', () => {
    expect(() => parseAdminDashboardOverview({ ...minimalOverview, capabilities: undefined }))
      .toThrow('Dữ liệu dashboard không hợp lệ')
    expect(() => parseAdminDashboardOverview({ ...minimalOverview, orderHealth: undefined }))
      .toThrow('Dữ liệu dashboard không hợp lệ')
    expect(() => parseAdminDashboardOverview({
      ...minimalOverview,
      business: { summary: {}, comparison: {}, trend: null, topProducts: [] },
    })).toThrow('Dữ liệu dashboard không hợp lệ')
  })

  test('validates dashboard duration before issuing a request', () => {
    expect(normalizeDashboardDays(7)).toBe(7)
    expect(() => normalizeDashboardDays(0)).toThrow()
    expect(() => normalizeDashboardDays(181)).toThrow()
    expect(() => normalizeDashboardDays(7.5)).toThrow()
  })

  test('hides attention data outside capabilities and keeps priority links bounded', () => {
    const restricted = notificationSummary({
      capabilities: {
        orders: false,
        inventory: false,
        promotions: false,
        support: true,
        reviews: true,
      },
    })
    expect(buildDashboardAttentionItems(restricted).map((item) => item.key))
      .toEqual(['support', 'reviews'])

    const allItems = buildDashboardAttentionItems(notificationSummary())
    expect(allItems).toHaveLength(6)
    expect(allItems.slice(0, 4).map((item) => item.href)).toEqual([
      '/admin/orders?queue=payment-deadline',
      '/admin/orders?queue=packing',
      '/admin/orders?queue=handoff',
      '/admin/orders?queue=review',
    ])
  })
})
