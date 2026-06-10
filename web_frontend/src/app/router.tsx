import { useEffect, useState } from 'react'
import { AdminLogin } from '../admin/AdminLogin'
import {
  clearAdminSession,
  getAdminSession,
  updateStoredAdminUser,
  type AdminSession,
} from '../admin/adminSession'
import { ADMIN_DEFAULT_PATH, ADMIN_LOGIN_PATH } from '../admin/adminRoutes'
import { ForcePasswordChange } from '../admin/ForcePasswordChange'
import { AdminLayout } from '../layouts/AdminLayout'

export function Router() {
  const [adminSession, setAdminSession] = useState<AdminSession | null>(() =>
    getAdminSession(),
  )
  const isAdminPath = window.location.pathname.startsWith('/admin')
  const path = isAdminPath
    ? window.location.pathname
    : adminSession
      ? ADMIN_DEFAULT_PATH
      : ADMIN_LOGIN_PATH

  if (!isAdminPath) {
    window.history.replaceState(null, '', path)
  }

  const isLoginRoute = path === ADMIN_LOGIN_PATH
  const handleLoginSuccess = (session: AdminSession) => {
    setAdminSession(session)
    window.history.replaceState(null, '', ADMIN_DEFAULT_PATH)
  }
  const handleLogout = () => {
    clearAdminSession()
    setAdminSession(null)
    window.history.replaceState(null, '', ADMIN_LOGIN_PATH)
  }

  useEffect(() => {
    window.addEventListener('admin-session-expired', handleLogout)

    return () => window.removeEventListener('admin-session-expired', handleLogout)
  }, [])
  const handlePasswordChanged = () => {
    if (!adminSession) {
      return
    }

    const nextSession = {
      ...adminSession,
      user: {
        ...adminSession.user,
        mustChangePassword: false,
      },
    }

    updateStoredAdminUser(nextSession.user)
    setAdminSession(nextSession)
    window.history.replaceState(null, '', ADMIN_DEFAULT_PATH)
  }

  if (!adminSession) {
    if (!isLoginRoute) {
      window.history.replaceState(null, '', ADMIN_LOGIN_PATH)
    }

    return <AdminLogin onLoginSuccess={handleLoginSuccess} />
  }

  if (isLoginRoute || path === '/admin' || path === '/admin/') {
    window.history.replaceState(null, '', ADMIN_DEFAULT_PATH)
  }

  if (adminSession.user.mustChangePassword) {
    return (
      <ForcePasswordChange
        session={adminSession}
        onPasswordChanged={handlePasswordChanged}
        onLogout={handleLogout}
      />
    )
  }

  return <AdminLayout currentUser={adminSession.user} onLogout={handleLogout} />
}
