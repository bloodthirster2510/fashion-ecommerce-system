import { axiosClient } from '../../services/axiosClient'
import { tokenService } from '../../services/tokenService'
import { getRecommendationSessionId, withRecommendationSessionHeader } from './recommendationSession'

export type InteractionActionType =
  | 'view'
  | 'click'
  | 'search'
  | 'favorite'
  | 'add_to_cart'
  | 'purchase'
  | 'search_result_click'
  | 'recommendation_click'
  | 'try_on'

export type InteractionSource =
  | 'home'
  | 'product_list'
  | 'product_detail'
  | 'search'
  | 'image_search'
  | 'cart'
  | 'checkout'
  | 'recommendation'
  | 'virtual_try_on'
  | 'backend'

export type InteractionPayload = {
  productId?: string
  variantId?: string
  colorVariantId?: string
  size?: string
  actionType: InteractionActionType
  source: InteractionSource
  metadata?: Record<string, unknown>
}

export const recordInteractionBestEffort = async (payload: InteractionPayload) => {
  const sessionId = getRecommendationSessionId()
  const headers = withRecommendationSessionHeader({ 'Content-Type': 'application/json' })
  const accessToken = tokenService.getAccessToken()

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  await axiosClient
    .fetch('/interactions', {
      method: 'POST',
      headers,
      keepalive: true,
      body: JSON.stringify({ ...payload, sessionId }),
    })
    .then(() => undefined)
    .catch(() => undefined)
}

export const waitForInteractionBestEffort = async (payload: InteractionPayload, timeoutMs = 150) => {
  await Promise.race([
    recordInteractionBestEffort(payload),
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, timeoutMs)
    }),
  ])
}
