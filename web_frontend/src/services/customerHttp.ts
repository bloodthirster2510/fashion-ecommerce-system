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
const DEFAULT_AUTH_REQUIRED_MESSAGE = 'Đăng nhập để tiếp tục thực hiện thao tác này.'
const CUSTOMER_SESSION_EXPIRED_EVENT = 'customer-session-expired'

let refreshPromise: Promise<RefreshTokenResponse> | null = null

type CustomerRequestOptions = {
  authRequiredMessage?: string
}

const normalizeRequestOptions = (options?: CustomerRequestOptions | string): CustomerRequestOptions => (
  typeof options === 'string' ? { authRequiredMessage: options } : options ?? {}
)

const isRefreshTokenRequiredMessage = (message?: string) => {
  const normalizedMessage = message?.toLocaleLowerCase('vi-VN') ?? ''
  return normalizedMessage.includes('refresh token') && normalizedMessage.includes('bắt buộc')
}

const createAuthRequiredError = (message: string) => (
  new AuthApiError(message, undefined, 401, 'AUTH_REQUIRED')
)

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
    throw new AuthApiError('Vui lòng đăng nhập để quản lý tài khoản.')
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

  if (!response.ok || !result.data) {
    tokenService.clearSession()
    notifyCustomerSessionExpired()
    throw new AuthApiError(
      result.message || 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.',
      undefined,
      response.status,
    )
  }

  try {
    const user = assertRefreshSessionUser(result.data)
    tokenService.setAccessToken(result.data.accessToken)
    tokenService.setCurrentUser(user)
    return result.data
  } catch (error) {
    tokenService.clearSession()
    notifyCustomerSessionExpired()
    throw error
  }
}

const getRefreshedAccessToken = async () => {
  if (!refreshPromise) {
    refreshPromise = refreshCustomerSession().finally(() => {
      refreshPromise = null
    })
  }

  const session = await refreshPromise
  return session.accessToken
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

export const restoreCustomerSession = async () => {
  if (!tokenService.getCurrentUser()) {
    return null
  }

  await getRefreshedAccessToken()
  return tokenService.getCurrentUser()
}

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

export const requestCustomer = async <T>(
  path: string,
  init?: RequestInit,
  options?: CustomerRequestOptions | string,
): Promise<T> => {
  let response: Response
  const { authRequiredMessage = DEFAULT_AUTH_REQUIRED_MESSAGE } = normalizeRequestOptions(options)

  try {
    const accessToken = tokenService.getAccessToken()
    if (!accessToken && !tokenService.getCurrentUser()) {
      throw createAuthRequiredError(authRequiredMessage)
    }

    const activeAccessToken = accessToken ?? await getRefreshedAccessToken()
    response = await fetchWithToken(path, init, activeAccessToken)
  } catch (error) {
    if (error instanceof AuthApiError) {
      if (isRefreshTokenRequiredMessage(error.message)) {
        throw createAuthRequiredError(authRequiredMessage)
      }

      throw error
    }

    throw new AuthApiError('Không thể kết nối tới server. Vui lòng kiểm tra backend đang chạy ở port 5000.')
  }

  if (response.status === 401) {
    let nextAccessToken: string

    try {
      nextAccessToken = await getRefreshedAccessToken()
    } catch (error) {
      if (error instanceof AuthApiError && isRefreshTokenRequiredMessage(error.message)) {
        throw createAuthRequiredError(authRequiredMessage)
      }

      throw error
    }

    response = await fetchWithToken(path, init, nextAccessToken)
  }

  const body = (await response.json().catch(() => ({}))) as ApiResponse<T>

  if (!response.ok) {
    throw new AuthApiError(body.message || 'Không thể xử lý yêu cầu.', body.errors)
  }

  if (body.data === undefined) {
    throw new AuthApiError('Phản hồi từ server không hợp lệ.')
  }

  return body.data
}
