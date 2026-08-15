import { lazy, useCallback, useEffect, useState } from 'react'
import { AdminLogin } from '../features/admin/modules/auth/AdminLogin'
import { ForcePasswordChange } from '../features/admin/modules/auth/ForcePasswordChange'
import '../features/admin/styles/admin.css'
import '../features/admin/layouts/admin-layout.css'
import {
  clearAdminSession,
  getAdminSession,
  hasStoredAdminUser,
  saveAdminSession,
  type AdminSession,
} from '../features/admin/modules/auth/adminSession'
import {
  ADMIN_DEFAULT_PATH,
  ADMIN_LOGIN_PATH,
} from '../features/admin/config/adminRoutes'
import {
  AdminAuthError,
  getCurrentAdminUser,
  logoutAdmin,
  refreshAdminSession,
} from '../features/admin/modules/auth/auth.service'

const ADMIN_NAVIGATION_EVENT = 'admin:navigation'
const ADMIN_SESSION_SYNC_INTERVAL_MS = 15_000

const haveSameAdminUser = (left: AdminSession['user'], right: AdminSession['user']) =>
  JSON.stringify(left) === JSON.stringify(right)

const AdminLayout = lazy(() =>
  import('../features/admin/layouts/AdminLayout').then((module) => ({ default: module.AdminLayout })),
)
const ProductDetailPage = lazy(() =>
  import('../features/catalog/pages/ProductDetailPage').then((module) => ({ default: module.ProductDetailPage })),
)
const ProductListPage = lazy(() =>
  import('../features/catalog/pages/ProductListPage').then((module) => ({ default: module.ProductListPage })),
)
const ProfilePage = lazy(() =>
  import('../features/profile/pages/ProfilePage').then((module) => ({ default: module.ProfilePage })),
)
const SupportPage = lazy(() =>
  import('../features/support/SupportPage').then((module) => ({ default: module.SupportPage })),
)
const AccountOrdersPage = lazy(() =>
  import('../features/profile/pages/AccountOrdersPage').then((module) => ({ default: module.AccountOrdersPage })),
)
const MyReviewsPage = lazy(() =>
  import('../features/profile/pages/MyReviewsPage').then((module) => ({ default: module.MyReviewsPage })),
)
const HomePage = lazy(() =>
  import('../features/home/pages/HomePage').then((module) => ({ default: module.HomePage })),
)
const CartPage = lazy(() =>
  import('../features/cart/pages/CartPage').then((module) => ({ default: module.CartPage })),
)
const OrderDetailPage = lazy(() =>
  import('../features/orders/pages/OrderDetailPage').then((module) => ({ default: module.OrderDetailPage })),
)
const PolicyPage = lazy(() =>
  import('../features/policies/PolicyPage').then((module) => ({ default: module.PolicyPage })),
)

