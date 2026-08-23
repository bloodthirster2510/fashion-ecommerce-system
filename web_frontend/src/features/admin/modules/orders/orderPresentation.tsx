import type {
  AdminAuditLog,
  AdminCustomerPaymentMethod,
  AdminOrder,
  AdminOrderPaymentMethod,
  AdminOrderPaymentStatus,
  AdminOrderStatus,
  AdminPaymentMethodStatus,
  AdminReturnRequestStatus,
  AdminTransaction,
} from './orderAdminApi'
import type {
  OrderTab,
  OrderTabGroupKey,
  PaymentSectionKey,
  ShippingSimulationStatus,
  ShippingUpdateDialogValues,
} from './orderTypes'
import { formatAdminDateTime } from '../../utils/dateTime'

export const pageSize = 10
export const returnWindowDays = 7

export const emptyStatusSummary: Record<AdminOrderStatus | 'all', number> = {
  all: 0,
  confirmed: 0,
  packed: 0,
  shipping: 0,
  delivered: 0,
  completed: 0,
  cancelled: 0,
  return_requested: 0,
  return_approved: 0,
  returned: 0,
}

export const emptyOperationalSummary = {
  returnRequests: 0,
  refunds: 0,
  paidReady: 0,
  packingReady: 0,
  handoffReady: 0,
  readyToProcess: 0,
  deliveryConfirmations: 0,
  paymentRisk: 0,
  paymentOverdueRisk: 0,
  paymentDeadlineSoon: 0,
  shippingMappingRequired: 0,
  totalPriority: 0,
}

export const codPaymentMethods: AdminOrderPaymentMethod[] = ['COD']
export const onlinePaymentMethods: AdminOrderPaymentMethod[] = ['VNPAY']
export const supportedPaymentMethods: AdminOrderPaymentMethod[] = ['COD', 'VNPAY']
export const allPaymentMethods: AdminOrderPaymentMethod[] = supportedPaymentMethods

export const paymentSections: Array<{
  key: PaymentSectionKey
  label: string
  helper: string
  methods: AdminOrderPaymentMethod[]
}> = [
  {
    key: 'all',
    label: 'Vận hành đơn hàng',
    helper: 'Theo dõi toàn bộ đơn cần xử lý, không giới hạn theo kênh thanh toán của đơn.',
    methods: supportedPaymentMethods,
  },
  {
    key: 'online',
    label: 'Đơn thanh toán online',
    helper: 'Chỉ xử lý giao hàng khi đã ghi nhận thanh toán VNPay. MoMo, thẻ và chuyển khoản chưa mở trong MVP.',
    methods: onlinePaymentMethods,
  },
  {
    key: 'cod',
    label: 'Đơn COD',
    helper: 'Đơn thu tiền khi nhận hàng, ưu tiên đóng gói, giao hàng và xác nhận đã giao.',
    methods: codPaymentMethods,
  },
]

export const getPaymentSectionMethods = (sectionKey: PaymentSectionKey) =>
  paymentSections.find((section) => section.key === sectionKey)?.methods ?? supportedPaymentMethods

