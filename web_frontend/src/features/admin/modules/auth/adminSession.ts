import type { AdminRole, AdminSession, AdminUser } from './auth.types'

export type { AdminRole, AdminSession, AdminUser } from './auth.types'

const ACCESS_TOKEN_KEY = 'admin_access_token'
const REFRESH_TOKEN_KEY = 'admin_refresh_token'
const USER_KEY = 'admin_user'

let runtimeAdminAccessToken: string | null = null

export const isAdminRole = (role?: string): role is AdminRole =>
  role === 'admin' || role === 'staff'

export const hasPermission = (user: AdminUser | null, permission: string) =>
  user?.role === 'admin' || Boolean(user?.permissions?.includes(permission))

const clearLegacyAdminTokens = () => {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY)
  window.localStorage.removeItem(REFRESH_TOKEN_KEY)
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
    const user = JSON.parse(rawUser) as AdminUser

    if (!isAdminRole(user.role)) {
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
  runtimeAdminAccessToken = session.accessToken
  clearLegacyAdminTokens()
  window.localStorage.setItem(USER_KEY, JSON.stringify(session.user))
}

export const updateStoredAdminUser = (user: AdminUser) => {
  clearLegacyAdminTokens()
  window.localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export const clearAdminSession = () => {
  if (typeof window === 'undefined') {
    return
  }

  runtimeAdminAccessToken = null
  clearLegacyAdminTokens()
  window.localStorage.removeItem(USER_KEY)
}
