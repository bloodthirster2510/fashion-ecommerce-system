import {
  clearAdminSession,
  getAdminSession,
  saveAdminSession,
  type AdminSession,
} from '../modules/auth/adminSession'
import { API_BASE_URL } from '../../../config/api'

type ApiResponse<T> = {
  message?: string
  data?: T
}

type RefreshTokenResponse = {
  accessToken: string
  refreshToken: string
}

const getAccessToken = () => {
  const session = getAdminSession()

  if (!session) {
    throw new Error('Phiên đăng nhập đã hết hạn')
  }

  return session.accessToken
}

const refreshAdminSession = async () => {
  const session = getAdminSession()

  if (!session) {
    throw new Error('Phiên đăng nhập đã hết hạn')
  }

  const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  })
  const result = (await response.json().catch(() => ({}))) as ApiResponse<RefreshTokenResponse>

  if (!response.ok || !result.data) {
    clearAdminSession()
    window.dispatchEvent(new Event('admin-session-expired'))
    throw new Error('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại')
  }

  const nextSession: AdminSession = {
    ...session,
    accessToken: result.data.accessToken,
    refreshToken: result.data.refreshToken,
  }

  saveAdminSession(nextSession)
  return nextSession.accessToken
}

const fetchWithToken = async (path: string, init?: RequestInit, accessToken = getAccessToken()) => {
  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${accessToken}`)

  if (init?.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  })
}

export const requestAdmin = async <T>(path: string, init?: RequestInit) => {
  let response = await fetchWithToken(path, init)

  if (response.status === 401) {
    const nextAccessToken = await refreshAdminSession()
    response = await fetchWithToken(path, init, nextAccessToken)
  }

  const result = (await response.json().catch(() => ({}))) as ApiResponse<T>

  if (!response.ok || result.data === undefined) {
    throw new Error(result.message || 'Không thể xử lý yêu cầu')
  }

  return result.data
}