export const orderTabs: OrderTab[] = [
  {
    key: 'packing',
    label: 'Cần đóng gói',
    helper: 'Đơn đã đủ điều kiện xử lý và đang chờ kiểm tra, đóng gói.',
    group: 'flow',
    statuses: ['confirmed'],
    queue: 'packing',
  },
  {
    key: 'handoff',
    label: 'Chờ bàn giao',
    helper: 'Đơn đã đóng gói, cần bàn giao cho đơn vị vận chuyển.',
    group: 'flow',
    statuses: ['packed'],
    queue: 'handoff',
  },
  {
    key: 'delivery',
    label: 'Chờ xác nhận giao',
    helper: 'Đơn đang giao, cần xác nhận khi đối tác báo đã giao tới khách.',
    group: 'flow',
    statuses: ['shipping'],
    queue: 'delivery',
  },
  {
    key: 'blocked',
    label: 'Chờ thanh toán',
    helper: 'Đơn online chưa paid hoặc thanh toán lỗi, cần khách hoàn tất hoặc nhân viên đối soát.',
    group: 'exceptions',
    statuses: ['confirmed', 'packed', 'shipping', 'delivered'],
    queue: 'blocked',
  },
  {
    key: 'payment-deadline',
    label: 'Thanh toán sắp quá hạn',
    helper: 'Đơn online chưa thanh toán sẽ tự hủy khi quá hạn 3 ngày.',
    group: 'exceptions',
    statuses: ['confirmed'],
    queue: 'payment-deadline',
  },
  {
    key: 'shipping-mapping',
    label: 'Cần mapping GHN',
    helper: 'Đơn đang dùng phí tạm tính hoặc địa chỉ chưa có mã GHN đã xác minh; cần xử lý trước khi bàn giao.',
    group: 'exceptions',
    statuses: ['confirmed', 'packed'],
    queue: 'shipping-mapping',
  },
  {
    key: 'review',
    label: 'Xử lý trả hàng',
    helper: 'Duyệt yêu cầu mới và theo dõi các đơn đã duyệt đang chờ shop nhận lại hàng.',
    group: 'exceptions',
    statuses: ['return_requested', 'return_approved'],
    queue: 'review',
  },
  {
    key: 'refund',
    label: 'Cần hoàn tiền',
    helper: 'Đơn đã thanh toán nhưng bị hủy hoặc đã nhận trả, cần xử lý hoàn tiền theo phương thức thanh toán.',
    group: 'exceptions',
    statuses: ['cancelled', 'returned'],
    paymentStatus: 'paid',
    queue: 'refund',
  },
  {
    key: 'all',
    label: 'Tra cứu toàn bộ',
    helper: 'Tra cứu toàn bộ đơn, hóa đơn, thanh toán và vận chuyển.',
    group: 'lookup',
  },
]

export const orderTabGroups: Array<{
  key: OrderTabGroupKey
  label: string
}> = [
  { key: 'exceptions', label: 'Cần ưu tiên' },
  { key: 'flow', label: 'Luồng thực hiện' },
  { key: 'lookup', label: 'Tra cứu' },
]

export const resolveInitialTabKey = (
  value: string | undefined,
  lockPaymentSection: boolean,
  paymentSection: PaymentSectionKey = 'all',
) => {
  if (orderTabs.some((tab) => tab.key === value)) return value as string
  if (!lockPaymentSection) return 'all'
  return paymentSection === 'online' ? 'blocked' : 'packing'
}

export const statusLabels: Record<AdminOrderStatus, string> = {
  confirmed: 'Chờ xử lý',
  packed: 'Đã đóng gói',
  shipping: 'Đang giao',
  delivered: 'Đã giao',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
  return_requested: 'Chờ duyệt trả',
  return_approved: 'Chờ nhận hàng trả',
  returned: 'Đã nhận trả',
}

export const paymentStatusLabels: Record<AdminOrderPaymentStatus, string> = {
  pending: 'Chờ thanh toán',
  paid: 'Đã thanh toán',
  failed: 'Thanh toán thất bại',
  refunded: 'Đã hoàn tiền',
}

export const getAllowedPaymentAdjustments = (
  order: AdminOrder,
): AdminOrderPaymentStatus[] => {
  if (order.paymentStatus === 'refunded') return []

  if (order.paymentStatus === 'paid') {
    const canRefund = order.paymentMethod !== 'VNPAY' &&
      (order.status === 'cancelled' || order.status === 'returned')
    return canRefund ? ['refunded'] : []
  }

  return order.paymentStatus === 'pending'
    ? ['paid', 'failed']
    : ['paid', 'pending']
}

export const paymentMethodStatusLabels: Record<AdminPaymentMethodStatus, string> = {
  pending: 'Đang xác minh',
  verified: 'Sẵn sàng',
  expired: 'Đã hết hạn',
  disabled: 'Đã tắt',
}

