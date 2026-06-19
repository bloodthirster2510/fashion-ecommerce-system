import { useEffect, useState, type ReactNode } from 'react'
import type { AdminUser } from '../modules/auth/adminSession'
import {
  IMPLEMENTED_ADMIN_ROUTE_IDS,
  adminRouteGroups,
  adminRoutes,
  getAdminRouteByPath,
  type AdminRoute,
  type AdminRouteId,
} from '../config/adminRoutes'
import { ManagerListPage } from '../modules/managers/ManagerListPage'
import { CatalogManagementPage } from '../modules/catalog/CatalogManagementPage'
import { CustomerListPage } from '../modules/customers/CustomerListPage'
import { LoyaltyPage } from '../modules/loyalty/LoyaltyPage'
import { PromotionsPage } from '../modules/promotions/PromotionsPage'
import { OrderListPage } from '../modules/orders/OrderListPage'
import { ProductManagementPage } from '../modules/catalog/products/ProductManagementPage'
import { InventoryManagementPage } from '../modules/inventory/InventoryManagementPage'

type AdminLayoutProps = {
  currentUser: AdminUser
  onLogout: () => void
}

type NavId = AdminRouteId
const ADMIN_NAVIGATION_EVENT = 'admin:navigation'

type NavItem = AdminRoute & {
  icon: () => ReactNode
}

const navIcons: Record<NavId, () => ReactNode> = {
  overview: DashboardIcon,
  accounts: ShieldUserIcon,
  customers: UsersIcon,
  loyalty: LoyaltyIcon,
  products: ProductsIcon,
  catalog: TagsIcon,
  orders: OrdersIcon,
  ordersOnline: PaymentOnlineIcon,
  ordersCod: PaymentCodIcon,
  inventory: InventoryIcon,
  promotions: CouponIcon,
  reviews: ReviewIcon,
  support: SupportIcon,
  reports: ReportsIcon,
  settings: SettingsIcon,
}

const implementedAdminRouteIds = new Set<NavId>(IMPLEMENTED_ADMIN_ROUTE_IDS)

const isImplementedRoute = (routeId: NavId) => implementedAdminRouteIds.has(routeId)

const navItems: NavItem[] = adminRoutes
  .filter((route) => isImplementedRoute(route.id))
  .map((route) => ({
    ...route,
    icon: navIcons[route.id],
  }))

const routePermissions: Partial<Record<NavId, string>> = {
  accounts: 'admin',
  customers: 'customers.read',
  loyalty: 'loyalty.read',
  products: 'products.read',
  catalog: 'catalog.read',
  orders: 'orders.read',
  ordersOnline: 'orders.read',
  ordersCod: 'orders.read',
  inventory: 'inventory.read',
  promotions: 'promotions.read',
  reviews: 'reviews.moderate',
  support: 'support.reply',
  reports: 'reports.read',
  settings: 'admin',
}

const canAccessRoute = (user: AdminUser, route: NavItem) => {
  if (user.role === 'admin') {
    return true
  }

  const requiredPermission = routePermissions[route.id]
  if (!requiredPermission || requiredPermission === 'admin') {
    return false
  }

  return user.permissions?.includes(requiredPermission) ?? false
}

const getActiveSectionFromPath = () => {
  const route = getAdminRouteByPath(window.location.pathname)

  return route && isImplementedRoute(route.id) ? route.id : 'orders'
}

const notifyAdminNavigation = () => {
  window.dispatchEvent(new Event(ADMIN_NAVIGATION_EVENT))
}

