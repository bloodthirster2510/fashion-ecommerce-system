const RECOMMENDATION_SESSION_STORAGE_KEY = 'fashionista.recommendationSessionId'

let runtimeSessionId: string | null = null

const createSessionId = () =>
  `rec_session_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`

export const getRecommendationSessionId = () => {
  if (runtimeSessionId) {
    return runtimeSessionId
  }

  try {
    const existingSessionId = window.localStorage.getItem(RECOMMENDATION_SESSION_STORAGE_KEY)?.trim()
    if (existingSessionId) {
      runtimeSessionId = existingSessionId
      return existingSessionId
    }

    runtimeSessionId = createSessionId()
    window.localStorage.setItem(RECOMMENDATION_SESSION_STORAGE_KEY, runtimeSessionId)
    return runtimeSessionId
  } catch {
    runtimeSessionId = createSessionId()
    return runtimeSessionId
  }
}

export const withRecommendationSessionHeader = (headers?: HeadersInit) => {
  const nextHeaders = new Headers(headers)
  nextHeaders.set('X-Session-Id', getRecommendationSessionId())
  return nextHeaders
}