export const getPaymentMethodStatusClass = (status: AdminPaymentMethodStatus) => {
  if (status === 'verified') return 'admin-status-pill is-active'
  if (status === 'pending') return 'admin-status-pill is-warning'
  if (status === 'expired') return 'admin-status-pill is-soft'
  return 'admin-status-pill is-blocked'
}

export const getPaymentMethodStatusActions = (status: AdminPaymentMethodStatus) => {
  const actions: Array<{
    status: AdminPaymentMethodStatus
    label: string
    className: 'admin-secondary-button' | 'admin-danger-button'
  }> = []

  if (status !== 'verified') {
    actions.push({ status: 'verified', label: 'Xác minh', className: 'admin-secondary-button' })
  }

  if (status === 'verified') {
    actions.push({ status: 'pending', label: 'Chờ xác minh', className: 'admin-secondary-button' })
    actions.push({ status: 'expired', label: 'Đánh dấu hết hạn', className: 'admin-secondary-button' })
  }

  if (status !== 'disabled') {
    actions.push({ status: 'disabled', label: 'Tắt tài khoản', className: 'admin-danger-button' })
  }

  return actions
}

export const paymentMethodLabels: Record<AdminOrderPaymentMethod, string> = {
  COD: 'COD',
  VNPAY: 'VNPay',
  MOMO: 'MoMo',
  CARD: 'Thẻ',
  BANK: 'Chuyển khoản',
}

export const transactionStatusLabels: Record<AdminTransaction['status'], string> = {
  pending: 'Chờ thanh toán',
  success: 'Thành công',
  failed: 'Thất bại',
  expired: 'Đã hết hạn',
}

export const returnRequestStatusLabels: Record<AdminReturnRequestStatus, string> = {
  requested: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Đã từ chối',
}

export const auditActionLabels: Record<AdminAuditLog['action'], string> = {
  'order.status_update': 'Cập nhật trạng thái đơn',
  'order.shipping_update': 'Cập nhật vận chuyển',
  'order.shipping_mapping_update': 'Xác minh mapping GHN',
  'order.shipping_webhook': 'Webhook vận chuyển',
  'order.shipping_reconcile': 'Đối soát vận chuyển',
  'order.auto_complete_delivered': 'Tự hoàn tất đơn đã giao',
  'payment.adjust': 'Điều chỉnh thanh toán',
  'payment.expire': 'Đánh dấu thanh toán hết hạn',
  'payment.vnpay_reconcile': 'Đối soát VNPay',
  'payment.vnpay_refund': 'Yêu cầu hoàn tiền VNPay',
  'payment_method.status_update': 'Cập nhật tài khoản nhận hoàn tiền',
  'payment_method.account_reveal': 'Xem số tài khoản hoàn tiền',
  'shipping_mapping.import': 'Import mapping GHN',
  'shipping_mapping.review': 'Duyệt mapping GHN',
}

export const actorRoleLabels: Record<AdminAuditLog['actorRole'], string> = {
  admin: 'Quản trị viên',
  staff: 'Nhân viên',
  system: 'Hệ thống',
  user: 'Khách hàng',
}

export const auditTargetTypeLabels: Record<string, string> = {
  Order: 'Đơn hàng',
  Payment: 'Thanh toán',
  PaymentMethod: 'Tài khoản nhận hoàn tiền',
  ShippingAreaMapping: 'Mapping GHN',
}

export const shippingProviderLabels: Record<string, string> = {
  GHN: 'GHN',
  GHTK: 'GHTK',
  FIXED: 'Cố định',
}

export const shippingStatusLabels: Record<string, string> = {
  created: 'Đã tạo',
  quoted: 'Đã báo phí',
  fallback: 'Phí cố định',
  ready: 'Sẵn sàng giao',
  picking: 'Đang lấy hàng',
  picked: 'Đã lấy hàng',
  shipping: 'Đang giao',
  delivering: 'Đang giao',
  delivered: 'Đã giao',
  cancelled: 'Đã hủy',
  returned: 'Đã trả hàng',
  failed: 'Giao thất bại',
}