export function AdminLayout({ currentUser, onLogout }: AdminLayoutProps) {
  const [activeSection, setActiveSection] = useState<NavId>(() => getActiveSectionFromPath())
  const displayName = currentUser.name || currentUser.email
  const avatarText = displayName.trim().charAt(0).toUpperCase() || 'A'
  const visibleNavItems = navItems.filter((item) => canAccessRoute(currentUser, item))
  const visibleNavGroups = adminRouteGroups
    .map((group) => ({
      ...group,
      items: visibleNavItems.filter((item) => item.group === group.id),
    }))
    .filter((group) => group.items.length > 0)
  const fallbackRoute = visibleNavItems[0]
  const activeRoute = visibleNavItems.find((item) => item.id === activeSection) ?? fallbackRoute
  const fallbackRouteId = fallbackRoute?.id
  const fallbackRoutePath = fallbackRoute?.path
  const renderedSection = activeRoute?.id

  useEffect(() => {
    const syncSectionWithPath = () => {
      const currentRoute = getAdminRouteByPath(window.location.pathname)

      if (
        currentRoute &&
        isImplementedRoute(currentRoute.id) &&
        canAccessRoute(currentUser, { ...currentRoute, icon: navIcons[currentRoute.id] })
      ) {
        setActiveSection(currentRoute.id)
        return
      }

      if (!fallbackRouteId || !fallbackRoutePath) {
        return
      }

      if (window.location.pathname !== fallbackRoutePath) {
        window.history.replaceState(null, '', fallbackRoutePath)
        notifyAdminNavigation()
      }

      setActiveSection(fallbackRouteId)
    }

    syncSectionWithPath()
    window.addEventListener('popstate', syncSectionWithPath)
    window.addEventListener(ADMIN_NAVIGATION_EVENT, syncSectionWithPath)

    return () => {
      window.removeEventListener('popstate', syncSectionWithPath)
      window.removeEventListener(ADMIN_NAVIGATION_EVENT, syncSectionWithPath)
    }
  }, [currentUser, fallbackRouteId, fallbackRoutePath])

  const handleNavigate = (item: NavItem) => {
    setActiveSection(item.id)

    if (window.location.pathname !== item.path) {
      window.history.pushState(null, '', item.path)
      notifyAdminNavigation()
    }
  }

  const renderContent = () => {
    if (!renderedSection) {
      return (
        <div className="admin-empty-state" role="alert">
          <strong>Không có quyền truy cập</strong>
          <span>Liên hệ quản trị viên để được cấp quyền vào khu vực phù hợp.</span>
        </div>
      )
    }

    if (renderedSection === 'accounts') {
      return <ManagerListPage />
    }

    if (renderedSection === 'customers') {
      return <CustomerListPage currentUser={currentUser} />
    }

    if (renderedSection === 'loyalty') {
      return <LoyaltyPage currentUser={currentUser} />
    }

    if (renderedSection === 'promotions') {
      return <PromotionsPage currentUser={currentUser} />
    }

    if (renderedSection === 'orders') {
      return <OrderListPage currentUser={currentUser} />
    }

    if (renderedSection === 'ordersOnline') {
      return <OrderListPage currentUser={currentUser} paymentSection="online" lockPaymentSection />
    }

    if (renderedSection === 'ordersCod') {
      return <OrderListPage currentUser={currentUser} paymentSection="cod" lockPaymentSection />
    }

    if (renderedSection === 'catalog') {
      return <CatalogManagementPage currentUser={currentUser} />
    }

    if (renderedSection === 'products') {
      return <ProductManagementPage currentUser={currentUser} />
    }

    if (renderedSection === 'inventory') {
      return <InventoryManagementPage currentUser={currentUser} />
    }

    return null
  }

  return (
    <main className="admin-layout">
      <aside className="admin-sidebar" aria-label="Admin navigation">
        <div className="admin-brand">
          <strong>FASHIONISTA</strong>
          <span>Admin Workspace</span>
        </div>

        <nav className="admin-nav">
          {visibleNavGroups.map((group) => (
            <section className="admin-nav-group" key={group.id} aria-label={group.label}>
              <span className="admin-nav-group-label">{group.label}</span>
              {group.items.map((item) => {
                const Icon = item.icon
                const isActive = item.id === renderedSection
                const isOrderPaymentRoute = item.id === 'ordersOnline' || item.id === 'ordersCod'

                return (
                  <button
                    aria-current={isActive ? 'page' : undefined}
                    className={`admin-nav-item${isOrderPaymentRoute ? ' is-child' : ''}${isActive ? ' is-active' : ''}`}
                    type="button"
                    key={item.id}
                    onClick={() => handleNavigate(item)}
                  >
                    <Icon />
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.helper}</small>
                    </span>
                  </button>
                )
              })}
            </section>
          ))}
        </nav>
      </aside>

      <section className="admin-shell" aria-label="Admin workspace">
        <header className="admin-topbar">
          <div className="admin-topbar-title">
            <strong>{activeRoute?.label ?? 'Không có quyền truy cập'}</strong>
            <span>{activeRoute?.helper ?? 'Liên hệ quản trị viên để được cấp quyền'}</span>
          </div>

          <div className="admin-topbar-actions">
            <button className="admin-icon-button" type="button" aria-label="Thông báo">
              <BellIcon />
            </button>

            <div className="admin-profile-summary">
              <span className="admin-avatar" aria-hidden="true">
                {avatarText}
              </span>
              <div>
                <strong>{displayName}</strong>
                <span>{currentUser.role}</span>
              </div>
            </div>

            <button className="admin-logout-button" type="button" onClick={onLogout}>
              Đăng xuất
            </button>
          </div>
        </header>

        <div className="admin-content">{renderContent()}</div>
      </section>
    </main>
  )
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 22a2.8 2.8 0 0 0 2.7-2h-5.4A2.8 2.8 0 0 0 12 22Zm7-6-2-2.2V10a5 5 0 0 0-4-4.9V3h-2v2.1A5 5 0 0 0 7 10v3.8L5 16v2h14v-2Z" />
    </svg>
  )
}

