import {
  clearAdminSession,
  getAdminSession,
} from '../modules/auth/adminSession'
import { API_BASE_URL } from '../../../config/api'
import { refreshAdminSession } from '../modules/auth/auth.service'

type ApiResponse<T> = {
  message?: string
  data?: T
}

const SESSION_EXPIRED_MESSAGE = 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại'

const getAccessToken = () => {
  const session = getAdminSession()

  if (!session) {
    throw new Error(SESSION_EXPIRED_MESSAGE)
  }

  return session.accessToken
}

const fetchWithToken = async (path: string, init?: RequestInit, accessToken = getAccessToken()) => {
  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${accessToken}`)

  if (init?.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers,
  })
}

export const requestAdmin = async <T>(path: string, init?: RequestInit) => {
  let response = await fetchWithToken(path, init)

  if (response.status === 401) {
    try {
      const nextSession = await refreshAdminSession()
      response = await fetchWithToken(path, init, nextSession.accessToken)
    } catch {
      clearAdminSession()
      window.dispatchEvent(new Event('admin-session-expired'))
      throw new Error(SESSION_EXPIRED_MESSAGE)
    }
  }

  const result = (await response.json().catch(() => ({}))) as ApiResponse<T>

  if (!response.ok || result.data === undefined) {
    throw new Error(result.message || 'Không thể xử lý yêu cầu')
  }

  return result.data
}
