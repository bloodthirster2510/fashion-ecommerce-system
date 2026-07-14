export type DashboardCapabilityKey =
  | 'reports'
  | 'orders'
  | 'inventory'
  | 'customers'
  | 'promotions'
  | 'support'

export type DashboardBusinessSummary = {
  totalOrders: number
  paidOrders: number
  paidRevenue: number
  itemsSold: number
  cancelledOrders: number
  returnedOrders: number
  averageOrderValue: number
  cancellationRate: number
  returnRate: number
  customers: number
  newCustomers: number
  returningCustomers: number
  returningCustomerRate: number
}

export type DashboardTopProduct = {
  productId: string
  sku: string
  name: string
  image: string | null
  units: number
  grossSales: number
  orders: number
}

export type DashboardInventoryRisk = {
  inventoryId: string
  productId: string
  name: string
  image: string | null
  sku: string
  size: string
  availableQuantity: number
  reservedQuantity: number
  unitsSold28d: number
  daysRemaining: number | null
}

export type AdminDashboardOverview = {
  generatedAt: string
  range: {
    days: number
    from: string
    to: string
    previousFrom: string
    previousTo: string
  }
  capabilities: Record<DashboardCapabilityKey, boolean>
  business: null | {
    summary: DashboardBusinessSummary
    comparison: {
      paidRevenuePercent: number | null
      paidOrdersPercent: number | null
      averageOrderValuePercent: number | null
      returningCustomerRatePoints: number
      cancellationRatePoints: number
    }
    trend: Array<{
      date: string
      paidRevenue: number
      paidOrders: number
    }>
    topProducts: DashboardTopProduct[]
  }
  orderHealth: Array<{ status: string; count: number }>
  inventory: null | {
    totalSkus: number
    lowStockSkus: number
    outOfStockSkus: number
    reservedUnits: number
    atRisk: DashboardInventoryRisk[]
  }
}

