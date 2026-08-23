import { requestAdmin } from '../../services/adminHttp'
import type {
  RecommendationAnalytics,
  RecommendationContext,
  RecommendationSegment,
} from './recommendationAnalytics.types'

export type RecommendationAnalyticsFilters = {
  from?: string
  to?: string
  context?: RecommendationContext | 'all'
  algorithmVersion?: string
}

const DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_RANGE_DAYS = 30
const MAX_RANGE_DAYS = 180
const MAX_ALGORITHM_VERSION_LENGTH = 80
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const recommendationContexts: RecommendationContext[] = ['home', 'product_detail_similar', 'cart']

const metricNumberFields = [
  'requests',
  'recommendations',
  'fallbackRequests',
  'impressions',
  'clicks',
  'addToCarts',
  'ordersCreated',
  'paymentsCompleted',
  'ordersCancelled',
  'ordersReturned',
  'reversedPayments',
  'netPayments',
  'grossAttributedRevenue',
  'reversedAttributedRevenue',
  'netAttributedRevenue',
  'ctr',
  'clickToCartRate',
  'cartToOrderRate',
  'orderToPaymentRate',
  'paymentRate',
  'netPaymentRate',
  'fallbackRate',
] as const

const comparisonFields = [
  'requestsPercent',
  'impressionsPercent',
  'clicksPercent',
  'addToCartsPercent',
  'ordersCreatedPercent',
  'paymentsCompletedPercent',
  'netAttributedRevenuePercent',
  'ctrPercent',
  'fallbackRatePercent',
] as const

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
)

const isFiniteNumber = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value)
)

const hasNumberFields = (value: Record<string, unknown>, fields: readonly string[]) => (
  fields.every((field) => isFiniteNumber(value[field]))
)

const hasStringFields = (value: Record<string, unknown>, fields: readonly string[]) => (
  fields.every((field) => typeof value[field] === 'string')
)

const isDateString = (value: unknown) => (
  typeof value === 'string' && value.trim() !== '' && !Number.isNaN(new Date(value).getTime())
)

const isRecommendationContext = (value: unknown): value is RecommendationContext => (
  typeof value === 'string' && recommendationContexts.includes(value as RecommendationContext)
)

const isMetricSnapshot = (value: unknown) => (
  isRecord(value) && hasNumberFields(value, metricNumberFields)
)

const isCoverageGroup = (value: unknown) => (
  isRecord(value) &&
  hasNumberFields(value, ['uniqueRecommended', 'totalActive', 'coverageRate']) &&
  Array.isArray(value.top) &&
  value.top.every((item) => (
    isRecord(item) &&
    hasStringFields(item, ['id', 'name']) &&
    hasNumberFields(item, ['recommendedCount', 'requestCount'])
  ))
)

const isNullableFiniteNumber = (value: unknown) => value === null || isFiniteNumber(value)

