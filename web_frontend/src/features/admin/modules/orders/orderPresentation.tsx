/* eslint-disable react-refresh/only-export-components */
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
  OrderQueueKey,
  OrderTab,
  OrderTabGroupKey,
  PaymentSectionKey,
  ShippingSimulationStatus,
  ShippingUpdateDialogValues,
} from './orderTypes'

export const pageSize = 10
export const returnWindowDays = 7

export const emptyStatusSummary: Record<AdminOrderStatus | 'all', number> = {
  all: 0,
  confirmed: 0,
  packed: 0,
  shipping: 0,
  delivered: 0,
  cancelled: 0,
  return_requested: 0,
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
    key: 'online',
    label: 'Thanh toán online',
    helper: 'VNPay cần ghi nhận tiền trước khi xử lý giao. MoMo, thẻ và chuyển khoản chưa mở trong MVP.',
    methods: onlinePaymentMethods,
  },
  {
    key: 'cod',
    label: 'COD',
    helper: 'Đơn thu tiền khi nhận hàng, ưu tiên đóng gói, giao hàng và xác nhận đã giao.',
    methods: codPaymentMethods,
  },
]

export const getPaymentSectionMethods = (sectionKey: PaymentSectionKey) =>
  paymentSections.find((section) => section.key === sectionKey)?.methods ?? onlinePaymentMethods

export const orderTabs: OrderTab[] = [
  {
    key: 'packing',
    label: 'Cần đóng gói',
    helper: 'Đơn đã đủ điều kiện thanh toán/COD và đang chờ kiểm tra, đóng gói.',
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
    label: 'Chờ giao thành công',
    helper: 'Đơn đang giao, cần xác nhận khi đối tác báo đã giao tới khách.',
    group: 'flow',
    statuses: ['shipping'],
    queue: 'delivery',
  },
  {
    key: 'review',
    label: 'Duyệt trả hàng',
    helper: 'Yêu cầu đổi/trả cần kiểm tra lý do, minh chứng và thời hạn 7 ngày từ lúc giao.',
    group: 'exceptions',
    statuses: ['return_requested'],
    queue: 'review',
  },
  {
    key: 'refund',
    label: 'Hoàn tiền',
    helper: 'Đơn đã thanh toán nhưng bị hủy, cần đối soát và hoàn tiền thủ công.',
    group: 'exceptions',
    statuses: ['cancelled'],
    paymentStatus: 'paid',
    queue: 'refund',
  },
  {
    key: 'payment-deadline',
    label: 'Sắp quá hạn thanh toán',
    helper: 'Đơn online chưa thanh toán sẽ tự hủy khi quá hạn 3 ngày.',
    group: 'exceptions',
    statuses: ['confirmed'],
    queue: 'payment-deadline',
  },
  {
    key: 'all',
    label: 'Tất cả',
    helper: 'Tra cứu toàn bộ đơn, hóa đơn, thanh toán và vận chuyển.',
    group: 'lookup',
  },
]

export const orderTabGroups: Array<{
  key: OrderTabGroupKey
  label: string
}> = [
  { key: 'flow', label: 'Luồng vận hành' },
  { key: 'exceptions', label: 'Phát sinh cần xử lý' },
  { key: 'lookup', label: 'Tra cứu' },
]

export const resolveInitialTabKey = (value: string | undefined, lockPaymentSection: boolean) =>
  orderTabs.some((tab) => tab.key === value) ? value as string : lockPaymentSection ? 'packing' : 'all'

export const statusLabels: Record<AdminOrderStatus, string> = {
  confirmed: 'Chờ xử lý',
  packed: 'Đã đóng gói',
  shipping: 'Đang giao',
  delivered: 'Đã giao',
  cancelled: 'Đã hủy',
  return_requested: 'Chờ duyệt trả',
  returned: 'Đã nhận trả',
}

export const paymentStatusLabels: Record<AdminOrderPaymentStatus, string> = {
  pending: 'Chờ thanh toán',
  paid: 'Đã thanh toán',
  failed: 'Thanh toán lỗi',
  refunded: 'Đã hoàn tiền',
}

