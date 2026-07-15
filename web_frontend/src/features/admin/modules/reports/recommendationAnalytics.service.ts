import { requestAdmin } from '../../services/adminHttp'
import type {
  RecommendationAnalytics,
  RecommendationContext,
} from './recommendationAnalytics.types'

export type RecommendationAnalyticsFilters = {
  from?: string
  to?: string
  context?: RecommendationContext | 'all'
  algorithmVersion?: string
}

export const getRecommendationAnalytics = (filters: RecommendationAnalyticsFilters = {}) => {
  const params = new URLSearchParams()

  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  if (filters.context && filters.context !== 'all') params.set('context', filters.context)
  if (filters.algorithmVersion?.trim()) {
    params.set('algorithmVersion', filters.algorithmVersion.trim())
  }

  const query = params.toString()
  return requestAdmin<RecommendationAnalytics>(`/admin/recommendations/analytics${query ? `?${query}` : ''}`)
}
