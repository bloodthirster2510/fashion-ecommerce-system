import { useState } from 'react'
import { AdminLogin } from '../features/admin/modules/auth/AdminLogin'
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
import { AdminLayout } from '../features/admin/layouts/AdminLayout'
import { ProductDetailPage } from '../features/catalog/pages/ProductDetailPage'
import { ProductListPage } from '../features/catalog/pages/ProductListPage'
import { ProfilePage } from '../features/profile/pages/ProfilePage'

export function Router() {
  const [adminSession, setAdminSession] = useState<AdminSession | null>(() =>
    getAdminSession(),
  )
  const path = window.location.pathname

  if (!path.startsWith('/admin')) {
    if (path === '/account') {
      return <ProfilePage />
    }

    if (/^\/products\/[^/]+\/?$/.test(path)) {
      return <ProductDetailPage />
    }

    return <ProductListPage showSlider={path === '/'} />
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

  if (!adminSession) {
    if (!isLoginRoute) {
      window.history.replaceState(null, '', ADMIN_LOGIN_PATH)
    }

    return <AdminLogin onLoginSuccess={handleLoginSuccess} />
  }

  if (isLoginRoute || path === '/admin' || path === '/admin/') {
    window.history.replaceState(null, '', ADMIN_DEFAULT_PATH)
  }

  return <AdminLayout currentUser={adminSession.user} onLogout={handleLogout} />
}
