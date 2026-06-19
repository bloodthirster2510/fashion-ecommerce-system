import type {
  AdminLoginCredentials,
  AdminSession,
  ChangePasswordPayload,
} from './auth.types'
import { API_BASE_URL } from '../../../../config/api'
import {
  clearAdminSession,
  getStoredAdminUser,
  saveAdminSession,
} from './adminSession'

type ApiResponse<T> = {
  message?: string
  data?: T
}

type RefreshTokenResponse = {
  accessToken: string
  refreshToken?: string
}

const REFRESH_TOKEN_COOKIE_MODE_HEADER = 'X-Refresh-Token-Mode'

const parseResponse = async <T>(response: Response, fallbackMessage: string) => {
  const result = (await response.json().catch(() => ({}))) as ApiResponse<T>

  if (!response.ok || result.data === undefined) {
    throw new Error(result.message || fallbackMessage)
  }

  return result.data
}

export const loginAdmin = async (
  credentials: AdminLoginCredentials,
): Promise<AdminSession> => {
  const response = await fetch(`${API_BASE_URL}/auth/admin/login`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      [REFRESH_TOKEN_COOKIE_MODE_HEADER]: 'cookie',
    },
    body: JSON.stringify(credentials),
  })

  return parseResponse<AdminSession>(response, 'Không thể đăng nhập')
}

export const refreshAdminSession = async () => {
  const storedUser = getStoredAdminUser()

  if (!storedUser) {
    clearAdminSession()
    throw new Error('Phiên đăng nhập đã hết hạn')
  }

  const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      [REFRESH_TOKEN_COOKIE_MODE_HEADER]: 'cookie',
    },
  })
  const result = await parseResponse<RefreshTokenResponse>(
    response,
    'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại',
  )
  const nextSession: AdminSession = {
    accessToken: result.accessToken,
    user: storedUser,
  }

  saveAdminSession(nextSession)
  return nextSession
}

export const changeAdminPassword = async (
  accessToken: string,
  payload: ChangePasswordPayload,
) => {
  const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  const result = (await response.json().catch(() => ({}))) as ApiResponse<null>

  if (!response.ok) {
    throw new Error(result.message || 'Không thể đổi mật khẩu')
  }
}

export const logoutAdmin = async (accessToken?: string | null) => {
  await fetch(`${API_BASE_URL}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      'Content-Type': 'application/json',
      [REFRESH_TOKEN_COOKIE_MODE_HEADER]: 'cookie',
    },
  }).catch(() => undefined)
}