export const shippingSimulationActions: Array<{
  status: ShippingSimulationStatus
  label: string
  className: 'admin-secondary-button' | 'admin-primary-button' | 'admin-danger-button'
}> = [
  { status: 'picked', label: 'Đã lấy hàng', className: 'admin-secondary-button' },
  { status: 'shipping', label: 'Đang giao', className: 'admin-secondary-button' },
  { status: 'delivered', label: 'Đã giao', className: 'admin-primary-button' },
  { status: 'failed', label: 'Giao thất bại', className: 'admin-danger-button' },
]

export const nextStatusOptions: Partial<Record<AdminOrderStatus, AdminOrderStatus[]>> = {
  confirmed: ['packed', 'cancelled'],
  packed: ['cancelled'],
  delivered: ['completed'],
  return_approved: ['returned'],
}

export const getCommonBulkStatusOptions = (orders: AdminOrder[]) => {
  if (orders.length === 0) return []

  const firstOptions = nextStatusOptions[orders[0].status] ?? []
  return firstOptions.filter((status) =>
    orders.every((order) => (nextStatusOptions[order.status] ?? []).includes(status)),
  )
}

export const canSelectOrderForBulk = (order: AdminOrder) =>
  !['cancelled', 'returned', 'completed'].includes(order.status)

export const getNoNextOrderStepMessage = (order: AdminOrder) => {
  if (order.status === 'shipping') {
    return 'Đơn đang giao. Có thể đánh dấu đã giao khi shipper hoặc đối tác vận chuyển xác nhận.'
  }

  if (order.status === 'delivered') {
    return 'Đơn vị vận chuyển đã giao tới khách. Đợi khách xác nhận đã nhận hàng hoặc xử lý trả hàng trong 7 ngày.'
  }

  if (order.status === 'completed') {
    return 'Khách đã xác nhận nhận hàng. Đơn vẫn có thể phát sinh yêu cầu trả hàng trong thời hạn chính sách.'
  }

  if (order.status === 'return_approved') {
    return 'Yêu cầu trả đã được duyệt. Chỉ xác nhận đã nhận hàng trả sau khi shop thực tế nhận và kiểm tra sản phẩm.'
  }

  return 'Đơn hàng không có bước xử lý tiếp theo.'
}

export const getStatusActionLabel = (status: AdminOrderStatus) => {
  if (status === 'packed') return 'Đóng gói xong'
  if (status === 'shipping') return 'Bàn giao vận chuyển'
  if (status === 'delivered') return 'Xác nhận giao thành công'
  if (status === 'completed') return 'Khách đã nhận hàng'
  if (status === 'cancelled') return 'Hủy đơn'
  if (status === 'returned') return 'Xác nhận đã nhận hàng trả'

  return statusLabels[status]
}

export const currencyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
})

export const formatCurrency = (value: number) => currencyFormatter.format(value)

export const formatDate = (value?: string | null) => {
  if (!value) return 'Chưa có'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Chưa có'

  return formatAdminDateTime(date)
}

export const getReturnWindowDeadline = (order: AdminOrder) => {
  if (!order.deliveredAt) return null

  const deliveredAt = new Date(order.deliveredAt)
  if (Number.isNaN(deliveredAt.getTime())) return null

  return new Date(deliveredAt.getTime() + returnWindowDays * 24 * 60 * 60 * 1000)
}

export const getReturnWindowStatus = (order: AdminOrder) => {
  const deadline = getReturnWindowDeadline(order)
  if (!deadline) return null

  return Date.now() <= deadline.getTime()
    ? {
        className: 'admin-status-pill is-review',
        label: `Còn hạn trả đến ${formatDate(deadline.toISOString())}`,
      }
    : {
        className: 'admin-status-pill is-soft',
        label: `Hết hạn trả hàng từ ${formatDate(deadline.toISOString())}`,
      }
}

