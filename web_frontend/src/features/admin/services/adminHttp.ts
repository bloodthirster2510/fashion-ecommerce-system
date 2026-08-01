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
const DEMO_ACCESS_TOKEN = 'demo-admin-access-token'

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

const fetchAdminResponse = async (path: string, init?: RequestInit) => {
  const currentAccessToken = getAccessToken()
  let response = await fetchWithToken(path, init, currentAccessToken)

  if (response.status === 401) {
    if (currentAccessToken === DEMO_ACCESS_TOKEN && import.meta.env.DEV) {
      throw new Error('Dữ liệu API không khả dụng trong chế độ xem bố cục demo')
    }

    try {
      const nextSession = await refreshAdminSession()
      response = await fetchWithToken(path, init, nextSession.accessToken)
    } catch {
      const latestSession = getAdminSession()
      if (latestSession?.accessToken === currentAccessToken) {
        clearAdminSession()
        window.dispatchEvent(new Event('admin-session-expired'))
      }
      throw new Error(SESSION_EXPIRED_MESSAGE)
    }
  }

  return response
}

export const requestAdmin = async <T>(path: string, init?: RequestInit) => {
  const response = await fetchAdminResponse(path, init)
  const result = (await response.json().catch(() => ({}))) as ApiResponse<T>

  if (!response.ok || result.data === undefined) {
    throw new Error(result.message || 'Không thể xử lý yêu cầu')
  }

  return result.data
}

export const requestAdminFile = async (path: string, init?: RequestInit) => {
  const response = await fetchAdminResponse(path, init)

  if (!response.ok) {
    const result = (await response.json().catch(() => ({}))) as ApiResponse<never>
    throw new Error(result.message || 'Không thể tải tệp')
  }

  const contentDisposition = response.headers.get('Content-Disposition') ?? ''
  const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i)
  const totalItems = Number(response.headers.get('X-Export-Total'))

  return {
    blob: await response.blob(),
    filename: filenameMatch?.[1] ?? 'download',
    totalItems: Number.isFinite(totalItems) ? totalItems : undefined,
    truncated: response.headers.get('X-Export-Truncated') === 'true',
  }
}
