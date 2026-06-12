import type { AdminRole, AdminSession, AdminUser } from './auth.types'

export type { AdminRole, AdminSession, AdminUser } from './auth.types'

const ACCESS_TOKEN_KEY = 'admin_access_token'
const REFRESH_TOKEN_KEY = 'admin_refresh_token'
const USER_KEY = 'admin_user'

export const isAdminRole = (role?: string): role is AdminRole =>
  role === 'admin' || role === 'staff'

export const getAdminSession = (): AdminSession | null => {
  if (typeof window === 'undefined') {
    return null
  }

  const accessToken = window.localStorage.getItem(ACCESS_TOKEN_KEY)
  const refreshToken = window.localStorage.getItem(REFRESH_TOKEN_KEY)
  const rawUser = window.localStorage.getItem(USER_KEY)

  if (!accessToken || !refreshToken || !rawUser) {
    return null
  }

  try {
    const user = JSON.parse(rawUser) as AdminUser

    if (!isAdminRole(user.role)) {
      clearAdminSession()
      return null
    }

    return { accessToken, refreshToken, user }
  } catch {
    clearAdminSession()
    return null
  }
}

export const saveAdminSession = (session: AdminSession) => {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, session.accessToken)
  window.localStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken)
  window.localStorage.setItem(USER_KEY, JSON.stringify(session.user))
}

export const updateStoredAdminUser = (user: AdminUser) => {
  window.localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export const clearAdminSession = () => {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(ACCESS_TOKEN_KEY)
  window.localStorage.removeItem(REFRESH_TOKEN_KEY)
  window.localStorage.removeItem(USER_KEY)
}