export const paymentMethodStatusLabels: Record<AdminPaymentMethodStatus, string> = {
  pending: 'Đang xác minh',
  verified: 'Sẵn sàng',
  expired: 'Hết hạn',
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
    actions.push({ status: 'expired', label: 'Hết hạn', className: 'admin-secondary-button' })
  }

  if (status !== 'disabled') {
    actions.push({ status: 'disabled', label: 'Tắt', className: 'admin-danger-button' })
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
  pending: 'Đang chờ',
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
  'order.shipping_webhook': 'Webhook vận chuyển',
  'payment.adjust': 'Điều chỉnh thanh toán',
  'payment.expire': 'Hết hạn thanh toán',
  'payment_method.status_update': 'Cập nhật phương thức thanh toán',
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
  PaymentMethod: 'Phương thức thanh toán',
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
}

export const getNoNextOrderStepMessage = (order: AdminOrder) => {
  if (order.status === 'shipping') {
    return 'Đơn đang giao. Có thể đánh dấu đã giao khi shipper hoặc đối tác vận chuyển xác nhận.'
  }

  if (order.status === 'delivered') {
    return 'Đơn đã giao. Khách có thể yêu cầu trả hàng trong 7 ngày từ thời điểm giao.'
  }

  return 'Đơn hàng không có bước xử lý tiếp theo.'
}

export const getStatusActionLabel = (status: AdminOrderStatus) => {
  if (status === 'packed') return 'Đóng gói xong'
  if (status === 'shipping') return 'Bàn giao vận chuyển'
  if (status === 'delivered') return 'Xác nhận đã giao'
  if (status === 'cancelled') return 'Hủy đơn'

  return statusLabels[status]
}

export const currencyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
})

export const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'short',
})

export const formatCurrency = (value: number) => currencyFormatter.format(value)