export function Router() {
  const [adminSession, setAdminSession] = useState<AdminSession | null>(() =>
    getAdminSession(),
  )
  const [path, setPath] = useState(() => window.location.pathname)
  const [isRestoringAdminSession, setIsRestoringAdminSession] = useState(
    () => window.location.pathname.startsWith('/admin') && !getAdminSession() && hasStoredAdminUser(),
  )
  const replacePath = useCallback((nextPath: string) => {
    if (window.location.pathname !== nextPath) {
      window.history.replaceState(null, '', nextPath)
    }

    setPath(nextPath)
  }, [])

  const handleLogout = async () => {
    const accessToken = adminSession?.accessToken
    clearAdminSession()
    setAdminSession(null)
    replacePath(ADMIN_LOGIN_PATH)

    if (accessToken) {
      await logoutAdmin(accessToken)
    }
  }

  useEffect(() => {
    const handleSessionExpired = () => {
      clearAdminSession()
      setAdminSession(null)
      setIsRestoringAdminSession(false)
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
    if (!path.startsWith('/admin') || adminSession || !hasStoredAdminUser()) {
      setIsRestoringAdminSession(false)
      return
    }

    let isCancelled = false
    setIsRestoringAdminSession(true)

    void refreshAdminSession()
      .then((session) => {
        if (isCancelled) return

        setAdminSession(session)

        if (path === ADMIN_LOGIN_PATH || path === '/admin' || path === '/admin/') {
          replacePath(session.user.mustChangePassword ? '/admin/change-password' : ADMIN_DEFAULT_PATH)
        }
      })
      .catch(() => {
        if (isCancelled) return

        clearAdminSession()
        setAdminSession(null)
        replacePath(ADMIN_LOGIN_PATH)
      })
      .finally(() => {
        if (!isCancelled) {
          setIsRestoringAdminSession(false)
        }
      })

    return () => {
      isCancelled = true
    }
  }, [adminSession, path, replacePath])

  const adminAccessToken = adminSession?.accessToken
  const adminMustChangePassword = adminSession?.user.mustChangePassword

  useEffect(() => {
    if (!path.startsWith('/admin') || !adminAccessToken || adminMustChangePassword) {
      return
    }

    let isCancelled = false
    let isSyncing = false
    const accessToken = adminAccessToken

    const expireSession = () => {
      window.dispatchEvent(new Event('admin-session-expired'))
    }

    const syncAdminUser = async () => {
      if (isSyncing) return
      isSyncing = true

      try {
        const user = await getCurrentAdminUser(accessToken)
        if (isCancelled) return

        const currentSession = getAdminSession()
        if (!currentSession || currentSession.accessToken !== accessToken) return
        if (haveSameAdminUser(currentSession.user, user)) return

        const nextSession = { ...currentSession, user }
        saveAdminSession(nextSession)
        setAdminSession(nextSession)
      } catch (error) {
        if (isCancelled) return

        if (error instanceof AdminAuthError && error.status === 401) {
          try {
            const refreshedSession = await refreshAdminSession()
            if (!isCancelled) setAdminSession(refreshedSession)
          } catch {
            if (!isCancelled) expireSession()
          }
        } else if (error instanceof AdminAuthError && error.status === 403) {
          expireSession()
        }
      } finally {
        isSyncing = false
      }
    }

    void syncAdminUser()
    const intervalId = window.setInterval(() => void syncAdminUser(), ADMIN_SESSION_SYNC_INTERVAL_MS)
    window.addEventListener('focus', syncAdminUser)

    return () => {
      isCancelled = true
      window.clearInterval(intervalId)
      window.removeEventListener('focus', syncAdminUser)
    }
  }, [adminAccessToken, adminMustChangePassword, path])

  useEffect(() => {
    if (!path.startsWith('/admin')) {
      return
    }

    if (!adminSession) {
      if (isRestoringAdminSession) {
        return
      }

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
  }, [adminSession, isRestoringAdminSession, path, replacePath])

  if (!path.startsWith('/admin')) {
    const policyMatch = path.match(/^\/policies\/(terms|privacy|shipping|returns|complaints)\/?$/)
    if (policyMatch) {
      return <PolicyPage policyKey={policyMatch[1] as 'terms' | 'privacy' | 'shipping' | 'returns' | 'complaints'} />
    }

    if (path.startsWith('/support') || path.startsWith('/account/support')) {
      return <SupportPage />
    }

    if (path === '/' || path === '') {
      return <HomePage />
    }

    if (path === '/account') {
      return <ProfilePage />
    }

    if (path === '/account/orders') return <AccountOrdersPage />
    if (path === '/account/reviews') return <MyReviewsPage />

    if (path === '/cart' || path === '/cart/') {
      return <CartPage />
    }

    const orderDetailMatch = path.match(/^\/orders\/([^/]+)\/?$/)
    if (orderDetailMatch) {
      return <OrderDetailPage orderId={decodeURIComponent(orderDetailMatch[1])} />
    }

    if (/^\/products\/[^/]+\/?$/.test(path)) {
      return <ProductDetailPage />
    }

    if (path === '/products' || path === '/products/') {
      return <ProductListPage />
    }

    return <HomePage />
  }

  const handleLoginSuccess = (session: AdminSession) => {
    setAdminSession(session)
    replacePath(session.user.mustChangePassword ? '/admin/change-password' : ADMIN_DEFAULT_PATH)
  }

  if (!adminSession) {
    if (isRestoringAdminSession) {
      return (
        <main className="admin-login-page">
          <section className="admin-login-panel" aria-label="Đang khôi phục phiên quản trị">
            <div className="admin-login-heading">
              <p>Admin Portal</p>
              <h1>Đang khôi phục phiên...</h1>
            </div>
          </section>
        </main>
      )
    }

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
