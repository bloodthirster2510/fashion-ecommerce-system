import { expect, test } from '@playwright/test'
import {
  buildDefaultRecommendationAnalyticsFilters,
  getBestRecommendationSegment,
  normalizeRecommendationAnalyticsFilters,
  parseRecommendationAnalytics,
} from './recommendationAnalytics.service'
import type {
  RecommendationAnalytics,
  RecommendationMetricSnapshot,
  RecommendationSegment,
} from './recommendationAnalytics.types'

const emptyMetrics = (): RecommendationMetricSnapshot => ({
  requests: 0,
  recommendations: 0,
  fallbackRequests: 0,
  impressions: 0,
  clicks: 0,
  addToCarts: 0,
  ordersCreated: 0,
  paymentsCompleted: 0,
  ordersCancelled: 0,
  ordersReturned: 0,
  reversedPayments: 0,
  netPayments: 0,
  grossAttributedRevenue: 0,
  reversedAttributedRevenue: 0,
  netAttributedRevenue: 0,
  ctr: 0,
  clickToCartRate: 0,
  cartToOrderRate: 0,
  orderToPaymentRate: 0,
  paymentRate: 0,
  netPaymentRate: 0,
  fallbackRate: 0,
})

const emptyAnalytics = (): RecommendationAnalytics => ({
  generatedAt: '2026-08-02T05:00:00.000Z',
  range: {
    from: '2026-07-03T17:00:00.000Z',
    to: '2026-08-02T16:59:59.999Z',
    previousFrom: '2026-06-03T17:00:00.000Z',
    previousTo: '2026-07-03T16:59:59.999Z',
  },
  filters: {},
  summary: emptyMetrics(),
  comparison: {
    requestsPercent: 0,
    impressionsPercent: 0,
    clicksPercent: 0,
    addToCartsPercent: 0,
    ordersCreatedPercent: 0,
    paymentsCompletedPercent: 0,
    netAttributedRevenuePercent: 0,
    ctrPercent: 0,
    fallbackRatePercent: 0,
  },
  segments: [],
  trend: [],
  coverage: {
    categories: { uniqueRecommended: 0, totalActive: 0, coverageRate: 0, top: [] },
    brands: { uniqueRecommended: 0, totalActive: 0, coverageRate: 0, top: [] },
  },
  diversity: {
    requestsSampled: 0,
    averageCategoryDiversityAt10: 0,
    averageBrandDiversityAt10: 0,
  },
  search: {
    totalSearches: 0,
    keywordSearches: 0,
    imageSearches: 0,
    searchResultClicks: 0,
    searchClickRate: 0,
    zeroResultRate: 0,
    averageResultCount: 0,
    topKeywords: [],
    trend: [],
  },
  topProducts: [],
  recentRequests: [],
})

const segment = (algorithmVersion: string, impressions: number, ctr: number): RecommendationSegment => ({
  algorithmVersion,
  context: 'home',
  metrics: {
    ...emptyMetrics(),
    impressions,
    clicks: Math.round(impressions * ctr),
    ctr,
  },
  avgClickRank: null,
  avgClickScore: null,
})

test.describe('admin recommendation analytics', () => {
  test('uses exactly 30 inclusive calendar days by default', () => {
    const filters = buildDefaultRecommendationAnalyticsFilters(new Date('2026-08-02T05:00:00.000Z'))
    const from = Date.parse(`${filters.from}T00:00:00.000Z`)
    const to = Date.parse(`${filters.to}T00:00:00.000Z`)

    expect((to - from) / (24 * 60 * 60 * 1000) + 1).toBe(30)
  })

  test('normalizes supported filters and rejects invalid calendar ranges', () => {
    expect(normalizeRecommendationAnalyticsFilters({
      from: '2026-07-01',
      to: '2026-07-30',
      context: 'cart',
      algorithmVersion: '  v3_cart  ',
    })).toEqual({
      from: '2026-07-01',
      to: '2026-07-30',
      context: 'cart',
      algorithmVersion: 'v3_cart',
    })

    expect(() => normalizeRecommendationAnalyticsFilters({ from: '2026-02-30' })).toThrow()
    expect(() => normalizeRecommendationAnalyticsFilters({ from: '2026-08-02', to: '2026-08-01' })).toThrow()
    expect(() => normalizeRecommendationAnalyticsFilters({ from: '2026-01-01', to: '2026-07-01' })).toThrow()
    expect(() => normalizeRecommendationAnalyticsFilters({ context: 'all', algorithmVersion: 'x'.repeat(81) })).toThrow()
  })

  test('accepts an empty report and rejects malformed nested payloads', () => {
    const analytics = emptyAnalytics()
    expect(parseRecommendationAnalytics(analytics)).toBe(analytics)

    expect(() => parseRecommendationAnalytics({ ...analytics, coverage: { categories: {}, brands: {} } })).toThrow(
      'Dữ liệu báo cáo gợi ý không hợp lệ.',
    )
    expect(() => parseRecommendationAnalytics({ ...analytics, generatedAt: 'not-a-date' })).toThrow(
      'Dữ liệu báo cáo gợi ý không hợp lệ.',
    )
    expect(() => parseRecommendationAnalytics({ ...analytics, recentRequests: [{ requestId: 'broken' }] })).toThrow(
      'Dữ liệu báo cáo gợi ý không hợp lệ.',
    )
  })

  test('does not name a best segment from a sample below 100 impressions', () => {
    const lowSample = segment('low-sample', 99, 0.9)
    const qualified = segment('qualified', 100, 0.2)
    const stronger = segment('stronger', 150, 0.3)

    expect(getBestRecommendationSegment([lowSample])).toBeNull()
    expect(getBestRecommendationSegment([lowSample, qualified, stronger])).toBe(stronger)
  })
})
