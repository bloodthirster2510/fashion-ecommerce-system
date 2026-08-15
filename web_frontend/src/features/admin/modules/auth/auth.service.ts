import type {
  AdminLoginCredentials,
  AdminSession,
  AdminUser,
  ChangePasswordPayload,
} from './auth.types'
import { API_BASE_URL } from '../../../../config/api'
import {
  clearAdminSession,
  getAdminSessionRevision,
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
  user?: AdminUser
}

export class AdminAuthError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'AdminAuthError'
    this.status = status
  }
}

const REFRESH_TOKEN_COOKIE_MODE_HEADER = 'X-Refresh-Token-Mode'
let adminRefreshRequest: Promise<AdminSession> | null = null
let adminRefreshRequestRevision: number | null = null

const parseResponse = async <T>(response: Response, fallbackMessage: string) => {
  const result = (await response.json().catch(() => ({}))) as ApiResponse<T>

  if (!response.ok || result.data === undefined) {
    throw new AdminAuthError(result.message || fallbackMessage, response.status)
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

const performAdminSessionRefresh = async () => {
  const storedUser = getStoredAdminUser()

  if (!storedUser) {
    clearAdminSession()
    throw new Error('Phiên đăng nhập đã hết hạn')
  }

  const sessionRevision = getAdminSessionRevision()

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
    user: result.user ?? storedUser,
  }

  if (getAdminSessionRevision() !== sessionRevision) {
    throw new Error('Phiên đăng nhập đã thay đổi, vui lòng đăng nhập lại')
  }

  saveAdminSession(nextSession)
  return nextSession
}

export const refreshAdminSession = () => {
  const currentRevision = getAdminSessionRevision()
  if (adminRefreshRequest && adminRefreshRequestRevision === currentRevision) {
    return adminRefreshRequest
  }

  const request = performAdminSessionRefresh().finally(() => {
    if (adminRefreshRequest === request) {
      adminRefreshRequest = null
      adminRefreshRequestRevision = null
    }
  })
  adminRefreshRequest = request
  adminRefreshRequestRevision = currentRevision
  return request
}

export const getCurrentAdminUser = async (accessToken: string): Promise<AdminUser> => {
  const response = await fetch(`${API_BASE_URL}/auth/admin/session`, {
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  return parseResponse<AdminUser>(response, 'Không thể cập nhật quyền tài khoản')
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
