import { AuthApiError, type ApiResponse } from '../features/auth/auth.types'
import { axiosClient } from './axiosClient'
import { tokenService } from './tokenService'

type RefreshTokenResponse = {
  accessToken: string
  refreshToken: string
}

let refreshPromise: Promise<string> | null = null

const getAccessToken = () => {
  const accessToken = tokenService.getAccessToken()

  if (!accessToken) {
    throw new AuthApiError('Vui lòng đăng nhập để quản lý tài khoản.')
  }

  return accessToken
}

const refreshCustomerSession = async () => {
  const refreshToken = tokenService.getRefreshToken()

  if (!refreshToken) {
    tokenService.clearSession()
    throw new AuthApiError('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.')
  }

  let response: Response

  try {
    response = await axiosClient.fetch('/auth/refresh-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    })
  } catch {
    throw new AuthApiError('Không thể làm mới phiên đăng nhập. Vui lòng thử lại.')
  }
  const result = (await response.json().catch(() => ({}))) as ApiResponse<RefreshTokenResponse>

  if (!response.ok || !result.data) {
    tokenService.clearSession()
    throw new AuthApiError(result.message || 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.')
  }

  tokenService.setAccessToken(result.data.accessToken)
  tokenService.setRefreshToken(result.data.refreshToken)
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

const fetchWithToken = async (path: string, init?: RequestInit, accessToken = getAccessToken()) => {
  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${accessToken}`)

  if (init?.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  return axiosClient.fetch(path, {
    ...init,
    headers,
  })
}

export const requestCustomer = async <T>(path: string, init?: RequestInit): Promise<T> => {
  let response: Response

  try {
    response = await fetchWithToken(path, init)
  } catch (error) {
    if (error instanceof AuthApiError) {
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
    throw new AuthApiError(body.message || 'Không thể xử lý yêu cầu.', body.errors)
  }

  if (body.data === undefined) {
    throw new AuthApiError('Phản hồi từ server không hợp lệ.')
  }

  return body.data
}