function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 13h7V4H4v9Zm9 7h7v-7h-7v7ZM4 20h7v-5H4v5Zm13-16v5h-4V4h4Zm3 0v5h-2V4h2Zm-7 7h7v1h-7v-1Z" />
    </svg>
  )
}

function ShieldUserIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2 4 5.4v6.3c0 4.5 3.1 8.5 8 10.3 4.9-1.8 8-5.8 8-10.3V5.4L12 2Zm0 4.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Zm4.5 10.1h-9v-.9c0-2 1.8-3.4 4.5-3.4s4.5 1.4 4.5 3.4v.9Z" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8.5 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM2.5 19.5h11v-1.2c0-3-2.2-5.3-5.5-5.3s-5.5 2.3-5.5 5.3v1.2Zm12.6 0h6.4v-1c0-2.6-1.8-4.5-4.7-4.5-.8 0-1.5.1-2.1.4.8 1 1.2 2.3 1.2 3.8v1.3Z" />
    </svg>
  )
}

function LoyaltyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 5 6v5c0 4.8 3.1 8.6 7 10 3.9-1.4 7-5.2 7-10V6l-7-3Zm0 3.1 4 1.7V11c0 3.3-1.8 5.8-4 7-2.2-1.2-4-3.7-4-7V7.8l4-1.7Zm-1 3.4h2v2h2v2h-2v2h-2v-2H9v-2h2v-2Z" />
    </svg>
  )
}

function ProductsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 4h14l-1.2 16H6.2L5 4Zm3 4v2h8V8H8Zm0 4v2h6v-2H8Z" />
    </svg>
  )
}

function TagsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 4h7l9 9-7 7-9-9V4Zm4 5.5A1.5 1.5 0 1 0 8 6.5a1.5 1.5 0 0 0 0 3Zm5.5-5.5H16l6 6-2.2 2.2-6.3-6.3V4Z" />
    </svg>
  )
}

function OrdersIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 4h2.3l1.1 10.2A3 3 0 0 0 9.4 17H18v-2H9.4a1 1 0 0 1-1-.9L8.3 13h9.9a2 2 0 0 0 1.9-1.4L22 6H7.1L6.8 4H3v2Zm6 16a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm9 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
    </svg>
  )
}

function PaymentOnlineIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 6h18v12H3V6Zm2 2v2h14V8H5Zm0 5v3h14v-3H5Zm2 1h5v1H7v-1Zm10-9h2v2h-2V5Zm-4 0h2v2h-2V5Z" />
    </svg>
  )
}

function PaymentCodIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 6h16v12H4V6Zm2 2v8h12V8H6Zm6 1.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Zm-4 0h2v1H8v-1Zm6 5h2v1h-2v-1ZM3 10h2v4H3v-4Zm16 0h2v4h-2v-4Z" />
    </svg>
  )
}

function InventoryIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7 12 3l8 4v10l-8 4-8-4V7Zm3.1.2 4.9 2.5 4.9-2.5L12 4.8 7.1 7.2ZM6 8.8v7l5 2.5v-7L6 8.8Zm7 9.5 5-2.5v-7l-5 2.5v7Z" />
    </svg>
  )
}

function CouponIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 6h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4V6Zm5 4a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm6 7 3-8h-2l-3 8h2Zm.5 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
    </svg>
  )
}

function ReviewIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.9L12 3Z" />
    </svg>
  )
}

function SupportIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3a8 8 0 0 0-8 8v4a3 3 0 0 0 3 3h2v-7H6a6 6 0 1 1 12 0h-3v7h2.2A5.5 5.5 0 0 1 12 21v-2a3.5 3.5 0 0 0 3.5-3.5V11h2.5v4h-1v1a3 3 0 0 0 3-3v-2a8 8 0 0 0-8-8Z" />
    </svg>
  )
}

function ReportsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 20V4h2v16H5Zm6 0V9h2v11h-2Zm6 0V6h2v14h-2Z" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm8 4c0-.5-.1-1-.2-1.5l2-1.5-2-3.5-2.4 1a8 8 0 0 0-2.6-1.5L14.5 2h-5l-.4 2.5a8 8 0 0 0-2.6 1.5l-2.3-1-2 3.5 2 1.5A8 8 0 0 0 4 12c0 .5.1 1 .2 1.5l-2 1.5 2 3.5 2.3-1a8 8 0 0 0 2.6 1.5l.4 2.5h5l.4-2.5a8 8 0 0 0 2.6-1.5l2.4 1 2-3.5-2-1.5c.1-.5.1-1 .1-1.5Z" />
    </svg>
  )
}
