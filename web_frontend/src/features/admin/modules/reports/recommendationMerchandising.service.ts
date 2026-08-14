import { requestAdmin } from '../../services/adminHttp'
import type { RecommendationContext } from './recommendationAnalytics.types'

export type PinnedRecommendationProduct = {
  productId: string
  position: number
  name: string
  image: string
  isActive: boolean
}

export type RecommendationMerchandisingRule = {
  context: RecommendationContext
  enabled: boolean
  startsAt: string | null
  endsAt: string | null
  updatedAt: string | null
  updatedBy: string | null
  pinnedProducts: PinnedRecommendationProduct[]
}

export const listRecommendationMerchandisingRules = () =>
  requestAdmin<RecommendationMerchandisingRule[]>('/admin/recommendations/merchandising')

export const updateRecommendationMerchandisingRule = (
  context: RecommendationContext,
  input: {
    enabled: boolean
    startsAt: string | null
    endsAt: string | null
    pinnedProductIds: string[]
  },
) => requestAdmin<RecommendationMerchandisingRule>(
  `/admin/recommendations/merchandising/${encodeURIComponent(context)}`,
  { method: 'PUT', body: JSON.stringify(input) },
)
