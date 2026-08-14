import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import {
  BarChart3,
  Bell,
  Boxes,
  CreditCard,
  Crown,
  Gauge,
  Headset,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShieldCheck,
  Shirt,
  ShoppingCart,
  Search,
  Star,
  Tags,
  TicketPercent,
  Truck,
  Users,
  WandSparkles,
  type LucideIcon,
} from 'lucide-react'
import { hasPermission, type AdminUser } from '../modules/auth/adminSession'
import {
  IMPLEMENTED_ADMIN_ROUTE_IDS,
  adminRouteGroups,
  adminRoutes,
  getAdminRouteByPath,
  type AdminRoute,
  type AdminRouteId,
} from '../config/adminRoutes'
import { NotificationProvider } from '../notifications/NotificationProvider'
import { NotificationSummaryProvider } from '../notifications/NotificationSummaryProvider'
import { useNotificationSummary } from '../notifications/notification-summary-context'
import type { NotificationSummary } from '../notifications/notification-summary.types'
import { CommandMenu, type CommandMenuItem } from '../components/ui'
import { ADMIN_NAVIGATION_EVENT, notifyAdminNavigation } from '../services/adminNavigation'
import shopNameImage from '../../../assets/images/ShopName.png'

const ManagerListPage = lazy(() =>
  import('../modules/managers/ManagerListPage').then((module) => ({ default: module.ManagerListPage })),
)
const CatalogManagementPage = lazy(() =>
  import('../modules/catalog/CatalogManagementPage').then((module) => ({ default: module.CatalogManagementPage })),
)
const CustomerListPage = lazy(() =>
  import('../modules/customers/CustomerListPage').then((module) => ({ default: module.CustomerListPage })),
)
const LoyaltyPage = lazy(() =>
  import('../modules/loyalty/LoyaltyPage').then((module) => ({ default: module.LoyaltyPage })),
)
const PromotionsPage = lazy(() =>
  import('../modules/promotions/PromotionsPage').then((module) => ({ default: module.PromotionsPage })),
)
const OrderListPage = lazy(() =>
  import('../modules/orders/OrderListPage').then((module) => ({ default: module.OrderListPage })),
)
const ProductManagementPage = lazy(() =>
  import('../modules/catalog/products/ProductManagementPage').then((module) => ({ default: module.ProductManagementPage })),
)
const InventoryManagementPage = lazy(() =>
  import('../modules/inventory/InventoryManagementPage').then((module) => ({ default: module.InventoryManagementPage })),
)
const ReviewManagementPage = lazy(() =>
  import('../modules/reviews/ReviewManagementPage').then((module) => ({ default: module.ReviewManagementPage })),
)
const SupportManagementPage = lazy(() =>
  import('../modules/support/SupportManagementPage').then((module) => ({ default: module.SupportManagementPage })),
)
const VirtualTryOnManagementPage = lazy(() =>
  import('../modules/virtual-try-on/VirtualTryOnManagementPage').then((module) => ({ default: module.VirtualTryOnManagementPage })),
)
const RecommendationReportsPage = lazy(() =>
  import('../modules/reports/RecommendationReportsPage').then((module) => ({ default: module.RecommendationReportsPage })),
)
const AdminDashboardPage = lazy(() =>
  import('../modules/dashboard/AdminDashboardPage').then((module) => ({ default: module.AdminDashboardPage })),
)
const StorefrontSettingsPage = lazy(() =>
  import('../modules/settings/StorefrontSettingsPage').then((module) => ({ default: module.StorefrontSettingsPage })),
)

type AdminLayoutProps = {
  currentUser: AdminUser
  onLogout: () => void
}

type NavId = AdminRouteId
const ADMIN_SIDEBAR_COLLAPSED_KEY = 'admin.sidebar.collapsed'
const adminContentFallback = (
  <div className="admin-content-loading" role="status">
    Đang tải màn hình...
  </div>
)