const isDateOnly = (value: string) => {
  if (!DATE_ONLY_PATTERN.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

const normalizeOptionalDate = (value: unknown, label: string) => {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string' || !isDateOnly(value.trim())) {
    throw new Error(`${label} báo cáo không hợp lệ.`)
  }
  return value.trim()
}

const toLocalDateInput = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

export const buildDefaultRecommendationAnalyticsFilters = (
  now = new Date(),
): RecommendationAnalyticsFilters => {
  const to = toLocalDateInput(now)
  const fromDate = new Date(`${to}T00:00:00.000Z`)
  fromDate.setUTCDate(fromDate.getUTCDate() - (DEFAULT_RANGE_DAYS - 1))

  return {
    from: fromDate.toISOString().slice(0, 10),
    to,
    context: 'all',
    algorithmVersion: '',
  }
}

export const getBestRecommendationSegment = (segments: RecommendationSegment[]) => (
  [...segments]
    .filter((segment) => segment.metrics.impressions >= 100)
    .sort((left, right) => (
      right.metrics.ctr - left.metrics.ctr ||
      right.metrics.clicks - left.metrics.clicks
    ))[0] ?? null
)

export const normalizeRecommendationAnalyticsFilters = (
  filters: RecommendationAnalyticsFilters = {},
): RecommendationAnalyticsFilters => {
  const from = normalizeOptionalDate(filters.from, 'Ngày bắt đầu')
  const to = normalizeOptionalDate(filters.to, 'Ngày kết thúc')
  const context = filters.context ?? 'all'

  if (context !== 'all' && !isRecommendationContext(context)) {
    throw new Error('Vị trí đề xuất không hợp lệ.')
  }

  if (from && to) {
    const durationDays = (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / DAY_MS + 1
    if (durationDays < 1) {
      throw new Error('Khoảng thời gian báo cáo không hợp lệ.')
    }
    if (durationDays > MAX_RANGE_DAYS) {
      throw new Error(`Khoảng thời gian báo cáo không được vượt quá ${MAX_RANGE_DAYS} ngày.`)
    }
  }

  if (typeof filters.algorithmVersion !== 'string' && filters.algorithmVersion !== undefined) {
    throw new Error('Phiên bản thuật toán không hợp lệ.')
  }
  const algorithmVersion = filters.algorithmVersion?.trim() ?? ''
  if (algorithmVersion.length > MAX_ALGORITHM_VERSION_LENGTH) {
    throw new Error('Phiên bản thuật toán không hợp lệ.')
  }

  return {
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    context,
    algorithmVersion,
  }
}

export const parseRecommendationAnalytics = (value: unknown): RecommendationAnalytics => {
  if (!isRecord(value)) {
    throw new Error('Dữ liệu báo cáo gợi ý không hợp lệ.')
  }

  const { range, filters, summary, comparison, coverage, diversity, search } = value
  const valid = (
    isDateString(value.generatedAt) &&
    typeof value.currentAlgorithmVersion === 'string' &&
    value.currentAlgorithmVersion.trim() !== '' &&
    isRecord(range) &&
    ['from', 'to', 'previousFrom', 'previousTo'].every((field) => isDateString(range[field])) &&
    isRecord(filters) &&
    (filters.context === undefined || isRecommendationContext(filters.context)) &&
    (filters.algorithmVersion === undefined || typeof filters.algorithmVersion === 'string') &&
    isMetricSnapshot(summary) &&
    isRecord(comparison) &&
    comparisonFields.every((field) => isNullableFiniteNumber(comparison[field])) &&
    Array.isArray(value.segments) &&
    value.segments.every((segment) => (
      isRecord(segment) &&
      typeof segment.algorithmVersion === 'string' &&
      isRecommendationContext(segment.context) &&
      isMetricSnapshot(segment.metrics) &&
      isNullableFiniteNumber(segment.avgClickRank) &&
      isNullableFiniteNumber(segment.avgClickScore)
    )) &&
    Array.isArray(value.trend) &&
    value.trend.every((point) => isRecord(point) && isDateString(point.date) && isMetricSnapshot(point)) &&
    isRecord(coverage) &&
    isCoverageGroup(coverage.categories) &&
    isCoverageGroup(coverage.brands) &&
    isRecord(diversity) &&
    hasNumberFields(diversity, [
      'requestsSampled',
      'averageCategoryDiversityAt10',
      'averageBrandDiversityAt10',
    ]) &&
    isRecord(search) &&
    hasNumberFields(search, [
      'totalSearches',
      'keywordSearches',
      'imageSearches',
      'searchResultClicks',
      'searchClickRate',
      'zeroResultRate',
      'averageResultCount',
    ]) &&
    Array.isArray(search.topKeywords) &&
    search.topKeywords.every((keyword) => (
      isRecord(keyword) &&
      typeof keyword.keyword === 'string' &&
      hasNumberFields(keyword, ['count', 'averageResultCount']) &&
      isDateString(keyword.lastSearchedAt)
    )) &&
    Array.isArray(search.zeroResultKeywords) &&
    search.zeroResultKeywords.every((keyword) => (
      isRecord(keyword) &&
      typeof keyword.keyword === 'string' &&
      hasNumberFields(keyword, ['count', 'averageResultCount']) &&
      isDateString(keyword.lastSearchedAt)
    )) &&
    Array.isArray(search.trend) &&
    search.trend.every((point) => (
      isRecord(point) &&
      isDateString(point.date) &&
      hasNumberFields(point, ['searches', 'zeroResultSearches', 'zeroResultRate'])
    )) &&
    Array.isArray(value.topProducts) &&
    value.topProducts.every((product) => (
      isRecord(product) &&
      hasStringFields(product, ['productId', 'name']) &&
      (product.image === null || typeof product.image === 'string') &&
      Array.isArray(product.context) &&
      product.context.every(isRecommendationContext) &&
      hasNumberFields(product, [
        'clicks',
        'addToCarts',
        'ordersCreated',
        'paymentsCompleted',
        'netPayments',
        'netAttributedRevenue',
      ])
    )) &&
    Array.isArray(value.recentRequests) &&
    value.recentRequests.every((request) => (
      isRecord(request) &&
      hasStringFields(request, ['requestId', 'algorithmVersion']) &&
      isRecommendationContext(request.context) &&
      typeof request.fallbackUsed === 'boolean' &&
      isDateString(request.createdAt) &&
      hasNumberFields(request, [
        'itemCount',
        'impressions',
        'clicks',
        'addToCarts',
        'ordersCreated',
        'paymentsCompleted',
        'ordersCancelled',
        'ordersReturned',
        'reversedPayments',
        'netPayments',
        'grossAttributedRevenue',
        'reversedAttributedRevenue',
        'netAttributedRevenue',
        'ctr',
      ])
    ))
  )

  if (!valid) {
    throw new Error('Dữ liệu báo cáo gợi ý không hợp lệ.')
  }

  return value as RecommendationAnalytics
}

export const getRecommendationAnalytics = async (filters: RecommendationAnalyticsFilters = {}) => {
  const normalizedFilters = normalizeRecommendationAnalyticsFilters(filters)
  const params = new URLSearchParams()

  if (normalizedFilters.from) params.set('from', normalizedFilters.from)
  if (normalizedFilters.to) params.set('to', normalizedFilters.to)
  if (normalizedFilters.context && normalizedFilters.context !== 'all') {
    params.set('context', normalizedFilters.context)
  }
  if (normalizedFilters.algorithmVersion) {
    params.set('algorithmVersion', normalizedFilters.algorithmVersion)
  }

  const query = params.toString()
  const response = await requestAdmin<unknown>(`/admin/recommendations/analytics${query ? `?${query}` : ''}`)
  return parseRecommendationAnalytics(response)
}
