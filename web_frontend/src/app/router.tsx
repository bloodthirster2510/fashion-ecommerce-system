import { useCallback, useEffect, useState } from 'react'
import { AdminLogin } from '../features/admin/modules/auth/AdminLogin'
import { ForcePasswordChange } from '../features/admin/modules/auth/ForcePasswordChange'
import '../features/admin/styles/admin.css'
import '../features/admin/layouts/admin-layout.css'
import {
  clearAdminSession,
  getAdminSession,
  type AdminSession,
} from '../features/admin/modules/auth/adminSession'
import {
  ADMIN_DEFAULT_PATH,
  ADMIN_LOGIN_PATH,
} from '../features/admin/config/adminRoutes'
import { logoutAdmin } from '../features/admin/modules/auth/auth.service'
import { AdminLayout } from '../features/admin/layouts/AdminLayout'
import { ProductDetailPage } from '../features/catalog/pages/ProductDetailPage'
import { ProductListPage } from '../features/catalog/pages/ProductListPage'
import { ProfilePage } from '../features/profile/pages/ProfilePage'

const ADMIN_NAVIGATION_EVENT = 'admin:navigation'

export function Router() {
  const [adminSession, setAdminSession] = useState<AdminSession | null>(() =>
    getAdminSession(),
  )
  const [path, setPath] = useState(() => window.location.pathname)
  const replacePath = useCallback((nextPath: string) => {
    if (window.location.pathname !== nextPath) {
      window.history.replaceState(null, '', nextPath)
    }

    setPath(nextPath)
  }, [])

  const handleLogout = async () => {
    const accessToken = adminSession?.accessToken
    if (accessToken) {
      await logoutAdmin(accessToken)
    }

    clearAdminSession()
    setAdminSession(null)
    replacePath(ADMIN_LOGIN_PATH)
  }

  useEffect(() => {
    const handleSessionExpired = () => {
      clearAdminSession()
      setAdminSession(null)
      replacePath(ADMIN_LOGIN_PATH)
    }

    window.addEventListener('admin-session-expired', handleSessionExpired)

    return () => window.removeEventListener('admin-session-expired', handleSessionExpired)
  }, [replacePath])

  useEffect(() => {
    const handleLocationChange = () => {
      setPath(window.location.pathname)
    }

    window.addEventListener('popstate', handleLocationChange)
    window.addEventListener(ADMIN_NAVIGATION_EVENT, handleLocationChange)

    return () => {
      window.removeEventListener('popstate', handleLocationChange)
      window.removeEventListener(ADMIN_NAVIGATION_EVENT, handleLocationChange)
    }
  }, [])

  useEffect(() => {
    if (!path.startsWith('/admin')) {
      return
    }

    if (!adminSession) {
      if (path !== ADMIN_LOGIN_PATH) {
        replacePath(ADMIN_LOGIN_PATH)
      }
      return
    }

    if (adminSession.user.mustChangePassword) {
      if (path !== '/admin/change-password') {
        replacePath('/admin/change-password')
      }
      return
    }

    if (path === ADMIN_LOGIN_PATH || path === '/admin' || path === '/admin/') {
      replacePath(ADMIN_DEFAULT_PATH)
    }
  }, [adminSession, path, replacePath])

  if (!path.startsWith('/admin')) {
    if (path === '/account') {
      return <ProfilePage />
    }

    if (/^\/products\/[^/]+\/?$/.test(path)) {
      return <ProductDetailPage />
    }

    return <ProductListPage showSlider={path === '/'} />
  }

  const handleLoginSuccess = (session: AdminSession) => {
    setAdminSession(session)
    replacePath(session.user.mustChangePassword ? '/admin/change-password' : ADMIN_DEFAULT_PATH)
  }

  if (!adminSession) {
    return <AdminLogin onLoginSuccess={handleLoginSuccess} />
  }

  if (adminSession.user.mustChangePassword) {
    return (
      <ForcePasswordChange
        session={adminSession}
        onPasswordChanged={handleLogout}
        onLogout={handleLogout}
      />
    )
  }

  return <AdminLayout currentUser={adminSession.user} onLogout={handleLogout} />
}