export const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Không thể xử lý yêu cầu'

export const getPaymentPillClass = (status: AdminOrderPaymentStatus) => {
  if (status === 'paid') return 'admin-status-pill is-active'
  if (status === 'pending') return 'admin-status-pill is-warning'
  if (status === 'refunded') return 'admin-status-pill is-refund'
  return 'admin-status-pill is-blocked'
}

export const getOrderPillClass = (status: AdminOrderStatus) => {
  if (status === 'completed') return 'admin-status-pill is-active'
  if (status === 'delivered') return 'admin-status-pill is-active'
  if (status === 'shipping') return 'admin-status-pill is-info'
  if (status === 'packed') return 'admin-status-pill is-progress'
  if (status === 'return_requested') return 'admin-status-pill is-review'
  if (status === 'return_approved') return 'admin-status-pill is-progress'
  if (status === 'returned') return 'admin-status-pill is-refund'
  if (status === 'cancelled') return 'admin-status-pill is-blocked'
  return 'admin-status-pill is-warning'
}

export const hasRejectedReturnRequest = (order: Pick<AdminOrder, 'status' | 'returnRequest'>) =>
  order.returnRequest?.status === 'rejected' &&
  (order.status === 'delivered' || order.status === 'completed')

export const getOrderDisplayStatus = (order: Pick<AdminOrder, 'status' | 'returnRequest'>) => {
  if (hasRejectedReturnRequest(order)) {
    return {
      className: 'admin-status-pill is-blocked',
      label: 'Trả hàng bị từ chối',
    }
  }

  return {
    className: getOrderPillClass(order.status),
    label: statusLabels[order.status],
  }
}

export const getReturnRequestPillClass = (status: AdminReturnRequestStatus) => {
  if (status === 'approved') return 'admin-status-pill is-active'
  if (status === 'rejected') return 'admin-status-pill is-blocked'
  return 'admin-status-pill is-review'
}

export const getShippingPillClass = (status?: string | null) => {
  if (status === 'delivered') return 'admin-status-pill is-active'
  if (status === 'shipping' || status === 'delivering' || status === 'picking' || status === 'picked') {
    return 'admin-status-pill is-info'
  }
  if (status === 'failed' || status === 'cancelled' || status === 'returned') {
    return 'admin-status-pill is-blocked'
  }
  return 'admin-status-pill is-soft'
}

export const getTabClass = (tab: OrderTab, activeTabKey: string) =>
  [
    'admin-order-tab',
    `is-${tab.key}`,
    tab.key === activeTabKey ? 'is-active' : '',
  ]
    .filter(Boolean)
    .join(' ')

export const orderFlowSteps = ['confirmed', 'packed', 'shipping', 'delivered', 'completed'] as const

export const orderFlowLabels: Record<(typeof orderFlowSteps)[number], string> = {
  confirmed: 'Tiếp nhận',
  packed: 'Đóng gói',
  shipping: 'Giao hàng',
  delivered: 'Đã giao',
  completed: 'Hoàn tất',
}

export const getOrderProgressPercent = (status: AdminOrderStatus, shippingStatus?: string | null) => {
  if (status === 'cancelled') return 0
  if (status === 'return_requested' || status === 'return_approved' || status === 'returned') return 100

  if (status === 'packed') {
    if (shippingStatus === 'ready') return 60
    if (shippingStatus === 'picking') return 68
    if (shippingStatus === 'picked') return 75
  }

  if (status === 'shipping') {
    if (shippingStatus === 'delivered') return 100
    if (shippingStatus === 'shipping' || shippingStatus === 'delivering') return 88
    if (shippingStatus === 'picked') return 78
    if (shippingStatus === 'failed') return 75
  }

  const index = orderFlowSteps.indexOf(status as (typeof orderFlowSteps)[number])
  if (index < 0) return 0

  return ((index + 1) / orderFlowSteps.length) * 100
}

