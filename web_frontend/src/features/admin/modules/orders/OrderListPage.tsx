import { useCallback, useEffect, useState } from 'react'
import type { AdminUser } from '../auth/adminSession'
import {
  adjustOrderPaymentStatus,
  expireStalePayments,
  getOrder,
  listAuditLogs,
  listCustomerPaymentMethods,
  listOrderTransactions,
  listOrders,
  reviewReturnRequest,
  updateCustomerPaymentMethodStatus,
  updateOrderShipping,
  updateOrderStatus,
  type AdminAuditLog,
  type AdminCustomerPaymentMethod,
  type AdminOrder,
  type AdminOrderPaymentMethod,
  type AdminOrderPaymentStatus,
  type AdminOrderStatus,
  type AdminPaymentMethodStatus,
  type AdminReturnRequestStatus,
  type AdminReturnReviewDecision,
  type AdminTransaction,
} from './orderAdminApi'
import './order.css'

type OrdersPageProps = {
  currentUser: AdminUser
}

type OrderTab = {
  key: string
  label: string
  helper?: string
  statuses?: AdminOrderStatus[]
  paymentStatus?: AdminOrderPaymentStatus
  queue?: OrderQueueKey
}

type OrderQueueKey = 'actionable' | 'blocked' | 'review' | 'refund'
type PaymentSectionKey = 'online' | 'cod'

type Notice = {
  type: 'success' | 'error'
  message: string
}

const pageSize = 10
const returnWindowDays = 7

const emptyStatusSummary: Record<AdminOrderStatus | 'all', number> = {
  all: 0,
  confirmed: 0,
  packed: 0,
  shipping: 0,
  delivered: 0,
  cancelled: 0,
  return_requested: 0,
  returned: 0,
}

const emptyOperationalSummary = {
  returnRequests: 0,
  refunds: 0,
  paidReady: 0,
  readyToProcess: 0,
  deliveryConfirmations: 0,
  paymentRisk: 0,
  totalPriority: 0,
}

const onlinePaymentMethods: AdminOrderPaymentMethod[] = ['VNPAY', 'MOMO', 'CARD', 'BANK']
const codPaymentMethods: AdminOrderPaymentMethod[] = ['COD']

const paymentSections: Array<{
  key: PaymentSectionKey
  label: string
  helper: string
  methods: AdminOrderPaymentMethod[]
}> = [
  {
    key: 'online',
    label: 'Thanh toán online',
    helper: 'VNPay, MoMo, thẻ và chuyển khoản cần ghi nhận tiền trước khi xử lý giao.',
    methods: onlinePaymentMethods,
  },
  {
    key: 'cod',
    label: 'COD',
    helper: 'Đơn thu tiền khi nhận hàng, ưu tiên đóng gói, giao hàng và xác nhận đã giao.',
    methods: codPaymentMethods,
  },
]

const getPaymentSectionMethods = (sectionKey: PaymentSectionKey) =>
  paymentSections.find((section) => section.key === sectionKey)?.methods ?? onlinePaymentMethods

const orderTabs: OrderTab[] = [
  {
    key: 'actionable',
    label: 'Cần xử lý',
    helper: 'Đơn đủ điều kiện để đóng gói, bàn giao vận chuyển hoặc xác nhận đã giao tới khách.',
    statuses: ['confirmed', 'packed', 'shipping'],
    queue: 'actionable',
  },
  {
    key: 'review',
    label: 'Duyệt trả hàng',
    helper: 'Yêu cầu đổi/trả cần kiểm tra lý do, minh chứng và thời hạn 7 ngày từ lúc giao.',
    statuses: ['return_requested'],
    queue: 'review',
  },
  {
    key: 'refund',
    label: 'Hoàn tiền',
    helper: 'Đơn đã thanh toán nhưng bị hủy, cần đối soát và hoàn tiền thủ công.',
    statuses: ['cancelled'],
    paymentStatus: 'paid',
    queue: 'refund',
  },
  {
    key: 'blocked',
    label: 'Đang vướng',
    helper: 'Đơn lỗi hoặc chưa ghi nhận thanh toán; chưa nên tiếp tục giao hàng.',
    statuses: ['confirmed', 'packed', 'shipping'],
    queue: 'blocked',
  },
  {
    key: 'all',
    label: 'Tất cả',
    helper: 'Tra cứu toàn bộ đơn, hóa đơn, thanh toán và vận chuyển.',
  },
]

const statusLabels: Record<AdminOrderStatus, string> = {
  confirmed: 'Chờ xử lý',
  packed: 'Đã đóng gói',
  shipping: 'Đang giao',
  delivered: 'Đã giao',
  cancelled: 'Đã hủy',
  return_requested: 'Chờ duyệt trả',
  returned: 'Đã nhận trả',
}

const paymentStatusLabels: Record<AdminOrderPaymentStatus, string> = {
  pending: 'Chờ thanh toán',
  paid: 'Đã thanh toán',
  failed: 'Thanh toán lỗi',
  refunded: 'Đã hoàn tiền',
}

const paymentMethodStatusLabels: Record<AdminPaymentMethodStatus, string> = {
  pending: 'Đang xác minh',
  verified: 'Sẵn sàng',
  expired: 'Hết hạn',
  disabled: 'Đã tắt',
}

const getPaymentMethodStatusClass = (status: AdminPaymentMethodStatus) => {
  if (status === 'verified') return 'admin-status-pill is-active'
  if (status === 'pending') return 'admin-status-pill is-warning'
  if (status === 'expired') return 'admin-status-pill is-soft'
  return 'admin-status-pill is-blocked'
}

