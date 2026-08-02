import type { AdminRole, AdminSession, AdminUser } from './auth.types'

export type { AdminRole, AdminSession, AdminUser } from './auth.types'

const ACCESS_TOKEN_KEY = 'admin_access_token'
const REFRESH_TOKEN_KEY = 'admin_refresh_token'
const USER_KEY = 'admin_user'

let runtimeAdminAccessToken: string | null = null
let adminSessionRevision = 0

export const isAdminRole = (role?: string): role is AdminRole =>
  role === 'admin' || role === 'staff'

export const hasPermission = (user: AdminUser | null, permission: string) =>
  user?.role === 'admin' || Boolean(user?.permissions?.includes(permission))

const clearLegacyAdminTokens = () => {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(ACCESS_TOKEN_KEY)
  window.localStorage.removeItem(REFRESH_TOKEN_KEY)
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && Boolean(value.trim())

const isValidAdminUser = (value: unknown): value is AdminUser => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const user = value as Partial<AdminUser>
  return (
    isNonEmptyString(user._id) &&
    isNonEmptyString(user.name) &&
    isNonEmptyString(user.email) &&
    isAdminRole(user.role) &&
    (user.permissions === undefined || (
      Array.isArray(user.permissions) && user.permissions.every(isNonEmptyString)
    )) &&
    (user.mustChangePassword === undefined || typeof user.mustChangePassword === 'boolean')
  )
}

export const getStoredAdminUser = (): AdminUser | null => {
  if (typeof window === 'undefined') {
    return null
  }

  clearLegacyAdminTokens()
  const rawUser = window.localStorage.getItem(USER_KEY)

  if (!rawUser) {
    return null
  }

  try {
    const user = JSON.parse(rawUser) as unknown

    if (!isValidAdminUser(user)) {
      clearAdminSession()
      return null
    }

    return user
  } catch {
    clearAdminSession()
    return null
  }
}

export const hasStoredAdminUser = () => getStoredAdminUser() !== null

export const getAdminSession = (): AdminSession | null => {
  const user = getStoredAdminUser()

  if (!runtimeAdminAccessToken || !user) {
    return null
  }

  return { accessToken: runtimeAdminAccessToken, user }
}

export const saveAdminSession = (session: AdminSession) => {
  if (!isNonEmptyString(session.accessToken) || !isValidAdminUser(session.user)) {
    clearAdminSession()
    throw new Error('Phiên đăng nhập quản trị không hợp lệ')
  }

  adminSessionRevision += 1
  runtimeAdminAccessToken = session.accessToken.trim()
  clearLegacyAdminTokens()
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(USER_KEY, JSON.stringify(session.user))
  }
}

export const updateStoredAdminUser = (user: AdminUser) => {
  if (!isValidAdminUser(user)) {
    clearAdminSession()
    throw new Error('Tài khoản quản trị không hợp lệ')
  }

  adminSessionRevision += 1
  clearLegacyAdminTokens()
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(USER_KEY, JSON.stringify(user))
  }
}

export const clearAdminSession = () => {
  adminSessionRevision += 1
  runtimeAdminAccessToken = null

  if (typeof window === 'undefined') {
    return
  }

  clearLegacyAdminTokens()
  window.localStorage.removeItem(USER_KEY)
}

export const getAdminSessionRevision = () => adminSessionRevision
