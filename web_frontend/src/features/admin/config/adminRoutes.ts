export type AdminRouteId =
  | 'overview'
  | 'accounts'
  | 'customers'
  | 'loyalty'
  | 'products'
  | 'catalog'
  | 'orders'
  | 'ordersLookup'
  | 'ordersOnline'
  | 'ordersCod'
  | 'inventory'
  | 'promotions'
  | 'reviews'
  | 'support'
  | 'virtualTryOn'
  | 'reports'
  | 'settings'

export type AdminRoute = {
  id: AdminRouteId
  path: string
  label: string
  helper: string
  group: AdminRouteGroupId
  isImplemented?: boolean
}

export type AdminRouteGroupId =
  | 'dashboard'
  | 'sales'
  | 'catalog'
  | 'customers'
  | 'marketing'
  | 'service'
  | 'insights'
  | 'system'

export type AdminRouteGroup = {
  id: AdminRouteGroupId
  label: string
}

export const ADMIN_LOGIN_PATH = '/admin/login'
export const ADMIN_DEFAULT_PATH = '/admin/orders'

export const IMPLEMENTED_ADMIN_ROUTE_IDS: AdminRouteId[] = [
  'accounts',
  'customers',
  'loyalty',
  'products',
  'catalog',
  'orders',
  'ordersLookup',
  'ordersOnline',
  'ordersCod',
  'inventory',
  'promotions',
  'reviews',
  'support',
  'virtualTryOn',
]

export const adminRouteGroups: AdminRouteGroup[] = [
  { id: 'dashboard', label: 'Tổng quan' },
  { id: 'sales', label: 'Bán hàng' },
  { id: 'catalog', label: 'Sản phẩm' },
  { id: 'customers', label: 'Khách hàng' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'service', label: 'CSKH' },
  { id: 'insights', label: 'Báo cáo' },
  { id: 'system', label: 'Hệ thống' },
]

const implementedAdminRouteIdSet = new Set<AdminRouteId>(IMPLEMENTED_ADMIN_ROUTE_IDS)

const adminRouteRecords: AdminRoute[] = [
  {
    id: 'overview',
    path: '/admin/dashboard',
    label: 'Tổng quan',
    helper: 'Tình hình vận hành',
    group: 'dashboard',
  },
  {
    id: 'accounts',
    path: '/admin/accounts',
    label: 'Nhân sự & phân quyền',
    helper: 'Tài khoản quản trị',
    group: 'system',
  },
  {
    id: 'customers',
    path: '/admin/customers',
    label: 'Khách hàng',
    helper: 'Người dùng mua hàng',
    group: 'customers',
  },
  {
    id: 'loyalty',
    path: '/admin/loyalty',
    label: 'Chương trình thành viên',
    helper: 'Hạng, điểm & quyền lợi',
    group: 'customers',
  },
  {
    id: 'products',
    path: '/admin/products',
    label: 'Sản phẩm',
    helper: 'Danh sách & biến thể',
    group: 'catalog',
  },
  {
    id: 'catalog',
    path: '/admin/catalog',
    label: 'Danh mục',
    helper: 'Danh mục & thương hiệu',
    group: 'catalog',
  },
  {
    id: 'orders',
    path: '/admin/orders',
    label: 'Vận hành đơn hàng',
    helper: 'Xử lý đơn, thanh toán & giao hàng',
    group: 'sales',
  },
  {
    id: 'ordersLookup',
    path: '/admin/orders/lookup',
    label: 'Tra cứu đơn & hóa đơn',
    helper: 'Tìm mã đơn, khách hàng & vận chuyển',
    group: 'sales',
  },
  {
    id: 'ordersOnline',
    path: '/admin/orders/online',
    label: 'Đơn thanh toán online',
    helper: 'Đối soát trước khi xử lý giao',
    group: 'sales',
  },
  {
    id: 'ordersCod',
    path: '/admin/orders/cod',
    label: 'Đơn COD',
    helper: 'Thu tiền khi nhận hàng',
    group: 'sales',
  },
  {
    id: 'inventory',
    path: '/admin/inventory',
    label: 'Kho hàng',
    helper: 'Tồn kho & nhập kho',
    group: 'catalog',
  },
  {
    id: 'promotions',
    path: '/admin/promotions',
    label: 'Khuyến mãi',
    helper: 'Voucher & chiến dịch',
    group: 'marketing',
  },
  {
    id: 'reviews',
    path: '/admin/reviews',
    label: 'Đánh giá',
    helper: 'Bình luận sản phẩm',
    group: 'service',
  },
  {
    id: 'support',
    path: '/admin/support',
    label: 'Hỗ trợ',
    helper: 'Phiếu phản hồi',
    group: 'service',
  },
  {
    id: 'virtualTryOn',
    path: '/admin/virtual-try-on',
    label: 'Phối đồ ảo',
    helper: 'Job AI, quota & provider',
    group: 'service',
  },
  {
    id: 'reports',
    path: '/admin/reports',
    label: 'Báo cáo',
    helper: 'Doanh thu & hiệu quả',
    group: 'insights',
  },
  {
    id: 'settings',
    path: '/admin/settings',
    label: 'Cài đặt',
    helper: 'Cấu hình hệ thống',
    group: 'system',
  },
]

export const adminRoutes: AdminRoute[] = adminRouteRecords.map((route) => ({
  ...route,
  isImplemented: implementedAdminRouteIdSet.has(route.id),
}))

const normalizePathname = (pathname: string) => {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1)
  }

  return pathname
}

export const getAdminRouteByPath = (pathname: string) => {
  const normalizedPath = normalizePathname(pathname)

  if (normalizedPath === '/admin/users') {
    return adminRoutes.find((route) => route.id === 'customers')
  }

  return adminRoutes.find((route) => route.path === normalizedPath)
}

export const getAdminFallbackPath = (pathname: string) => {
  const normalizedPath = normalizePathname(pathname)

  if (normalizedPath === '/admin') {
    return ADMIN_DEFAULT_PATH
  }

  return getAdminRouteByPath(normalizedPath)?.path ?? ADMIN_DEFAULT_PATH
}