const getPaymentMethodStatusActions = (status: AdminPaymentMethodStatus) => {
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

const paymentMethodLabels: Record<AdminOrderPaymentMethod, string> = {
  COD: 'COD',
  VNPAY: 'VNPay',
  MOMO: 'MoMo',
  CARD: 'Thẻ',
  BANK: 'Chuyển khoản',
}

const transactionStatusLabels: Record<AdminTransaction['status'], string> = {
  pending: 'Đang chờ',
  success: 'Thành công',
  failed: 'Thất bại',
  expired: 'Đã hết hạn',
}

const returnRequestStatusLabels: Record<AdminReturnRequestStatus, string> = {
  requested: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Đã từ chối',
}

const auditActionLabels: Record<AdminAuditLog['action'], string> = {
  'order.status_update': 'Cập nhật trạng thái đơn',
  'order.shipping_update': 'Cập nhật vận chuyển',
  'payment.adjust': 'Điều chỉnh thanh toán',
  'payment.expire': 'Hết hạn thanh toán',
  'payment_method.status_update': 'Cập nhật phương thức thanh toán',
}

const actorRoleLabels: Record<AdminAuditLog['actorRole'], string> = {
  admin: 'Quản trị viên',
  staff: 'Nhân viên',
  system: 'Hệ thống',
  user: 'Khách hàng',
}

const auditTargetTypeLabels: Record<string, string> = {
  Order: 'Đơn hàng',
  Payment: 'Thanh toán',
  PaymentMethod: 'Phương thức thanh toán',
}

const shippingProviderLabels: Record<string, string> = {
  GHN: 'GHN',
  GHTK: 'GHTK',
  FIXED: 'Cố định',
}

const shippingStatusLabels: Record<string, string> = {
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

const nextStatusOptions: Partial<Record<AdminOrderStatus, AdminOrderStatus[]>> = {
  confirmed: ['packed', 'cancelled'],
  packed: ['shipping', 'cancelled'],
  shipping: ['delivered'],
}

const getNoNextOrderStepMessage = (order: AdminOrder) => {
  if (order.status === 'shipping') {
    return 'Đơn đang giao. Có thể đánh dấu đã giao khi shipper hoặc đối tác vận chuyển xác nhận.'
  }

  if (order.status === 'delivered') {
    return 'Đơn đã giao. Khách có thể yêu cầu trả hàng trong 7 ngày từ thời điểm giao.'
  }

  return 'Đơn hàng không có bước xử lý tiếp theo.'
}

const getStatusActionLabel = (status: AdminOrderStatus) => {
  if (status === 'packed') return 'Đóng gói xong'
  if (status === 'shipping') return 'Bàn giao vận chuyển'
  if (status === 'delivered') return 'Xác nhận đã giao'
  if (status === 'cancelled') return 'Hủy đơn'

  return statusLabels[status]
}

const currencyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
})

const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'short',
})

const formatCurrency = (value: number) => currencyFormatter.format(value)

const formatDate = (value?: string | null) => {
  if (!value) return 'Chưa có'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Chưa có'

  return dateFormatter.format(date)
}

const getReturnWindowDeadline = (order: AdminOrder) => {
  if (!order.deliveredAt) return null

  const deliveredAt = new Date(order.deliveredAt)
  if (Number.isNaN(deliveredAt.getTime())) return null

  return new Date(deliveredAt.getTime() + returnWindowDays * 24 * 60 * 60 * 1000)
}

