export type RecommendationContext = 'home' | 'product_detail_similar' | 'cart'

export type RecommendationMetricSnapshot = {
  requests: number
  recommendations: number
  fallbackRequests: number
  impressions: number
  clicks: number
  addToCarts: number
  ordersCreated: number
  paymentsCompleted: number
  ordersCancelled: number
  ordersReturned: number
  reversedPayments: number
  netPayments: number
  grossAttributedRevenue: number
  reversedAttributedRevenue: number
  netAttributedRevenue: number
  ctr: number
  clickToCartRate: number
  cartToOrderRate: number
  orderToPaymentRate: number
  paymentRate: number
  netPaymentRate: number
  fallbackRate: number
}

export type RecommendationSegment = {
  algorithmVersion: string
  context: RecommendationContext
  metrics: RecommendationMetricSnapshot
  avgClickRank: number | null
  avgClickScore: number | null
}

export type RecommendationTrendPoint = RecommendationMetricSnapshot & {
  date: string
}

export type RecommendationCoverageItem = {
  id: string
  name: string
  recommendedCount: number
  requestCount: number
}

export type RecommendationCoverageGroup = {
  uniqueRecommended: number
  totalActive: number
  coverageRate: number
  top: RecommendationCoverageItem[]
}

export type RecommendationSearchKeyword = {
  keyword: string
  count: number
  averageResultCount: number
  lastSearchedAt: string
}

export type RecommendationSearchTrendPoint = {
  date: string
  searches: number
  zeroResultSearches: number
  zeroResultRate: number
}

export type RecommendationTopProduct = {
  productId: string
  name: string
  image: string | null
  context: RecommendationContext[]
  clicks: number
  addToCarts: number
  ordersCreated: number
  paymentsCompleted: number
  netPayments: number
  netAttributedRevenue: number
}

export type RecommendationRecentRequest = {
  requestId: string
  context: RecommendationContext
  algorithmVersion: string
  fallbackUsed: boolean
  itemCount: number
  createdAt: string
  impressions: number
  clicks: number
  addToCarts: number
  ordersCreated: number
  paymentsCompleted: number
  ordersCancelled: number
  ordersReturned: number
  reversedPayments: number
  netPayments: number
  grossAttributedRevenue: number
  reversedAttributedRevenue: number
  netAttributedRevenue: number
  ctr: number
}

export type RecommendationAnalytics = {
  generatedAt: string
  range: {
    from: string
    to: string
    previousFrom: string
    previousTo: string
  }
  filters: {
    context?: RecommendationContext
    algorithmVersion?: string
  }
  summary: RecommendationMetricSnapshot
  comparison: {
    requestsPercent: number | null
    impressionsPercent: number | null
    clicksPercent: number | null
    addToCartsPercent: number | null
    ordersCreatedPercent: number | null
    paymentsCompletedPercent: number | null
    netAttributedRevenuePercent: number | null
    ctrPercent: number | null
    fallbackRatePercent: number | null
  }
  segments: RecommendationSegment[]
  trend: RecommendationTrendPoint[]
  coverage: {
    categories: RecommendationCoverageGroup
    brands: RecommendationCoverageGroup
  }
  diversity: {
    requestsSampled: number
    averageCategoryDiversityAt10: number
    averageBrandDiversityAt10: number
  }
  search: {
    totalSearches: number
    keywordSearches: number
    imageSearches: number
    searchResultClicks: number
    searchClickRate: number
    zeroResultRate: number
    averageResultCount: number
    topKeywords: RecommendationSearchKeyword[]
    zeroResultKeywords: RecommendationSearchKeyword[]
    trend: RecommendationSearchTrendPoint[]
  }
  topProducts: RecommendationTopProduct[]
  recentRequests: RecommendationRecentRequest[]
}