type NavItem = AdminRoute & {
  icon: LucideIcon
  isImplemented: boolean
}

const navIcons: Record<NavId, LucideIcon> = {
  overview: Gauge,
  accounts: ShieldCheck,
  customers: Users,
  loyalty: Crown,
  products: Shirt,
  catalog: Tags,
  orders: ShoppingCart,
  ordersLookup: Search,
  ordersOnline: CreditCard,
  ordersCod: Truck,
  inventory: Boxes,
  promotions: TicketPercent,
  reviews: Star,
  support: Headset,
  virtualTryOn: WandSparkles,
  reports: BarChart3,
  settings: Settings,
}

const implementedAdminRouteIds = new Set<NavId>(IMPLEMENTED_ADMIN_ROUTE_IDS)

const isImplementedRoute = (routeId: NavId) => implementedAdminRouteIds.has(routeId)

const navItems: NavItem[] = adminRoutes.map((route) => ({
  ...route,
  icon: navIcons[route.id],
  isImplemented: isImplementedRoute(route.id),
}))

const routePermissions: Partial<Record<NavId, string>> = {
  accounts: 'admin',
  customers: 'customers.read',
  loyalty: 'loyalty.read',
  products: 'products.read',
  catalog: 'catalog.read',
  orders: 'orders.read',
  ordersLookup: 'orders.read',
  ordersOnline: 'orders.read',
  ordersCod: 'orders.read',
  inventory: 'inventory.read',
  promotions: 'promotions.read',
  reviews: 'reviews.read',
  support: 'support.reply',
  virtualTryOn: 'virtual_try_on.read',
  reports: 'reports.read',
  settings: 'admin',
}

const navHelperOverrides: Partial<Record<NavId, string>> = {
  orders: 'Xử lý & giao hàng',
  ordersLookup: 'Tra cứu & hóa đơn',
  ordersOnline: 'Đối soát online',
}

const getNavHelper = (item: NavItem) => navHelperOverrides[item.id] ?? item.helper

const canAccessRoute = (user: AdminUser, route: NavItem) => {
  if (user.role === 'admin') {
    return true
  }

  if (route.id === 'overview') {
    return true
  }

  if (route.id === 'virtualTryOn') {
    return [
      'virtual_try_on.read',
      'virtual_try_on.manage',
      'virtual_try_on.settings',
    ].some((permission) => hasPermission(user, permission))
  }

  const requiredPermission = routePermissions[route.id]
  if (!requiredPermission || requiredPermission === 'admin') {
    return false
  }

  return hasPermission(user, requiredPermission)
}

const canEnterRoute = (user: AdminUser, route: NavItem) =>
  route.isImplemented && canAccessRoute(user, route)

const getActiveSectionFromPath = () => {
  if (window.location.pathname === '/admin/orders/online' || window.location.pathname === '/admin/orders/cod') {
    return 'orders'
  }

  const route = getAdminRouteByPath(window.location.pathname)

  return route && isImplementedRoute(route.id) ? route.id : 'overview'
}

const getCurrentAdminLocation = () => ({
  pathname: window.location.pathname,
  search: window.location.search,
})

const getOrdersAliasTarget = (pathname: string, search: string) => {
  const section = pathname === '/admin/orders/cod'
    ? 'cod'
    : pathname === '/admin/orders/online'
      ? 'online'
      : null

  if (!section) return null

  const params = new URLSearchParams(search)
  params.set('section', section)
  const query = params.toString()

  return `/admin/orders${query ? `?${query}` : ''}`
}

const getRouteNavigationTarget = (route: AdminRoute) =>
  getOrdersAliasTarget(route.path, '') ?? route.path

const getStoredSidebarCollapsed = () => {
  try {
    return window.localStorage.getItem(ADMIN_SIDEBAR_COLLAPSED_KEY) === 'true'
  } catch {
    return false
  }
}

