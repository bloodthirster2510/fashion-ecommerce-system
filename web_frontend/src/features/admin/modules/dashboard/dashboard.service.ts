import { requestAdmin } from '../../services/adminHttp'
import { formatAdminDateInput } from '../../utils/dateTime'
import { getAdminSession } from '../auth/adminSession'
import type { AdminDashboardOverview } from './dashboard.types'

const MAX_DASHBOARD_DAYS = 180
const dashboardCapabilityKeys = [
  'reports',
  'orders',
  'inventory',
  'customers',
  'promotions',
  'support',
] as const
const runtimeEnv = (import.meta as ImportMeta & { readonly env?: ImportMetaEnv }).env

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

export const normalizeDashboardDays = (days: number) => {
  if (!Number.isInteger(days) || days < 1 || days > MAX_DASHBOARD_DAYS) {
    throw new Error(`Khoảng thời gian dashboard phải từ 1 đến ${MAX_DASHBOARD_DAYS} ngày`)
  }
  return days
}

export const parseAdminDashboardOverview = (value: unknown): AdminDashboardOverview => {
  if (!isRecord(value) || !isRecord(value.range) || !isRecord(value.capabilities)) {
    throw new Error('Dữ liệu dashboard không hợp lệ')
  }

  const overviewCapabilities = value.capabilities
  const hasCapabilities = dashboardCapabilityKeys.every(
    (key) => typeof overviewCapabilities[key] === 'boolean',
  )
  const hasRange = (
    Number.isInteger(value.range.days) &&
    typeof value.range.from === 'string' &&
    typeof value.range.to === 'string' &&
    typeof value.range.previousFrom === 'string' &&
    typeof value.range.previousTo === 'string'
  )
  const hasBusiness = value.business === null || (
    isRecord(value.business) &&
    isRecord(value.business.summary) &&
    isRecord(value.business.comparison) &&
    Array.isArray(value.business.trend) &&
    Array.isArray(value.business.topProducts)
  )
  const hasInventory = value.inventory === null || (
    isRecord(value.inventory) && Array.isArray(value.inventory.atRisk)
  )

  if (
    typeof value.generatedAt !== 'string' ||
    !hasCapabilities ||
    !hasRange ||
    !hasBusiness ||
    !hasInventory ||
    !Array.isArray(value.orderHealth)
  ) {
    throw new Error('Dữ liệu dashboard không hợp lệ')
  }

  return value as AdminDashboardOverview
}

const getDemoDashboard = (days: number): AdminDashboardOverview => {
  const to = new Date()
  const from = new Date(to)
  from.setDate(from.getDate() - days + 1)

  const previousTo = new Date(from)
  previousTo.setDate(previousTo.getDate() - 1)
  const previousFrom = new Date(previousTo)
  previousFrom.setDate(previousFrom.getDate() - days + 1)

  const trend = Array.from({ length: days }, (_, index) => {
    const date = new Date(from)
    date.setDate(date.getDate() + index)
    const weekdayFactor = [0.72, 0.8, 0.9, 1.08, 1.18, 1.32, 1.1][date.getDay()]
    const growthFactor = 0.9 + index / Math.max(days * 6, 1)
    const paidOrders = Math.max(1, Math.round(8 * weekdayFactor * growthFactor))

    return {
      date: formatAdminDateInput(date),
      paidOrders,
      paidRevenue: paidOrders * 547_000,
    }
  })

  return {
    generatedAt: to.toISOString(),
    range: {
      days,
      from: from.toISOString(),
      to: to.toISOString(),
      previousFrom: previousFrom.toISOString(),
      previousTo: previousTo.toISOString(),
    },
    capabilities: {
      reports: true,
      orders: true,
      inventory: true,
      customers: true,
      promotions: true,
      support: true,
    },
    business: {
      summary: {
        totalOrders: 284,
        paidOrders: 241,
        paidRevenue: 132_480_000,
        itemsSold: 367,
        cancelledOrders: 12,
        returnedOrders: 5,
        averageOrderValue: 549_710,
        cancellationRate: 0.042,
        returnRate: 0.018,
        customers: 218,
        newCustomers: 139,
        returningCustomers: 79,
        returningCustomerRate: 0.362,
      },
      comparison: {
        paidRevenuePercent: 12.8,
        paidOrdersPercent: 8.4,
        averageOrderValuePercent: 4.1,
        returningCustomerRatePoints: 3.6,
        cancellationRatePoints: -0.9,
      },
      trend,
      topProducts: [
        { productId: 'demo-1', sku: 'CD-TS-014', name: 'Áo thun cotton form rộng', image: null, units: 84, grossSales: 31_920_000, orders: 76 },
        { productId: 'demo-2', sku: 'CD-JE-008', name: 'Quần jeans ống đứng', image: null, units: 61, grossSales: 28_670_000, orders: 57 },
        { productId: 'demo-3', sku: 'CD-SH-021', name: 'Sơ mi linen tối giản', image: null, units: 49, grossSales: 23_030_000, orders: 45 },
        { productId: 'demo-4', sku: 'CD-DR-006', name: 'Đầm midi cổ vuông', image: null, units: 38, grossSales: 20_140_000, orders: 36 },
        { productId: 'demo-5', sku: 'CD-JK-003', name: 'Áo khoác denim wash', image: null, units: 27, grossSales: 17_010_000, orders: 25 },
      ],
    },
    orderHealth: [
      { status: 'pending', count: 18 },
      { status: 'confirmed', count: 23 },
      { status: 'packed', count: 16 },
      { status: 'shipping', count: 31 },
      { status: 'delivered', count: 187 },
      { status: 'cancelled', count: 12 },
      { status: 'returned', count: 5 },
    ],
    inventory: {
      totalSkus: 428,
      lowStockSkus: 14,
      outOfStockSkus: 6,
      reservedUnits: 37,
      atRisk: [
        { inventoryId: 'demo-i1', productId: 'demo-2', name: 'Quần jeans ống đứng', image: null, sku: 'CD-JE-008-BL-29', size: '29', availableQuantity: 2, reservedQuantity: 3, unitsSold28d: 22, daysRemaining: 3 },
        { inventoryId: 'demo-i2', productId: 'demo-1', name: 'Áo thun cotton form rộng', image: null, sku: 'CD-TS-014-WH-M', size: 'M', availableQuantity: 3, reservedQuantity: 2, unitsSold28d: 26, daysRemaining: 3 },
        { inventoryId: 'demo-i3', productId: 'demo-4', name: 'Đầm midi cổ vuông', image: null, sku: 'CD-DR-006-BK-S', size: 'S', availableQuantity: 1, reservedQuantity: 1, unitsSold28d: 11, daysRemaining: 3 },
      ],
    },
  }
}

export const getAdminDashboardOverview = (days = 30) => {
  const normalizedDays = normalizeDashboardDays(days)
  if (runtimeEnv?.DEV && getAdminSession()?.accessToken === 'demo-admin-access-token') {
    return Promise.resolve(parseAdminDashboardOverview(getDemoDashboard(normalizedDays)))
  }

  return requestAdmin<AdminDashboardOverview>(`/admin/dashboard/overview?days=${normalizedDays}`)
    .then(parseAdminDashboardOverview)
}