export const getAddressLine = (order: AdminOrder) =>
  [
    order.shippingAddress.streetName,
    order.shippingAddress.ward,
    order.shippingAddress.district,
    order.shippingAddress.province,
  ]
    .filter(Boolean)
    .join(', ')

export const formatShippingProvider = (provider?: string | null) => {
  if (!provider) return 'Chưa tạo vận đơn'

  return shippingProviderLabels[provider] ?? provider
}

export const formatShippingStatus = (status?: string | null) => {
  if (!status) return 'Đang chờ'

  return shippingStatusLabels[status] ?? status
}

export const canSimulateShippingStatus = (order: AdminOrder, status: ShippingSimulationStatus) => {
  if (order.shipping?.status === 'failed') return status === 'shipping' && order.status === 'shipping'
  if (status === 'picked') return order.status === 'packed'
  if (status === 'shipping') return order.status === 'packed' || order.status === 'shipping'
  if (status === 'delivered' || status === 'failed') return order.status === 'shipping'

  return false
}

export const hasActiveGhnShipment = (order: AdminOrder) =>
  order.shipping?.provider === 'GHN' &&
  Boolean(order.shipping?.trackingCode) &&
  order.shipping?.status !== 'cancelled'

export const canCreateGhnShipment = (order: AdminOrder) => {
  const paymentReady = order.paymentMethod === 'COD' || order.paymentStatus === 'paid'
  const mappingReady =
    order.shippingAddress.ghnMappingStatus === 'mapped' &&
    Boolean(order.shippingAddress.ghnMappingConfidence) &&
    Boolean(order.shippingAddress.ghnMappingVerifiedAt) &&
    Boolean(order.shippingAddress.ghnMappingVerificationSource) &&
    Boolean(order.shippingAddress.ghnDistrictId) &&
    Boolean(order.shippingAddress.ghnWardCode)

  return order.status === 'packed' && paymentReady && mappingReady && !hasActiveGhnShipment(order)
}

export const canCancelGhnShipment = (order: AdminOrder) =>
  order.shipping?.provider === 'GHN' &&
  Boolean(order.shipping?.trackingCode) &&
  order.shipping?.status !== 'delivered' &&
  order.shipping?.status !== 'cancelled' &&
  (order.status === 'packed' || order.status === 'cancelled')

export const canSyncGhnShipment = (order: AdminOrder) =>
  order.shipping?.provider === 'GHN' && Boolean(order.shipping?.trackingCode)

export const getShippingSimulationActionLabel = (
  order: AdminOrder,
  action: (typeof shippingSimulationActions)[number],
) => {
  if (action.status === 'shipping' && order.shipping?.status === 'failed') {
    return 'Giao lại'
  }

  return action.label
}

export const getPaymentMethodMetadataText = (method: AdminCustomerPaymentMethod, key: string) => {
  const value = method.metadata?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export const getCustomerPaymentMethodSubtitle = (method: AdminCustomerPaymentMethod) => {
  const accountHolder = getPaymentMethodMetadataText(method, 'accountHolder')

  return [
    accountHolder ? `Chủ TK: ${accountHolder}` : null,
    method.maskedInfo,
    method.bankName,
    method.bankCode,
  ].filter(Boolean).join(' / ') || method.provider
}

export const getShippingUpdateDialogValues = (order: AdminOrder): ShippingUpdateDialogValues => ({
  provider: order.shipping?.provider ?? 'GHN',
  trackingCode: order.shipping?.trackingCode ?? '',
  labelUrl: order.shipping?.labelUrl ?? '',
  status: order.shipping?.status ?? 'created',
  actualProviderCost:
    order.shipping?.actualProviderCost !== undefined && order.shipping?.actualProviderCost !== null
      ? String(order.shipping.actualProviderCost)
      : '',
  reason: '',
})