export function AdminLayout(props: AdminLayoutProps) {
  return (
    <NotificationProvider>
      <NotificationSummaryProvider>
        <AdminWorkspace {...props} />
      </NotificationSummaryProvider>
    </NotificationProvider>
  )
}

function AdminWorkspace({ currentUser, onLogout }: AdminLayoutProps) {
  const [activeSection, setActiveSection] = useState<NavId>(() => getActiveSectionFromPath())
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(getStoredSidebarCollapsed)
  const [currentLocation, setCurrentLocation] = useState(getCurrentAdminLocation)
  const notificationCenterRef = useRef<HTMLDivElement>(null)
  const { summary, loading: notificationLoading, error: notificationError, refresh } = useNotificationSummary()
  const displayName = currentUser.name || currentUser.email
  const avatarText = displayName.trim().charAt(0).toUpperCase() || 'A'
  const visibleNavItems = navItems.filter((item) => canAccessRoute(currentUser, item))
  const enterableNavItems = visibleNavItems.filter((item) => canEnterRoute(currentUser, item))
  const visibleNavGroups = adminRouteGroups
    .map((group) => ({
      ...group,
      items: visibleNavItems.filter((item) => item.group === group.id),
    }))
    .filter((group) => group.items.length > 0)
  const fallbackRoute = enterableNavItems[0]
  const activeRoute = enterableNavItems.find((item) => item.id === activeSection) ?? fallbackRoute
  const fallbackRouteId = fallbackRoute?.id
  const fallbackRoutePath = fallbackRoute?.path
  const renderedSection = activeRoute?.id
  const groupLabelById = new Map(adminRouteGroups.map((group) => [group.id, group.label]))

  const navigateToTarget = (item: NavItem, target = getRouteNavigationTarget(item)) => {
    setNotificationsOpen(false)
    setCommandOpen(false)
    setActiveSection(item.id === 'ordersOnline' || item.id === 'ordersCod' ? 'orders' : item.id)

    if (`${window.location.pathname}${window.location.search}` !== target) {
      window.history.pushState(null, '', target)
      notifyAdminNavigation()
    }
  }

  const getEnterableRoute = (routeId: NavId) => enterableNavItems.find((item) => item.id === routeId)
  const quickCommandItems: CommandMenuItem[] = []
  const ordersRoute = getEnterableRoute('orders')
  const ordersLookupRoute = getEnterableRoute('ordersLookup')
  const promotionsRoute = getEnterableRoute('promotions')
  const supportRoute = getEnterableRoute('support')

  if (ordersRoute) {
    quickCommandItems.push({
      key: 'quick-orders-packing',
      label: 'Đơn cần đóng gói',
      description: 'Mở queue vận hành đang chờ xử lý',
      group: 'Thao tác nhanh',
      onSelect: () => navigateToTarget(ordersRoute, '/admin/orders?queue=packing'),
    })
  }

  if (ordersLookupRoute) {
    quickCommandItems.push({
      key: 'quick-orders-lookup',
      label: 'Tra cứu đơn hàng',
      description: 'Mở bộ lọc đầy đủ và saved view',
      group: 'Thao tác nhanh',
      onSelect: () => navigateToTarget(ordersLookupRoute),
    })
  }

  if (promotionsRoute) {
    quickCommandItems.push({
      key: 'quick-create-coupon',
      label: 'Tạo voucher',
      description: 'Mở nhanh màn khuyến mãi',
      group: 'Thao tác nhanh',
      onSelect: () => navigateToTarget(promotionsRoute, '/admin/promotions?action=create'),
    })
  }

  if (supportRoute) {
    quickCommandItems.push({
      key: 'quick-support-open',
      label: 'Ticket đang mở',
      description: 'Nhảy về hàng đợi CSKH',
      group: 'Thao tác nhanh',
      onSelect: () => navigateToTarget(supportRoute),
    })
  }
  const commandItems: CommandMenuItem[] = [
    ...quickCommandItems,
    ...enterableNavItems.map((item) => ({
      key: item.id,
      label: item.label,
      description: item.helper,
      group: groupLabelById.get(item.group),
      onSelect: () => navigateToTarget(item),
    })),
  ]

  useEffect(() => {
    const syncSectionWithPath = () => {
      const aliasTarget = getOrdersAliasTarget(window.location.pathname, window.location.search)

      if (aliasTarget) {
        window.history.replaceState(null, '', aliasTarget)
        setCurrentLocation(getCurrentAdminLocation())
        setActiveSection('orders')
        return
      }

      setCurrentLocation(getCurrentAdminLocation())
      const currentRoute = getAdminRouteByPath(window.location.pathname)

      if (
        currentRoute &&
        isImplementedRoute(currentRoute.id) &&
        canAccessRoute(currentUser, { ...currentRoute, icon: navIcons[currentRoute.id], isImplemented: true })
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

  useEffect(() => {
    if (!notificationsOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!notificationCenterRef.current?.contains(event.target as Node)) {
        setNotificationsOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNotificationsOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [notificationsOpen])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setNotificationsOpen(false)
        setCommandOpen((open) => !open)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(ADMIN_SIDEBAR_COLLAPSED_KEY, String(isSidebarCollapsed))
    } catch {
      // Ignore storage failures; collapse still works for the current session.
    }
  }, [isSidebarCollapsed])

  const handleNavigate = (item: NavItem) => {
    navigateToTarget(item)
  }

  const handleNotificationNavigate = (item: NavItem, queue?: string) => {
    const baseTarget = getRouteNavigationTarget(item)
    const target = queue
      ? `${baseTarget}${baseTarget.includes('?') ? '&' : '?'}queue=${encodeURIComponent(queue)}`
      : baseTarget
    setNotificationsOpen(false)
    setActiveSection(item.id === 'ordersOnline' || item.id === 'ordersCod' ? 'orders' : item.id)

    if (`${window.location.pathname}${window.location.search}` !== target) {
      window.history.pushState(null, '', target)
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

    if (renderedSection === 'overview') {
      return <AdminDashboardPage currentUser={currentUser} />
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
      const searchParams = new URLSearchParams(currentLocation.search)
      const initialTabKey = searchParams.get('queue') ?? undefined
      const sectionParam = searchParams.get('section')
      const paymentSection = sectionParam === 'cod' ? 'cod' : sectionParam === 'online' ? 'online' : 'all'

      return (
        <OrderListPage
          key={`orders-${paymentSection}-${initialTabKey ?? 'packing'}`}
          currentUser={currentUser}
          paymentSection={paymentSection}
          lockPaymentSection
          initialTabKey={initialTabKey}
        />
      )
    }

    if (renderedSection === 'ordersLookup') {
      const initialTabKey = new URLSearchParams(currentLocation.search).get('queue') ?? undefined
      return <OrderListPage key={`orders-lookup-${initialTabKey ?? 'all'}`} currentUser={currentUser} initialTabKey={initialTabKey} />
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

    if (renderedSection === 'reviews') {
      return <ReviewManagementPage currentUser={currentUser} />
    }

    if (renderedSection === 'support') {
      return <SupportManagementPage currentUser={currentUser} />
    }

    if (renderedSection === 'virtualTryOn') {
      return <VirtualTryOnManagementPage currentUser={currentUser} />
    }

    if (renderedSection === 'reports') {
      return <RecommendationReportsPage currentUser={currentUser} />
    }

    if (renderedSection === 'settings') {
      return <StorefrontSettingsPage />
    }

    const enterableRoute = enterableNavItems.find((item) => item.id === renderedSection)
    const pendingRoute = visibleNavItems.find((item) => item.id === renderedSection)

    if (pendingRoute && !pendingRoute.isImplemented) {
      return (
        <section className="admin-placeholder-page">
          <p>{pendingRoute.helper}</p>
          <h1>{pendingRoute.label}</h1>
          <span className="admin-placeholder-note">Khu vực này đang được hoàn thiện. Vui lòng quay lại sau.</span>
        </section>
      )
    }

    if (!enterableRoute && pendingRoute) {
      return (
        <section className="admin-placeholder-page">
          <p>{pendingRoute.helper}</p>
          <h1>{pendingRoute.label}</h1>
          <span className="admin-placeholder-note">Bạn không có quyền truy cập khu vực này.</span>
        </section>
      )
    }

    return null
  }

  const notificationItems = buildNotificationItems(summary)
  const totalNotifications = summary?.total ?? 0

  return (
    <main className={`admin-layout${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
      <aside className="admin-sidebar" aria-label="Admin navigation">
        <div className="admin-brand">
          <span className="admin-brand-logo-frame">
            <img src={shopNameImage} alt="CD Shop" />
          </span>
          <div className="admin-brand-row">
            <span className="admin-brand-copy">
              <strong>CD Shop</strong>
              <small>Admin Workspace</small>
            </span>
            <button
              className="admin-sidebar-toggle"
              type="button"
              aria-label={isSidebarCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
              title={isSidebarCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
              onClick={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
            >
              {isSidebarCollapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
            </button>
          </div>
        </div>

        <nav className="admin-nav">
          {visibleNavGroups.map((group) => (
            <section className="admin-nav-group" key={group.id} aria-label={group.label}>
              <span className="admin-nav-group-label">{group.label}</span>
              {group.items.map((item) => {
                const Icon = item.icon
                const orderSectionParam = new URLSearchParams(currentLocation.search).get('section')
                const isOrderPaymentRoute = item.id === 'ordersOnline' || item.id === 'ordersCod'
                const isActive = isOrderPaymentRoute
                  ? renderedSection === 'orders' &&
                    orderSectionParam === (item.id === 'ordersCod' ? 'cod' : 'online')
                  : item.id === renderedSection
                const isDisabled = !item.isImplemented
                const notificationBadge = getNavNotificationBadge(item.id, summary)
                const navHelper = getNavHelper(item)

                return (
                  <button
                    aria-current={isActive ? 'page' : undefined}
                    aria-disabled={isDisabled || undefined}
                    aria-label={`${item.label}: ${navHelper}`}
                    className={`admin-nav-item${isOrderPaymentRoute ? ' is-child' : ''}${isActive ? ' is-active' : ''}${isDisabled ? ' is-disabled' : ''}`}
                    type="button"
                    key={item.id}
                    title={navHelper}
                    onClick={() => (isDisabled ? undefined : handleNavigate(item))}
                  >
                    <Icon />
                    <span>
                      <strong>
                        {item.label}
                        {isDisabled ? <em className="admin-nav-badge">Sắp ra mắt</em> : null}
                      </strong>
                      <small>{navHelper}</small>
                    </span>
                    {!isDisabled && notificationBadge ? (
                      <em
                        className={`admin-nav-notification-badge is-${notificationBadge.tone}${notificationBadge.dot ? ' is-dot' : ''}`}
                        aria-label={notificationBadge.label}
                      >
                        {notificationBadge.dot ? '' : formatBadgeCount(notificationBadge.count)}
                      </em>
                    ) : null}
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

          <button
            className="admin-command-trigger"
            type="button"
            aria-label="Tìm kiếm nhanh trong admin"
            aria-expanded={commandOpen}
            onClick={() => {
              setNotificationsOpen(false)
              setCommandOpen(true)
            }}
          >
            <span>Tìm kiếm hoặc nhảy nhanh</span>
            <kbd>Ctrl K</kbd>
          </button>

          <div className="admin-topbar-actions">
            <div className="admin-notification-center" ref={notificationCenterRef}>
              <button
                className="admin-icon-button admin-notification-trigger"
                type="button"
                aria-label={totalNotifications > 0 ? `${totalNotifications} việc cần chú ý` : 'Không có việc mới cần chú ý'}
                aria-expanded={notificationsOpen}
                aria-controls="admin-notification-panel"
                onClick={() => setNotificationsOpen((open) => !open)}
              >
                <Bell aria-hidden="true" />
                {totalNotifications > 0 ? (
                  <span className="admin-notification-total" aria-hidden="true">
                    {formatBadgeCount(totalNotifications)}
                  </span>
                ) : null}
              </button>

              {notificationsOpen ? (
                <section id="admin-notification-panel" className="admin-notification-panel" aria-label="Việc cần chú ý">
                  <header>
                    <div>
                      <strong>Việc cần chú ý</strong>
                      <span>{summary ? `Cập nhật ${formatUpdatedAt(summary.generatedAt)}` : 'Đang đồng bộ dữ liệu'}</span>
                    </div>
                    <button type="button" disabled={notificationLoading} onClick={() => void refresh()}>
                      {notificationLoading ? 'Đang tải…' : 'Làm mới'}
                    </button>
                  </header>

                  {notificationError && !summary ? (
                    <div className="admin-notification-error" role="alert">
                      <span>{notificationError}</span>
                      <button type="button" onClick={() => void refresh()}>Thử lại</button>
                    </div>
                  ) : notificationItems.length ? (
                    <div className="admin-notification-list">
                      {notificationItems.map((notification) => {
                        const route = navItems.find((item) => item.id === notification.routeId)
                        if (!route || !canEnterRoute(currentUser, route)) return null

                        return (
                          <button type="button" key={notification.key} onClick={() => handleNotificationNavigate(route, notification.queue)}>
                            <span className={`admin-notification-item-icon is-${notification.tone}`} aria-hidden="true" />
                            <span>
                              <strong>{notification.title}</strong>
                              <small>{notification.detail}</small>
                            </span>
                            <em>{formatBadgeCount(notification.count)}</em>
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="admin-notification-empty">
                      <strong>Đã xử lý hết rồi</strong>
                      <span>Hiện không có việc tồn đọng cần chú ý.</span>
                    </div>
                  )}
                </section>
              ) : null}
            </div>

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

        <div className="admin-content">
          <Suspense fallback={adminContentFallback}>
            {renderContent()}
          </Suspense>
        </div>
      </section>
      <CommandMenu
        isOpen={commandOpen}
        items={commandItems}
        onClose={() => setCommandOpen(false)}
      />
    </main>
  )
}

type NotificationTone = 'danger' | 'warning' | 'info'

type NavNotificationBadge = {
  count: number
  tone: NotificationTone
  label: string
  dot?: boolean
}

const formatBadgeCount = (count: number) => count > 99 ? '99+' : String(count)

const formatUpdatedAt = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'vừa xong'
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(date)
}

const getNavNotificationBadge = (
  routeId: NavId,
  summary: NotificationSummary | null,
): NavNotificationBadge | null => {
  if (!summary) return null

  const badges: Partial<Record<NavId, NavNotificationBadge>> = {
    orders: summary.orders.total > 0
      ? { count: summary.orders.total, tone: 'danger', label: `${summary.orders.total} đơn cần xử lý` }
      : undefined,
    ordersOnline: summary.orders.online > 0
      ? { count: summary.orders.online, tone: 'danger', label: `${summary.orders.online} đơn online cần xử lý` }
      : undefined,
    ordersCod: summary.orders.cod > 0
      ? { count: summary.orders.cod, tone: 'danger', label: `${summary.orders.cod} đơn COD cần xử lý` }
      : undefined,
    inventory: summary.lowStockVariants > 0
      ? { count: summary.lowStockVariants, tone: 'warning', label: `${summary.lowStockVariants} biến thể tồn kho thấp` }
      : undefined,
    promotions: summary.expiringCoupons > 0
      ? { count: summary.expiringCoupons, tone: 'warning', label: `${summary.expiringCoupons} voucher sắp hết hạn`, dot: true }
      : undefined,
    support: summary.supportOpen > 0
      ? { count: summary.supportOpen, tone: 'danger', label: `${summary.supportOpen} ticket chờ phản hồi` }
      : undefined,
    reviews: summary.reviewsPending > 0
      ? { count: summary.reviewsPending, tone: 'warning', label: `${summary.reviewsPending} đánh giá chờ duyệt` }
      : undefined,
  }

  return badges[routeId] ?? null
}

const buildNotificationItems = (summary: NotificationSummary | null) => {
  if (!summary) return []

  return [
    summary.paymentDeadlineSoon > 0 ? {
      key: 'orders-payment-deadline',
      routeId: 'orders' as NavId,
      title: 'Sắp hết hạn thanh toán',
      detail: `${summary.paymentDeadlineSoon} đơn online sắp tự hủy trong 24 giờ tới`,
      count: summary.paymentDeadlineSoon,
      queue: 'payment-deadline',
      tone: 'warning' as NotificationTone,
    } : null,
    summary.orders.confirmed > 0 ? {
      key: 'orders-confirmed',
      routeId: 'orders' as NavId,
      title: 'Đơn mới chờ đóng gói',
      detail: `${summary.orders.confirmed} đơn đã xác nhận cần tiếp tục xử lý`,
      count: summary.orders.confirmed,
      queue: 'packing',
      tone: 'danger' as NotificationTone,
    } : null,
    summary.orders.packed > 0 ? {
      key: 'orders-packed',
      routeId: 'orders' as NavId,
      title: 'Đơn chờ bàn giao',
      detail: `${summary.orders.packed} đơn đã đóng gói đang chờ giao`,
      count: summary.orders.packed,
      queue: 'handoff',
      tone: 'danger' as NotificationTone,
    } : null,
    summary.orders.returnRequested > 0 ? {
      key: 'orders-return',
      routeId: 'orders' as NavId,
      title: 'Yêu cầu trả hàng',
      detail: `${summary.orders.returnRequested} yêu cầu đang chờ duyệt`,
      count: summary.orders.returnRequested,
      queue: 'review',
      tone: 'danger' as NotificationTone,
    } : null,
    summary.lowStockVariants > 0 ? {
      key: 'inventory-low',
      routeId: 'inventory' as NavId,
      title: 'Tồn kho thấp',
      detail: `${summary.lowStockVariants} biến thể còn không quá 5 sản phẩm`,
      count: summary.lowStockVariants,
      tone: 'warning' as NotificationTone,
    } : null,
    summary.expiringCoupons > 0 ? {
      key: 'coupons-expiring',
      routeId: 'promotions' as NavId,
      title: 'Voucher sắp hết hạn',
      detail: `${summary.expiringCoupons} voucher sẽ hết hạn trong 3 ngày`,
      count: summary.expiringCoupons,
      tone: 'warning' as NotificationTone,
    } : null,
    summary.supportOpen > 0 ? {
      key: 'support-open',
      routeId: 'support' as NavId,
      title: 'Ticket chờ phản hồi',
      detail: `${summary.supportOpen} ticket khách hàng đang chờ xử lý`,
      count: summary.supportOpen,
      tone: 'danger' as NotificationTone,
    } : null,
    summary.reviewsPending > 0 ? {
      key: 'reviews-pending',
      routeId: 'reviews' as NavId,
      title: 'Đánh giá chờ duyệt',
      detail: `${summary.reviewsPending} đánh giá cần kiểm tra trước khi hiển thị`,
      count: summary.reviewsPending,
      tone: 'warning' as NotificationTone,
    } : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null)
}
