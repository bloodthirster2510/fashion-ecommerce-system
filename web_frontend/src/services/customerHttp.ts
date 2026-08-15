import { AuthApiError, type ApiResponse, type AuthUser } from '../features/auth/auth.types'
import { withRecommendationSessionHeader } from '../features/recommendation/recommendationSession'
import { axiosClient } from './axiosClient'
import { tokenService } from './tokenService'

type RefreshTokenResponse = {
  accessToken: string
  refreshToken?: string
  user?: AuthUser
}

const REFRESH_TOKEN_COOKIE_MODE_HEADER = 'X-Refresh-Token-Mode'
const DEFAULT_AUTH_REQUIRED_MESSAGE = 'Vui lòng đăng nhập để quản lý tài khoản.'
const CUSTOMER_SESSION_EXPIRED_EVENT = 'customer-session-expired'

let refreshPromise: Promise<string> | null = null

type CustomerRequestOptions = {
  authRequiredMessage?: string
}

const normalizeRequestOptions = (options?: string | CustomerRequestOptions): CustomerRequestOptions => (
  typeof options === 'string' ? { authRequiredMessage: options } : options ?? {}
)

const isRefreshTokenRequiredMessage = (message?: string) => (
  Boolean(message && /refresh token/i.test(message) && /bắt buộc/i.test(message))
)

const createAuthRequiredError = (message = DEFAULT_AUTH_REQUIRED_MESSAGE) =>
  new AuthApiError(message, undefined, undefined, 'CUSTOMER_AUTH_REQUIRED')

const notifyCustomerSessionExpired = () => {
  window.dispatchEvent(new Event(CUSTOMER_SESSION_EXPIRED_EVENT))
}

const assertRefreshSessionUser = (session: RefreshTokenResponse) => {
  const storedUser = tokenService.getCurrentUser()

  if (!session.user) {
    throw new AuthApiError('Phiên đăng nhập không hợp lệ, vui lòng đăng nhập lại.', undefined, 401)
  }

  if (storedUser && session.user._id !== storedUser._id) {
    throw new AuthApiError('Phiên đăng nhập đã thay đổi, vui lòng đăng nhập lại.', undefined, 401)
  }

  return session.user
}

const getAccessToken = () => {
  const accessToken = tokenService.getAccessToken()

  if (!accessToken) {
    throw createAuthRequiredError()
  }

  return accessToken
}

const refreshCustomerSession = async () => {
  let response: Response

  try {
    response = await axiosClient.fetch('/auth/refresh-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [REFRESH_TOKEN_COOKIE_MODE_HEADER]: 'cookie',
      },
    })
  } catch {
    throw new AuthApiError('Không thể làm mới phiên đăng nhập. Vui lòng thử lại.')
  }
  const result = (await response.json().catch(() => ({}))) as ApiResponse<RefreshTokenResponse>

  if (!response.ok || !result.data || isRefreshTokenRequiredMessage(result.message)) {
    tokenService.clearSession()
    notifyCustomerSessionExpired()
    throw new AuthApiError(result.message || 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.', undefined, response.status)
  }

  try {
    const user = assertRefreshSessionUser(result.data)
    tokenService.setAccessToken(result.data.accessToken)
    tokenService.setCurrentUser(user)
  } catch (error) {
    tokenService.clearSession()
    notifyCustomerSessionExpired()
    throw error
  }

  return result.data.accessToken
}

const getRefreshedAccessToken = async () => {
  if (!refreshPromise) {
    refreshPromise = refreshCustomerSession().finally(() => {
      refreshPromise = null
    })
  }

  return refreshPromise
}

export const getOptionalCustomerAccessToken = async (): Promise<string | null> => {
  const accessToken = tokenService.getAccessToken()
  if (accessToken) {
    return accessToken
  }

  if (!tokenService.getCurrentUser()) {
    return null
  }

  try {
    return await getRefreshedAccessToken()
  } catch {
    return null
  }
}

export const getRefreshedCustomerAccessToken = getRefreshedAccessToken

const fetchWithToken = async (path: string, init?: RequestInit, accessToken = getAccessToken()) => {
  const headers = withRecommendationSessionHeader(init?.headers)
  headers.set('Authorization', `Bearer ${accessToken}`)

  if (init?.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  return axiosClient.fetch(path, {
    ...init,
    headers,
  })
}

export const restoreCustomerSession = async (): Promise<AuthUser | null> => {
  const storedUser = tokenService.getCurrentUser()
  if (!storedUser) return null

  await getRefreshedAccessToken()
  return tokenService.getCurrentUser()
}

export const requestCustomer = async <T>(
  path: string,
  init?: RequestInit,
  options?: string | CustomerRequestOptions,
): Promise<T> => {
  const requestOptions = normalizeRequestOptions(options)
  let response: Response

  try {
    const accessToken = tokenService.getAccessToken()
    if (!accessToken && !tokenService.getCurrentUser()) {
      throw createAuthRequiredError(requestOptions.authRequiredMessage)
    }

    const activeAccessToken = accessToken ?? await getRefreshedAccessToken()
    response = await fetchWithToken(path, init, activeAccessToken)
  } catch (error) {
    if (error instanceof AuthApiError) {
      if (error.errorCode === 'CUSTOMER_AUTH_REQUIRED') {
        throw createAuthRequiredError(requestOptions.authRequiredMessage)
      }
      throw error
    }

    throw new AuthApiError('Không thể kết nối tới server. Vui lòng kiểm tra backend đang chạy ở port 5000.')
  }

  if (response.status === 401) {
    const nextAccessToken = await getRefreshedAccessToken()
    response = await fetchWithToken(path, init, nextAccessToken)
  }

  const body = (await response.json().catch(() => ({}))) as ApiResponse<T>

  if (!response.ok) {
    if (response.status === 401) {
      tokenService.clearSession()
      notifyCustomerSessionExpired()
    }
    throw new AuthApiError(body.message || 'Không thể xử lý yêu cầu.', body.errors, response.status, body.errorCode)
  }

  if (body.data === undefined) {
    throw new AuthApiError('Phản hồi từ server không hợp lệ.')
  }

  return body.data
}