export const formatDate = (value?: string | null) => {
  if (!value) return 'Chưa có'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Chưa có'

  return dateFormatter.format(date)
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
        label: `Hết hạn trả từ ${formatDate(deadline.toISOString())}`,
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
  if (status === 'delivered') return 'admin-status-pill is-active'
  if (status === 'shipping') return 'admin-status-pill is-info'
  if (status === 'packed') return 'admin-status-pill is-progress'
  if (status === 'return_requested') return 'admin-status-pill is-review'
  if (status === 'returned') return 'admin-status-pill is-refund'
  if (status === 'cancelled') return 'admin-status-pill is-blocked'
  return 'admin-status-pill is-warning'
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

export const getOrderRowClass = (order: AdminOrder) => {
  if (shouldWarnPaymentBeforeShipping(order) || order.paymentStatus === 'failed') {
    return 'admin-order-row is-payment-risk'
  }
  if (order.status === 'delivered') return 'admin-order-row is-complete'
  if (order.status === 'shipping') return 'admin-order-row is-shipping'
  if (order.status === 'packed') return 'admin-order-row is-packed'
  if (order.status === 'cancelled' || order.status === 'returned' || order.status === 'return_requested') {
    return 'admin-order-row is-exception'
  }
  return 'admin-order-row is-processing'
}

export const getTabClass = (tab: OrderTab, activeTabKey: string) =>
  [
    'admin-order-tab',
    `is-${tab.key}`,
    tab.key === activeTabKey ? 'is-active' : '',
  ]
    .filter(Boolean)
    .join(' ')

export const orderFlowSteps = ['confirmed', 'packed', 'shipping', 'delivered'] as const

export const orderFlowLabels: Record<(typeof orderFlowSteps)[number], string> = {
  confirmed: 'Tiếp nhận',
  packed: 'Đóng gói',
  shipping: 'Giao hàng',
  delivered: 'Đã giao',
}

export const getOrderProgressPercent = (status: AdminOrderStatus, shippingStatus?: string | null) => {
  if (status === 'cancelled') return 0
  if (status === 'return_requested' || status === 'returned') return 100

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

export function OrderProgressRail({
  compact = false,
  shippingStatus,
  status,
}: {
  compact?: boolean
  shippingStatus?: string | null
  status: AdminOrderStatus
}) {
  const isException = status === 'cancelled' || status === 'return_requested' || status === 'returned'
  const progressPercent = getOrderProgressPercent(status, shippingStatus)
  const currentIndex = isException && status !== 'cancelled'
    ? orderFlowSteps.length - 1
    : orderFlowSteps.indexOf(status as (typeof orderFlowSteps)[number])

  return (
    <div className={`admin-order-progress${compact ? ' is-compact' : ''}${isException ? ' is-exception' : ''}`}>
      <span style={{ width: `${progressPercent}%` }} />
      {!compact ? (
        <ol>
          {orderFlowSteps.map((step) => (
            <li className={orderFlowSteps.indexOf(step) <= currentIndex ? 'is-done' : ''} key={step}>
              {orderFlowLabels[step]}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  )
}

export const shouldWarnPaymentBeforeShipping = (order: AdminOrder) =>
  order.paymentMethod !== 'COD' &&
  order.paymentStatus !== 'paid' &&
  order.status !== 'cancelled' &&
  order.status !== 'returned'

export const isPaymentDeadlineSoon = (order: AdminOrder) => {
  if (!order.paymentDeadlineAt || !shouldWarnPaymentBeforeShipping(order)) return false
  const remaining = new Date(order.paymentDeadlineAt).getTime() - Date.now()
  return remaining > 0 && remaining <= 24 * 60 * 60 * 1000
}

export const getPaymentDeadlineStatus = (order: AdminOrder) => {
  if (!order.paymentDeadlineAt || order.paymentStatus === 'paid' || order.status === 'cancelled') return null
  const deadline = new Date(order.paymentDeadlineAt)
  if (Number.isNaN(deadline.getTime())) return null
  const remainingMs = deadline.getTime() - Date.now()
  const absoluteMs = Math.abs(remainingMs)
  const days = Math.floor(absoluteMs / (24 * 60 * 60 * 1000))
  const hours = Math.floor((absoluteMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
  const remainingLabel = days > 0 ? `${days} ngày ${hours} giờ` : `${hours} giờ`

  return remainingMs <= 0
    ? { className: 'admin-status-pill is-deadline-critical', label: `Đã quá hạn ${remainingLabel}` }
    : {
        className: remainingMs <= 24 * 60 * 60 * 1000
          ? 'admin-status-pill is-deadline-critical'
          : 'admin-status-pill is-deadline-warning',
        label: `Hạn ${formatDate(order.paymentDeadlineAt)} · còn ${remainingLabel}`,
      }
}

export const needsRefundReview = (order: AdminOrder) =>
  order.status === 'cancelled' && order.paymentStatus === 'paid'

export const needsReasonReview = (order: AdminOrder) =>
  order.status === 'return_requested' && order.returnRequest?.status === 'requested'

export const isBlockedOrder = (order: AdminOrder) =>
  shouldWarnPaymentBeforeShipping(order) ||
  order.paymentStatus === 'failed'

export const getOrderQueue = (order: AdminOrder): OrderQueueKey | null => {
  if (needsRefundReview(order)) return 'refund'
  if (needsReasonReview(order)) return 'review'
  if (isPaymentDeadlineSoon(order)) return 'payment-deadline'
  if (isBlockedOrder(order)) return null
  if (order.status === 'confirmed') return 'packing'
  if (order.status === 'packed') return 'handoff'
  if (order.status === 'shipping') return 'delivery'

  return null
}

export const getQueueCount = (
  queue: OrderQueueKey,
  summary: Record<AdminOrderStatus | 'all', number>,
  operationalSummary = emptyOperationalSummary,
) => {
  if (queue === 'refund') return operationalSummary.refunds
  if (queue === 'review') return operationalSummary.returnRequests
  if (queue === 'blocked') return operationalSummary.paymentRisk
  if (queue === 'payment-deadline') return operationalSummary.paymentDeadlineSoon ?? 0
  if (queue === 'packing') return operationalSummary.packingReady ?? 0
  if (queue === 'handoff') return operationalSummary.handoffReady ?? 0
  if (queue === 'delivery') return operationalSummary.deliveryConfirmations ?? summary.shipping

  const readyToProcess = operationalSummary.readyToProcess ?? Math.max(0, summary.confirmed + summary.packed)
  const deliveryConfirmations = operationalSummary.deliveryConfirmations ?? summary.shipping
  return readyToProcess + deliveryConfirmations
}

export const getTabCount = (
  tab: OrderTab,
  summary: Record<AdminOrderStatus | 'all', number>,
  operationalSummary = emptyOperationalSummary,
) => {
  if (tab.queue) return getQueueCount(tab.queue, summary, operationalSummary)

  return tab.statuses?.length
    ? tab.statuses.reduce((total, status) => total + (summary[status] ?? 0), 0)
    : summary.all
}

export type AdminOrderAttention = {
  kind: 'return' | 'refund' | 'paid-ready' | 'payment-risk' | 'new' | 'packed' | 'delivery'
  tone: 'danger' | 'warning' | 'info' | 'success'
  label: string
  helper: string
}

export const getOrderAttention = (order: AdminOrder): AdminOrderAttention | null => {
  if (order.status === 'return_requested' && order.returnRequest?.status === 'requested') {
    return {
      kind: 'return',
      tone: 'warning',
      label: 'Cần duyệt trả hàng',
      helper: 'Kiểm tra lý do, minh chứng và mốc 7 ngày từ lúc giao.',
    }
  }

  if (order.status === 'cancelled' && order.paymentStatus === 'paid') {
    return {
      kind: 'refund',
      tone: 'warning',
      label: 'Cần hoàn tiền',
      helper: 'Đơn đã thanh toán nhưng bị hủy, cần đối soát hoàn tiền thủ công.',
    }
  }

  if (shouldWarnPaymentBeforeShipping(order) || order.paymentStatus === 'failed') {
    return {
      kind: 'payment-risk',
      tone: 'danger',
      label: 'Vướng thanh toán',
      helper: 'Chưa ghi nhận thanh toán, chưa nên xử lý giao hàng.',
    }
  }

  if (order.status === 'confirmed') {
    return {
      kind: 'new',
      tone: 'info',
      label: 'Cần đóng gói',
      helper: 'Đơn đã đủ điều kiện xử lý, cần kiểm tra và đóng gói.',
    }
  }

  if (order.status === 'packed') {
    return {
      kind: 'packed',
      tone: 'info',
      label: 'Chờ bàn giao',
      helper: 'Đơn đã đóng gói, cần bàn giao cho đơn vị vận chuyển.',
    }
  }

  if (order.status === 'shipping') {
    return {
      kind: 'delivery',
      tone: 'success',
      label: 'Chờ giao thành công',
      helper: 'Có thể hoàn tất đơn khi shipper hoặc đối tác vận chuyển báo đã giao tới khách.',
    }
  }

  return null
}

export const getOrderAttentionClass = (order: AdminOrder) => {
  const attention = getOrderAttention(order)
  return attention ? `admin-order-attention-badge is-${attention.tone}` : ''
}

export const getOrderAttentionRank = (order: AdminOrder) => {
  const attention = getOrderAttention(order)
  if (!attention) return 8

  const ranks: Record<AdminOrderAttention['kind'], number> = {
    return: 0,
    refund: 1,
    'payment-risk': 2,
    'paid-ready': 3,
    new: 4,
    packed: 5,
    delivery: 6,
  }

  return ranks[attention.kind] ?? 8
}

export const isStatusBlockedByPayment = (order: AdminOrder, status: AdminOrderStatus) =>
  shouldWarnPaymentBeforeShipping(order) && status !== 'cancelled'

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

  return order.status === 'packed' && paymentReady && !hasActiveGhnShipment(order)
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