const getReturnWindowStatus = (order: AdminOrder) => {
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

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Không thể xử lý yêu cầu'

const getPaymentPillClass = (status: AdminOrderPaymentStatus) => {
  if (status === 'paid') return 'admin-status-pill is-active'
  if (status === 'pending') return 'admin-status-pill is-warning'
  if (status === 'refunded') return 'admin-status-pill is-refund'
  return 'admin-status-pill is-blocked'
}

const getOrderPillClass = (status: AdminOrderStatus) => {
  if (status === 'delivered') return 'admin-status-pill is-active'
  if (status === 'shipping') return 'admin-status-pill is-info'
  if (status === 'packed') return 'admin-status-pill is-progress'
  if (status === 'return_requested') return 'admin-status-pill is-review'
  if (status === 'returned') return 'admin-status-pill is-refund'
  if (status === 'cancelled') return 'admin-status-pill is-blocked'
  return 'admin-status-pill is-warning'
}

const getReturnRequestPillClass = (status: AdminReturnRequestStatus) => {
  if (status === 'approved') return 'admin-status-pill is-active'
  if (status === 'rejected') return 'admin-status-pill is-blocked'
  return 'admin-status-pill is-review'
}

const getShippingPillClass = (status?: string | null) => {
  if (status === 'delivered') return 'admin-status-pill is-active'
  if (status === 'shipping' || status === 'delivering' || status === 'picking' || status === 'picked') {
    return 'admin-status-pill is-info'
  }
  if (status === 'failed' || status === 'cancelled' || status === 'returned') {
    return 'admin-status-pill is-blocked'
  }
  return 'admin-status-pill is-soft'
}

const getOrderRowClass = (order: AdminOrder) => {
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

const getTabClass = (tab: OrderTab, activeTabKey: string) =>
  [
    'admin-order-tab',
    `is-${tab.key}`,
    tab.key === activeTabKey ? 'is-active' : '',
  ]
    .filter(Boolean)
    .join(' ')

const orderFlowSteps = ['confirmed', 'packed', 'shipping', 'delivered'] as const

const orderFlowLabels: Record<(typeof orderFlowSteps)[number], string> = {
  confirmed: 'Tiếp nhận',
  packed: 'Đóng gói',
  shipping: 'Giao hàng',
  delivered: 'Đã giao',
}

const getOrderProgressPercent = (status: AdminOrderStatus) => {
  if (status === 'cancelled') return 0
  if (status === 'return_requested' || status === 'returned') return 100

  const index = orderFlowSteps.indexOf(status as (typeof orderFlowSteps)[number])
  if (index < 0) return 0

  return ((index + 1) / orderFlowSteps.length) * 100
}

function OrderProgressRail({
  compact = false,
  status,
}: {
  compact?: boolean
  status: AdminOrderStatus
}) {
  const isException = status === 'cancelled' || status === 'return_requested' || status === 'returned'
  const progressPercent = getOrderProgressPercent(status)
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

const shouldWarnPaymentBeforeShipping = (order: AdminOrder) =>
  order.paymentMethod !== 'COD' &&
  order.paymentStatus !== 'paid' &&
  order.status !== 'cancelled' &&
  order.status !== 'returned'

const canAdvanceOrder = (order: AdminOrder) => {
  const statusOptions = nextStatusOptions[order.status] ?? []

  return statusOptions.some((status) => !isStatusBlockedByPayment(order, status))
}

const needsRefundReview = (order: AdminOrder) =>
  order.status === 'cancelled' && order.paymentStatus === 'paid'

const needsReasonReview = (order: AdminOrder) =>
  order.status === 'return_requested' && order.returnRequest?.status === 'requested'

const isBlockedOrder = (order: AdminOrder) =>
  shouldWarnPaymentBeforeShipping(order) ||
  order.paymentStatus === 'failed'

const getOrderQueue = (order: AdminOrder): OrderQueueKey | null => {
  if (needsRefundReview(order)) return 'refund'
  if (needsReasonReview(order)) return 'review'
  if (canAdvanceOrder(order)) return 'actionable'
  if (isBlockedOrder(order)) return 'blocked'

  return null
}

const getQueueCount = (
  queue: OrderQueueKey,
  summary: Record<AdminOrderStatus | 'all', number>,
  operationalSummary = emptyOperationalSummary,
) => {
  if (queue === 'refund') return operationalSummary.refunds
  if (queue === 'review') return operationalSummary.returnRequests
  if (queue === 'blocked') return operationalSummary.paymentRisk

  const readyToProcess = operationalSummary.readyToProcess ?? Math.max(0, summary.confirmed + summary.packed)
  const deliveryConfirmations = operationalSummary.deliveryConfirmations ?? summary.shipping
  return readyToProcess + deliveryConfirmations
}

const getTabCount = (
  tab: OrderTab,
  summary: Record<AdminOrderStatus | 'all', number>,
  operationalSummary = emptyOperationalSummary,
) => {
  if (tab.queue) return getQueueCount(tab.queue, summary, operationalSummary)

  return tab.statuses?.length
    ? tab.statuses.reduce((total, status) => total + (summary[status] ?? 0), 0)
    : summary.all
}

type AdminOrderAttention = {
  kind: 'return' | 'refund' | 'paid-ready' | 'payment-risk' | 'new' | 'packed' | 'delivery'
  tone: 'danger' | 'warning' | 'info' | 'success'
  label: string
  helper: string
}

const getOrderAttention = (order: AdminOrder): AdminOrderAttention | null => {
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

  if (order.paymentStatus === 'paid' && (order.status === 'confirmed' || order.status === 'packed')) {
    return {
      kind: 'paid-ready',
      tone: 'success',
      label: 'Sẵn sàng xử lý',
      helper: 'Tiền đã ghi nhận, ưu tiên đóng gói hoặc bàn giao vận chuyển.',
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
      label: 'Cần xử lý',
      helper: 'Đơn mới cần kiểm tra trước khi đóng gói.',
    }
  }

  if (order.status === 'packed') {
    return {
      kind: 'packed',
      tone: 'info',
      label: 'Chờ bàn giao',
      helper: 'Đơn đã đóng gói, có thể chuyển sang đang giao khi giao cho vận chuyển.',
    }
  }

  if (order.status === 'shipping') {
    return {
      kind: 'delivery',
      tone: 'success',
      label: 'Chờ xác nhận đã giao',
      helper: 'Có thể hoàn tất đơn khi shipper hoặc đối tác vận chuyển báo đã giao tới khách.',
    }
  }

  return null
}

const getOrderAttentionClass = (order: AdminOrder) => {
  const attention = getOrderAttention(order)
  return attention ? `admin-order-attention-badge is-${attention.tone}` : ''
}

const getOrderAttentionRank = (order: AdminOrder) => {
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

const isStatusBlockedByPayment = (order: AdminOrder, status: AdminOrderStatus) =>
  shouldWarnPaymentBeforeShipping(order) && status !== 'cancelled'

const getAddressLine = (order: AdminOrder) =>
  [
    order.shippingAddress.streetName,
    order.shippingAddress.ward,
    order.shippingAddress.district,
    order.shippingAddress.province,
  ]
    .filter(Boolean)
    .join(', ')

const formatShippingProvider = (provider?: string | null) => {
  if (!provider) return 'Chưa tạo vận đơn'

  return shippingProviderLabels[provider] ?? provider
}

const formatShippingStatus = (status?: string | null) => {
  if (!status) return 'Đang chờ'

  return shippingStatusLabels[status] ?? status
}

const getPaymentMethodMetadataText = (method: AdminCustomerPaymentMethod, key: string) => {
  const value = method.metadata?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

const getCustomerPaymentMethodSubtitle = (method: AdminCustomerPaymentMethod) => {
  const accountHolder = getPaymentMethodMetadataText(method, 'accountHolder')

  return [
    accountHolder ? `Chủ TK: ${accountHolder}` : null,
    method.maskedInfo,
    method.bankName,
    method.bankCode,
  ].filter(Boolean).join(' / ') || method.provider
}

export function OrderListPage({ currentUser }: OrdersPageProps) {
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null)
  const [transactions, setTransactions] = useState<AdminTransaction[]>([])
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([])
  const [customerPaymentMethods, setCustomerPaymentMethods] = useState<AdminCustomerPaymentMethod[]>([])
  const [keywordInput, setKeywordInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [activePaymentSectionKey, setActivePaymentSectionKey] = useState<PaymentSectionKey>('online')
  const [activeTabKey, setActiveTabKey] = useState('actionable')
  const [paymentMethod, setPaymentMethod] = useState<AdminOrderPaymentMethod | 'all'>('all')
  const [paymentStatus, setPaymentStatus] = useState<AdminOrderPaymentStatus | 'all'>('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [statusSummary, setStatusSummary] = useState<Record<AdminOrderStatus | 'all', number>>(emptyStatusSummary)
  const [operationalSummary, setOperationalSummary] = useState(emptyOperationalSummary)
  const [isLoading, setIsLoading] = useState(false)
  const [isDrawerLoading, setIsDrawerLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [notice, setNotice] = useState<Notice | null>(null)

  const activeTab = orderTabs.find((tab) => tab.key === activeTabKey) ?? orderTabs[0]
  const canUpdateOrders =
    currentUser.role === 'admin' || Boolean(currentUser.permissions?.includes('orders.update'))
  const canAdjustPayments =
    currentUser.role === 'admin' || Boolean(currentUser.permissions?.includes('payments.adjust'))
  const canReadCustomerPaymentMethods =
    currentUser.role === 'admin' ||
    Boolean(
      currentUser.permissions?.includes('customers.read') ||
      currentUser.permissions?.includes('customers.manage'),
    )
  const canManageCustomerPaymentMethods =
    currentUser.role === 'admin' || Boolean(currentUser.permissions?.includes('customers.manage'))

  const loadOrders = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage('')

    try {
      const effectivePaymentStatus = activeTab.paymentStatus ?? paymentStatus
      const effectiveLimit = activeTab.queue ? 100 : pageSize
      const sectionPaymentMethods = getPaymentSectionMethods(activePaymentSectionKey)
      const selectedPaymentMethod = activePaymentSectionKey === 'cod' ? 'COD' : paymentMethod
      const result = await listOrders({
        keyword,
        statuses: activeTab.statuses,
        paymentStatus: effectivePaymentStatus,
        paymentMethod: selectedPaymentMethod === 'all' ? undefined : selectedPaymentMethod,
        paymentMethods: selectedPaymentMethod === 'all' ? sectionPaymentMethods : undefined,
        page: activeTab.queue ? 1 : page,
        limit: effectiveLimit,
      })

      const orderedItems = [...result.items]
        .filter((order) => !activeTab.queue || getOrderQueue(order) === activeTab.queue)
        .sort((left, right) => {
          const rankDelta = getOrderAttentionRank(left) - getOrderAttentionRank(right)
          if (rankDelta !== 0) return rankDelta
          return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
        })

      setOrders(orderedItems)
      setTotalPages(activeTab.queue ? 1 : Math.max(1, result.pagination?.totalPages ?? 1))
      setStatusSummary({ ...emptyStatusSummary, ...result.statusSummary })
      setOperationalSummary({ ...emptyOperationalSummary, ...result.operationalSummary })
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }, [activePaymentSectionKey, activeTab.paymentStatus, activeTab.queue, activeTab.statuses, keyword, page, paymentMethod, paymentStatus])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setPage(1)
      setKeyword(keywordInput.trim())
    }, 320)

    return () => window.clearTimeout(handle)
  }, [keywordInput])

  useEffect(() => {
    void loadOrders()
  }, [loadOrders])

  const refreshSelectedOrder = async (orderId: string) => {
    setIsDrawerLoading(true)

    try {
      const orderDetail = await getOrder(orderId)
      const [orderTransactions, paymentMethods, orderAuditLogs] = await Promise.all([
        listOrderTransactions(orderId),
        canReadCustomerPaymentMethods
          ? listCustomerPaymentMethods(orderDetail.user_id).catch(() => [])
          : Promise.resolve([]),
        listAuditLogs({ targetType: 'Order', targetId: orderId, limit: 20 }),
      ])
      setSelectedOrder(orderDetail)
      setTransactions(orderTransactions)
      setCustomerPaymentMethods(paymentMethods)
      setAuditLogs(orderAuditLogs.items)
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setIsDrawerLoading(false)
    }
  }

  const openOrder = (order: AdminOrder) => {
    setSelectedOrder(order)
    setTransactions([])
    setAuditLogs([])
    setCustomerPaymentMethods([])
    setNotice(null)
    void refreshSelectedOrder(order._id)
  }

  const closeDrawer = () => {
    if (!actionLoading) {
      setSelectedOrder(null)
      setTransactions([])
      setAuditLogs([])
      setCustomerPaymentMethods([])
    }
  }

  const handleStatusUpdate = async (nextStatus: AdminOrderStatus) => {
    if (!selectedOrder) return

    const reason = nextStatus === 'cancelled'
      ? window.prompt('Nhập lý do hủy đơn')
      : null
    if (nextStatus === 'cancelled' && !reason?.trim()) {
      setNotice({ type: 'error', message: 'Cần nhập lý do hủy đơn' })
      return
    }

    if (nextStatus === 'delivered') {
      const confirmed = window.confirm('Xác nhận đơn đã giao tới khách? Thời hạn trả hàng 7 ngày sẽ bắt đầu từ thời điểm này.')
      if (!confirmed) return
    }

    setActionLoading(true)
    setNotice(null)

    try {
      const updatedOrder = await updateOrderStatus(selectedOrder._id, nextStatus, reason?.trim())
      setSelectedOrder(updatedOrder)
      setOrders((currentOrders) =>
        currentOrders.map((order) => (order._id === updatedOrder._id ? updatedOrder : order)),
      )
      setNotice({
        type: 'success',
        message: nextStatus === 'delivered'
          ? 'Đã đánh dấu đơn giao tới khách'
          : 'Đã cập nhật trạng thái đơn hàng',
      })
      await refreshSelectedOrder(updatedOrder._id)
      await loadOrders()
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setActionLoading(false)
    }
  }

  const handleReviewReturnRequest = async (decision: AdminReturnReviewDecision) => {
    if (!selectedOrder) return

    const promptLabel = decision === 'approved'
      ? 'Ghi chú duyệt trả hàng (có thể bỏ trống)'
      : 'Nhập lý do từ chối trả hàng'
    const reason = window.prompt(promptLabel)
    if (reason === null) return

    const normalizedReason = reason.trim()
    if (decision === 'rejected' && !normalizedReason) {
      setNotice({ type: 'error', message: 'Cần nhập lý do từ chối trả hàng' })
      return
    }

    setActionLoading(true)
    setNotice(null)

    try {
      const updatedOrder = await reviewReturnRequest(
        selectedOrder._id,
        decision,
        normalizedReason || undefined,
      )
      setSelectedOrder(updatedOrder)
      setOrders((currentOrders) =>
        currentOrders.map((order) => (order._id === updatedOrder._id ? updatedOrder : order)),
      )
      setNotice({
        type: 'success',
        message: decision === 'approved'
          ? 'Đã duyệt yêu cầu trả hàng'
          : 'Đã từ chối yêu cầu trả hàng',
      })
      await refreshSelectedOrder(updatedOrder._id)
      await loadOrders()
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setActionLoading(false)
    }
  }

  const handleShippingUpdate = async () => {
    if (!selectedOrder) return

    const provider = window.prompt('Đơn vị vận chuyển', selectedOrder.shipping?.provider ?? 'GHN')
    if (provider === null) return

    const trackingCode = window.prompt('Mã vận đơn', selectedOrder.shipping?.trackingCode ?? '')
    if (trackingCode === null) return

    const labelUrl = window.prompt('URL nhãn vận chuyển (có thể bỏ trống)', selectedOrder.shipping?.labelUrl ?? '')
    if (labelUrl === null) return

    const status = window.prompt('Trạng thái vận chuyển', selectedOrder.shipping?.status ?? 'created')
    if (status === null) return

    const actualCostText = window.prompt(
      'Chi phí vận chuyển thực tế',
      selectedOrder.shipping?.actualProviderCost !== undefined && selectedOrder.shipping?.actualProviderCost !== null
        ? String(selectedOrder.shipping.actualProviderCost)
        : '',
    )
    if (actualCostText === null) return

    const reason = window.prompt('Lý do cập nhật vận chuyển')
    if (!reason?.trim()) return

    const actualProviderCost = actualCostText.trim() ? Number(actualCostText.trim()) : null
    if (actualProviderCost !== null && (!Number.isFinite(actualProviderCost) || actualProviderCost < 0)) {
      setNotice({ type: 'error', message: 'Chi phí vận chuyển không hợp lệ' })
      return
    }

    setActionLoading(true)
    setNotice(null)

    try {
      const updatedOrder = await updateOrderShipping(selectedOrder._id, {
        provider: provider.trim() || null,
        trackingCode: trackingCode.trim() || null,
        labelUrl: labelUrl.trim() || null,
        status: status.trim() || null,
        actualProviderCost,
        reason: reason.trim(),
      })
      setSelectedOrder(updatedOrder)
      setOrders((currentOrders) =>
        currentOrders.map((order) => (order._id === updatedOrder._id ? updatedOrder : order)),
      )
      setNotice({ type: 'success', message: 'Đã cập nhật thông tin vận đơn' })
      await refreshSelectedOrder(updatedOrder._id)
      await loadOrders()
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setActionLoading(false)
    }
  }

  const handleExpireStalePayments = async () => {
    setActionLoading(true)
    setNotice(null)

    try {
      const result = await expireStalePayments()
      setNotice({
        type: 'success',
        message: `Đã hết hạn ${result.expiredCount} lượt thanh toán quá hạn, hủy ${result.cancelledOrderIds.length} đơn chưa thanh toán`,
      })
      await loadOrders()
      if (selectedOrder) {
        await refreshSelectedOrder(selectedOrder._id)
      }
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setActionLoading(false)
    }
  }

  const handleAdjustPaymentStatus = async (nextStatus: AdminOrderPaymentStatus) => {
    if (!selectedOrder) return

    const reason = window.prompt(`Nhập lý do điều chỉnh thanh toán sang "${paymentStatusLabels[nextStatus]}"`)
    if (!reason?.trim()) {
      return
    }

    setActionLoading(true)
    setNotice(null)

    try {
      const updatedOrder = await adjustOrderPaymentStatus(selectedOrder._id, nextStatus, reason.trim())
      setSelectedOrder(updatedOrder)
      setOrders((currentOrders) =>
        currentOrders.map((order) => (order._id === updatedOrder._id ? updatedOrder : order)),
      )
      setNotice({ type: 'success', message: 'Đã điều chỉnh trạng thái thanh toán' })
      await refreshSelectedOrder(updatedOrder._id)
      await loadOrders()
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setActionLoading(false)
    }
  }

  const handleUpdatePaymentMethodStatus = async (
    method: AdminCustomerPaymentMethod,
    nextStatus: AdminPaymentMethodStatus,
  ) => {
    if (!selectedOrder) return

    const reason = window.prompt(
      `Nhập lý do chuyển "${method.displayName}" sang "${paymentMethodStatusLabels[nextStatus]}"`,
    )
    if (!reason?.trim()) {
      return
    }

    setActionLoading(true)
    setNotice(null)

    try {
      await updateCustomerPaymentMethodStatus(method._id, nextStatus, reason.trim())
      setNotice({ type: 'success', message: 'Đã cập nhật phương thức thanh toán của khách hàng' })
      await refreshSelectedOrder(selectedOrder._id)
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <section className="admin-orders-page" aria-busy={isLoading}>
      <header className="admin-page-heading">
        <div>
          <p>Vận hành đơn hàng</p>
          <h1>Hóa đơn & đơn hàng</h1>
        </div>

        <div className="admin-page-actions">
          <button
            className="admin-secondary-button"
            type="button"
            disabled={!canUpdateOrders || actionLoading}
            onClick={() => void handleExpireStalePayments()}
          >
            Hết hạn thanh toán quá hạn
          </button>
          <button className="admin-secondary-button" type="button" onClick={() => void loadOrders()}>
            Tải lại
          </button>
        </div>
      </header>

      <section className="admin-payment-sections" aria-label="Phân luồng thanh toán">
        {paymentSections.map((section) => {
          const isActiveSection = section.key === activePaymentSectionKey

          return (
            <article
              className={`admin-payment-section-panel is-${section.key}${isActiveSection ? ' is-active' : ''}`}
              key={section.key}
            >
              <button
                className="admin-payment-section-card"
                type="button"
                aria-expanded={isActiveSection}
                onClick={() => {
                  setActivePaymentSectionKey(section.key)
                  setPaymentMethod(section.key === 'cod' ? 'COD' : 'all')
                  setPaymentStatus('all')
                  setPage(1)
                }}
              >
                <span>{isActiveSection ? 'Đang mở' : 'Luồng xử lý'}</span>
                <strong>{section.label}</strong>
                <small>{section.helper}</small>
              </button>

              {isActiveSection ? (
                <div className="admin-payment-section-content">
                  <div className="admin-order-tabs" role="tablist" aria-label="Phân loại đơn hàng">
                    {orderTabs.map((tab) => {
                      const tabCount = getTabCount(tab, statusSummary, operationalSummary)

                      return (
                        <button
                          className={getTabClass(tab, activeTabKey)}
                          key={tab.key}
                          type="button"
                          role="tab"
                          aria-selected={tab.key === activeTabKey}
                          onClick={() => {
                            setActiveTabKey(tab.key)
                            setPaymentStatus('all')
                            setPage(1)
                          }}
                        >
                          <span className="admin-order-tab-label">
                            <span>{tab.label}</span>
                            <span className="admin-order-tab-count" aria-label={`${tabCount} đơn`}>
                              {tabCount}
                            </span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : null}
            </article>
          )
        })}
      </section>

      <div className="admin-table-toolbar">
        <label className="admin-user-search">
          <span>Tìm kiếm</span>
          <input
            type="search"
            value={keywordInput}
            onChange={(event) => setKeywordInput(event.target.value)}
            placeholder="Mã đơn, hóa đơn hoặc sản phẩm"
          />
        </label>

        <label>
          <span>Phương thức</span>
          <select
            value={activePaymentSectionKey === 'cod' ? 'COD' : paymentMethod}
            disabled={activePaymentSectionKey === 'cod'}
            onChange={(event) => {
              setPaymentMethod(event.target.value as AdminOrderPaymentMethod | 'all')
              setPage(1)
            }}
          >
            <option value="all">Tất cả online</option>
            {getPaymentSectionMethods(activePaymentSectionKey).map((value) => (
              <option key={value} value={value}>
                {paymentMethodLabels[value]}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Trạng thái thanh toán</span>
          <select
            value={activeTab.paymentStatus ?? paymentStatus}
            disabled={Boolean(activeTab.paymentStatus)}
            onChange={(event) => {
              setPaymentStatus(event.target.value as AdminOrderPaymentStatus | 'all')
              setPage(1)
            }}
          >
            <option value="all">Tất cả</option>
            {Object.entries(paymentStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {notice ? (
        <p className={`admin-notice is-${notice.type}`} role="status">
          {notice.message}
        </p>
      ) : null}

      {errorMessage ? (
        <div className="admin-empty-state" role="alert">
          <strong>Không tải được đơn hàng</strong>
          <span>{errorMessage}</span>
          <button className="admin-secondary-button" type="button" onClick={() => void loadOrders()}>
            Thử lại
          </button>
        </div>
      ) : (
        <div className="admin-table-shell">
          <table className="admin-table admin-orders-table">
            <thead>
              <tr>
                <th>Đơn hàng</th>
                <th>Khách hàng</th>
                <th>Tổng tiền</th>
                <th>Thanh toán</th>
                <th>Trạng thái</th>
                <th>Giao hàng</th>
                <th>Ngày tạo</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8}>
                    <div className="admin-table-loading">Đang tải đơn hàng...</div>
                  </td>
                </tr>
              ) : null}

              {!isLoading && orders.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="admin-table-loading">Không có đơn hàng phù hợp.</div>
                  </td>
                </tr>
              ) : null}

              {!isLoading
                ? orders.map((order) => (
                    <tr className={getOrderRowClass(order)} key={order._id}>
                      <td>
                        <div className="admin-order-code-cell">
                          <strong>{order.orderCode}</strong>
                          <span>{order.invoiceCode || 'Chưa có hóa đơn'}</span>
                          {getOrderAttention(order) ? (
                            <em className={getOrderAttentionClass(order)}>
                              {getOrderAttention(order)?.label}
                            </em>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <div className="admin-contact-cell">
                          <span>{order.shippingAddress.customerName}</span>
                          <small>{order.shippingAddress.phoneNumber}</small>
                        </div>
                      </td>
                      <td>
                        <strong>{formatCurrency(order.totalAmount)}</strong>
                        <span>{order.order_list.length} sản phẩm</span>
                      </td>
                      <td>
                        <div className="admin-order-payment-cell">
                          <strong>{paymentMethodLabels[order.paymentMethod]}</strong>
                          <span className={getPaymentPillClass(order.paymentStatus)}>
                            {paymentStatusLabels[order.paymentStatus]}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="admin-order-status-cell">
                          <span className={getOrderPillClass(order.status)}>
                            {statusLabels[order.status]}
                          </span>
                          <OrderProgressRail compact status={order.status} />
                        </div>
                      </td>
                      <td>
                        <div className="admin-shipping-cell">
                          <strong>{formatShippingProvider(order.shipping?.provider)}</strong>
                          <span className={getShippingPillClass(order.shipping?.status)}>
                            {order.shipping?.trackingCode || formatShippingStatus(order.shipping?.status)}
                          </span>
                        </div>
                      </td>
                      <td>{formatDate(order.createdAt)}</td>
                      <td>
                        <button className="admin-link-button" type="button" onClick={() => openOrder(order)}>
                          Chi tiết
                        </button>
                      </td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>
      )}

      <footer className="admin-table-footer">
        <span>
          Trang {page} / {totalPages}
        </span>
        <div>
          <button
            className="admin-secondary-button"
            type="button"
            disabled={page <= 1 || isLoading}
            onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
          >
            Trước
          </button>
          <button
            className="admin-secondary-button"
            type="button"
            disabled={page >= totalPages || isLoading}
            onClick={() => setPage((currentPage) => Math.min(totalPages, currentPage + 1))}
          >
            Sau
          </button>
        </div>
      </footer>

      {selectedOrder ? (
        <OrderDetailDrawer
          canAdjustPayments={canAdjustPayments}
          canManageCustomerPaymentMethods={canManageCustomerPaymentMethods}
          canReadCustomerPaymentMethods={canReadCustomerPaymentMethods}
          canUpdateOrders={canUpdateOrders}
          isActionLoading={actionLoading}
          isLoading={isDrawerLoading}
          auditLogs={auditLogs}
          order={selectedOrder}
          paymentMethods={customerPaymentMethods}
          transactions={transactions}
          onClose={closeDrawer}
          onAdjustPaymentStatus={(status) => void handleAdjustPaymentStatus(status)}
          onUpdatePaymentMethodStatus={(method, status) => void handleUpdatePaymentMethodStatus(method, status)}
          onRefresh={() => void refreshSelectedOrder(selectedOrder._id)}
          onReviewReturnRequest={(decision) => void handleReviewReturnRequest(decision)}
          onShippingUpdate={() => void handleShippingUpdate()}
          onStatusUpdate={(status) => void handleStatusUpdate(status)}
        />
      ) : null}
    </section>
  )
}

function OrderDetailDrawer({
  canAdjustPayments,
  canManageCustomerPaymentMethods,
  canReadCustomerPaymentMethods,
  canUpdateOrders,
  isActionLoading,
  isLoading,
  auditLogs,
  order,
  paymentMethods,
  transactions,
  onClose,
  onAdjustPaymentStatus,
  onUpdatePaymentMethodStatus,
  onRefresh,
  onReviewReturnRequest,
  onShippingUpdate,
  onStatusUpdate,
}: {
  canAdjustPayments: boolean
  canManageCustomerPaymentMethods: boolean
  canReadCustomerPaymentMethods: boolean
  canUpdateOrders: boolean
  isActionLoading: boolean
  isLoading: boolean
  auditLogs: AdminAuditLog[]
  order: AdminOrder
  paymentMethods: AdminCustomerPaymentMethod[]
  transactions: AdminTransaction[]
  onClose: () => void
  onAdjustPaymentStatus: (status: AdminOrderPaymentStatus) => void
  onUpdatePaymentMethodStatus: (method: AdminCustomerPaymentMethod, status: AdminPaymentMethodStatus) => void
  onRefresh: () => void
  onReviewReturnRequest: (decision: AdminReturnReviewDecision) => void
  onShippingUpdate: () => void
  onStatusUpdate: (status: AdminOrderStatus) => void
}) {
  const statusOptions = nextStatusOptions[order.status] ?? []
  const hasPendingReturnRequest = order.status === 'return_requested' && order.returnRequest?.status === 'requested'
  const attention = getOrderAttention(order)
  const returnWindowStatus = getReturnWindowStatus(order)

  return (
    <div className="admin-drawer-layer" role="dialog" aria-modal="true" aria-labelledby="admin-order-title">
      <button className="admin-drawer-backdrop" type="button" aria-label="Đóng chi tiết" onClick={onClose} />
      <aside className={`admin-user-drawer admin-order-drawer ${getOrderRowClass(order)}`}>
        <header className="admin-drawer-header">
          <div className="admin-user-identity">
            <span className="admin-user-avatar" aria-hidden="true">
              {order.orderCode.slice(-2)}
            </span>
            <div>
              <h2 id="admin-order-title">{order.orderCode}</h2>
              <p>{order.shippingAddress.customerName}</p>
            </div>
          </div>
          <div className="admin-order-drawer-status">
            <span className={getOrderPillClass(order.status)}>{statusLabels[order.status]}</span>
            <span className={getPaymentPillClass(order.paymentStatus)}>{paymentStatusLabels[order.paymentStatus]}</span>
            {returnWindowStatus ? (
              <span className={returnWindowStatus.className}>{returnWindowStatus.label}</span>
            ) : null}
          </div>
          <button className="admin-secondary-button" type="button" onClick={onClose}>
            Đóng
          </button>
        </header>

        {isLoading ? <div className="admin-drawer-loading">Đang tải chi tiết...</div> : null}

        {attention ? (
          <div className={`admin-order-attention-callout is-${attention.tone}`} role="status">
            <strong>{attention.label}</strong>
            <span>{attention.helper}</span>
          </div>
        ) : null}

        {shouldWarnPaymentBeforeShipping(order) ? (
          <p className="admin-notice is-error admin-order-warning" role="alert">
            Đơn online chưa thanh toán. Hệ thống chỉ cho hủy đơn hoặc điều chỉnh thanh toán sau khi đối soát.
          </p>
        ) : null}

        <section className="admin-drawer-section">
          <h3>Tổng quan</h3>
          <OrderProgressRail status={order.status} />
          <div className="admin-detail-grid">
            <div className="admin-detail-card is-order">
              <span>Trạng thái đơn</span>
              <strong className={getOrderPillClass(order.status)}>{statusLabels[order.status]}</strong>
            </div>
            <div className="admin-detail-card is-payment">
              <span>Trạng thái thanh toán</span>
              <strong className={getPaymentPillClass(order.paymentStatus)}>{paymentStatusLabels[order.paymentStatus]}</strong>
            </div>
            <div className="admin-detail-card is-method">
              <span>Phương thức</span>
              <strong>{paymentMethodLabels[order.paymentMethod]}</strong>
            </div>
            <div className="admin-detail-card is-total">
              <span>Tổng tiền</span>
              <strong>{formatCurrency(order.totalAmount)}</strong>
            </div>
            <div className="admin-detail-card is-delivery">
              <span>Đã giao lúc</span>
              <strong>{formatDate(order.deliveredAt)}</strong>
            </div>
          </div>
        </section>

        {order.cancellation ? (
          <section className="admin-drawer-section">
            <div className="admin-section-inline-heading">
              <h3>Thông tin hủy đơn</h3>
              {order.paymentStatus === 'paid' ? (
                <span className="admin-status-pill is-warning">Cần hoàn tiền</span>
              ) : (
                <span className="admin-status-pill is-blocked">Đã hủy</span>
              )}
            </div>
            <article className="admin-return-request-card">
              <p>{order.cancellation.reason || 'Không có lý do hủy.'}</p>
              <dl>
                <div>
                  <dt>Hủy lúc</dt>
                  <dd>{formatDate(order.cancellation.cancelledAt)}</dd>
                </div>
                <div>
                  <dt>Người hủy</dt>
                  <dd>{order.cancellation.actorRole || 'Chưa có'}</dd>
                </div>
              </dl>
              {order.cancellation.imageUrls?.length ? (
                <div className="admin-evidence-grid">
                  {order.cancellation.imageUrls.map((imageUrl) => (
                    <a href={imageUrl} key={imageUrl} target="_blank" rel="noreferrer">
                      <img src={imageUrl} alt="Minh chứng hủy đơn" />
                    </a>
                  ))}
                </div>
              ) : null}
            </article>
          </section>
        ) : null}

        {order.returnRequest ? (
          <section className="admin-drawer-section">
            <div className="admin-section-inline-heading">
              <h3>Yêu cầu trả hàng</h3>
              <span className={getReturnRequestPillClass(order.returnRequest.status)}>
                {returnRequestStatusLabels[order.returnRequest.status]}
              </span>
            </div>
            <article className="admin-return-request-card">
              <strong className="admin-return-policy-note">
                Chính sách trả hàng: 7 ngày từ lúc đơn được giao tới khách.
              </strong>
              <p>{order.returnRequest.reason}</p>
              <dl>
                <div>
                  <dt>Gửi lúc</dt>
                  <dd>{formatDate(order.returnRequest.requestedAt)}</dd>
                </div>
                <div>
                  <dt>Xử lý lúc</dt>
                  <dd>{formatDate(order.returnRequest.reviewedAt)}</dd>
                </div>
                <div>
                  <dt>Người duyệt</dt>
                  <dd>{order.returnRequest.reviewedBy || 'Chưa có'}</dd>
                </div>
                <div>
                  <dt>Ghi chú</dt>
                  <dd>{order.returnRequest.reviewReason || 'Chưa có'}</dd>
                </div>
              </dl>
              {order.returnRequest.imageUrls?.length ? (
                <div className="admin-evidence-grid">
                  {order.returnRequest.imageUrls.map((imageUrl) => (
                    <a href={imageUrl} key={imageUrl} target="_blank" rel="noreferrer">
                      <img src={imageUrl} alt="Minh chứng trả hàng" />
                    </a>
                  ))}
                </div>
              ) : null}
            </article>
          </section>
        ) : null}

        <section className="admin-drawer-section">
          <h3>Phương thức thanh toán của khách hàng</h3>
          {!canReadCustomerPaymentMethods ? (
            <p className="admin-muted-text">Cần quyền customers.read để xem phương thức thanh toán của khách.</p>
          ) : paymentMethods.length === 0 ? (
            <p className="admin-muted-text">Khách hàng chưa lưu phương thức thanh toán nào.</p>
          ) : (
            <div className="admin-payment-method-list">
              {paymentMethods.map((method) => {
                const statusActions = getPaymentMethodStatusActions(method.status)

                return (
                  <article className="admin-payment-method-card" key={method._id}>
                    <div>
                      <strong>{method.displayName}</strong>
                      <span>{getCustomerPaymentMethodSubtitle(method)}</span>
                    </div>
                    <div className="admin-payment-method-actions">
                      <span className={getPaymentMethodStatusClass(method.status)}>
                        {paymentMethodStatusLabels[method.status]}
                      </span>
                      {method.isDefault ? <span className="admin-status-pill is-warning">Mặc định</span> : null}
                      {statusActions.map((action) => (
                        <button
                          className={action.className}
                          type="button"
                          key={action.status}
                          disabled={!canManageCustomerPaymentMethods || isActionLoading}
                          onClick={() => onUpdatePaymentMethodStatus(method, action.status)}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
          {!canManageCustomerPaymentMethods ? (
            <p className="admin-permission-note">Cần quyền customers.manage để cập nhật phương thức thanh toán.</p>
          ) : null}
        </section>

        <section className="admin-drawer-section">
          <div className="admin-section-inline-heading">
            <h3>Khách hàng & giao hàng</h3>
            <button
              className="admin-link-button"
              type="button"
              disabled={!canUpdateOrders || isActionLoading}
              onClick={onShippingUpdate}
            >
              Cập nhật vận đơn
            </button>
          </div>
          <div className="admin-address-block">
            <strong>{order.shippingAddress.customerName}</strong>
            <span>{order.shippingAddress.phoneNumber}</span>
            <p>{getAddressLine(order)}</p>
          </div>
          <div className="admin-detail-grid">
            <div>
              <span>Đơn vị</span>
              <strong>{formatShippingProvider(order.shipping?.provider)}</strong>
            </div>
            <div>
              <span>Mã vận đơn</span>
              <strong>{order.shipping?.trackingCode || 'Chưa có'}</strong>
            </div>
            <div>
              <span>Phí khách trả</span>
              <strong>{formatCurrency(order.shippingFee)}</strong>
            </div>
            <div>
              <span>Chi phí thực tế</span>
              <strong>{formatCurrency(order.shipping?.actualProviderCost ?? 0)}</strong>
            </div>
          </div>
        </section>

        <section className="admin-drawer-section">
          <h3>Sản phẩm</h3>
          <div className="admin-order-item-list">
            {order.order_list.map((item) => (
              <div className="admin-order-item" key={item._id ?? item.sku}>
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.color} / {item.size} / {item.fitType}</span>
                </div>
                <span>
                  {item.quantity} x {formatCurrency(item.priceAtPurchased)}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-drawer-section">
          <div className="admin-section-inline-heading">
            <h3>Lượt thanh toán</h3>
            <button className="admin-link-button" type="button" onClick={onRefresh}>
              Tải lại
            </button>
          </div>
          {transactions.length === 0 ? (
            <p className="admin-muted-text">Chưa có giao dịch cho đơn này.</p>
          ) : (
            <div className="admin-payment-timeline">
              {transactions.map((transaction) => (
                <article className="admin-payment-attempt" key={transaction._id}>
                  <header>
                    <strong>Lượt #{transaction.attemptNo ?? '?'}</strong>
                    <span className={transaction.status === 'success' ? 'is-success' : transaction.status === 'pending' ? 'is-pending' : 'is-failed'}>
                      {transactionStatusLabels[transaction.status]}
                    </span>
                  </header>
                  <dl>
                    <div>
                      <dt>Mã giao dịch</dt>
                      <dd>{transaction.txnRef || 'Chưa có'}</dd>
                    </div>
                    <div>
                      <dt>Cổng thanh toán</dt>
                      <dd>{transaction.gatewayProvider || transaction.paymentMethod}</dd>
                    </div>
                    <div>
                      <dt>Số tiền</dt>
                      <dd>{formatCurrency(transaction.amount)}</dd>
                    </div>
                    <div>
                      <dt>Tạo lúc</dt>
                      <dd>{formatDate(transaction.createdAt)}</dd>
                    </div>
                    <div>
                      <dt>Hết hạn lúc</dt>
                      <dd>{formatDate(transaction.expiredAt)}</dd>
                    </div>
                    <div>
                      <dt>Xử lý lúc</dt>
                      <dd>{formatDate(transaction.resolvedAt)}</dd>
                    </div>
                  </dl>
                  {transaction.failureReason ? (
                    <p>{transaction.failureReason}</p>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="admin-drawer-section">
          <h3>Điều chỉnh thanh toán thủ công</h3>
          <p className="admin-muted-text">Chỉ dùng khi đã đối soát ngoài cổng thanh toán. Lý do bắt buộc và sẽ ghi nhật ký thao tác.</p>
          <div className="admin-drawer-actions">
            {(['paid', 'failed', 'refunded', 'pending'] as AdminOrderPaymentStatus[]).map((status) => (
              <button
                className={status === 'paid' ? 'admin-primary-button' : 'admin-secondary-button'}
                key={status}
                type="button"
                disabled={!canAdjustPayments || isActionLoading || order.paymentStatus === status}
                onClick={() => onAdjustPaymentStatus(status)}
              >
                {paymentStatusLabels[status]}
              </button>
            ))}
          </div>
          {!canAdjustPayments ? (
            <p className="admin-permission-note">Cần quyền payments.adjust để điều chỉnh thanh toán.</p>
          ) : null}
        </section>

        <section className="admin-drawer-section">
          <div className="admin-section-inline-heading">
            <h3>Nhật ký thao tác</h3>
            <button className="admin-link-button" type="button" onClick={onRefresh}>
              Tải lại
            </button>
          </div>
          {auditLogs.length === 0 ? (
            <p className="admin-muted-text">Chưa có nhật ký thao tác cho đơn này.</p>
          ) : (
            <div className="admin-audit-log-list">
              {auditLogs.map((log) => (
                <article className="admin-audit-log-card" key={log._id}>
                  <header>
                    <strong>{auditActionLabels[log.action]}</strong>
                    <span>{formatDate(log.createdAt)}</span>
                  </header>
                  <p>{log.reason || 'Không có lý do'}</p>
                  <dl>
                    <div>
                      <dt>Người thực hiện</dt>
                      <dd>{actorRoleLabels[log.actorRole]}{log.actorId ? ` / ${log.actorId}` : ''}</dd>
                    </div>
                    <div>
                      <dt>Đối tượng</dt>
                      <dd>{auditTargetTypeLabels[log.targetType] ?? log.targetType}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="admin-drawer-section">
          <h3>Xử lý đơn</h3>
          {hasPendingReturnRequest ? (
            <div className="admin-drawer-actions">
              <button
                className="admin-primary-button"
                type="button"
                disabled={!canUpdateOrders || isActionLoading}
                onClick={() => onReviewReturnRequest('approved')}
              >
                {isActionLoading ? 'Đang xử lý...' : 'Duyệt trả hàng'}
              </button>
              <button
                className="admin-danger-button"
                type="button"
                disabled={!canUpdateOrders || isActionLoading}
                onClick={() => onReviewReturnRequest('rejected')}
              >
                {isActionLoading ? 'Đang xử lý...' : 'Từ chối'}
              </button>
            </div>
          ) : statusOptions.length === 0 ? (
            <p className="admin-muted-text">{getNoNextOrderStepMessage(order)}</p>
          ) : (
            <div className="admin-drawer-actions">
              {statusOptions.map((status) => {
                const blockedByPayment = isStatusBlockedByPayment(order, status)

                return (
                  <button
                    className={status === 'cancelled' ? 'admin-danger-button' : 'admin-primary-button'}
                    key={status}
                    type="button"
                    disabled={!canUpdateOrders || isActionLoading || blockedByPayment}
                    title={blockedByPayment ? 'Đơn online cần thanh toán trước khi xử lý.' : undefined}
                    onClick={() => onStatusUpdate(status)}
                  >
                    {isActionLoading ? 'Đang xử lý...' : getStatusActionLabel(status)}
                  </button>
                )
              })}
            </div>
          )}
          {!canUpdateOrders ? (
            <p className="admin-permission-note">Tài khoản này chỉ có quyền xem đơn hàng.</p>
          ) : null}
        </section>
      </aside>
    </div>
  )
}
