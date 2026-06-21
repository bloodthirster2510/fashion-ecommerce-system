import { type FormEvent, useCallback, useEffect, useState } from 'react'
import type { AdminUser } from '../auth/adminSession'
import {
  adjustOrderPaymentStatus,
  cancelGhnShipment,
  createGhnShipment,
  expireStalePayments,
  getOrder,
  listAuditLogs,
  listCustomerPaymentMethods,
  listOrderTransactions,
  listOrders,
  reviewReturnRequest,
  simulateShippingWebhook,
  syncGhnShipment,
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
import { requestAdminNotificationRefresh } from '../../notifications/notification-summary-events'

type OrdersPageProps = {
  currentUser: AdminUser
  paymentSection?: PaymentSectionKey
  lockPaymentSection?: boolean
  initialTabKey?: string
}

type OrderTab = {
  key: string
  label: string
  helper?: string
  group: OrderTabGroupKey
  statuses?: AdminOrderStatus[]
  paymentStatus?: AdminOrderPaymentStatus
  queue?: OrderQueueKey
}

type OrderTabGroupKey = 'flow' | 'exceptions' | 'lookup'
type OrderQueueKey = 'packing' | 'handoff' | 'delivery' | 'blocked' | 'review' | 'refund'
type PaymentSectionKey = 'online' | 'cod'
type ShippingSimulationStatus = 'picked' | 'shipping' | 'delivered' | 'failed'

type Notice = {
  type: 'success' | 'error'
  message: string
}

type ShippingUpdateDialogValues = {
  provider: string
  trackingCode: string
  labelUrl: string
  status: string
  actualProviderCost: string
  reason: string
}

type OrderActionDialogState =
  | {
      type: 'status'
      order: AdminOrder
      nextStatus: AdminOrderStatus
    }
  | {
      type: 'return-review'
      order: AdminOrder
      decision: AdminReturnReviewDecision
    }
  | {
      type: 'shipping'
      order: AdminOrder
      values: ShippingUpdateDialogValues
    }
  | {
      type: 'cancel-ghn'
      order: AdminOrder
    }
  | {
      type: 'payment-status'
      order: AdminOrder
      nextStatus: AdminOrderPaymentStatus
    }
  | {
      type: 'payment-method-status'
      order: AdminOrder
      method: AdminCustomerPaymentMethod
      nextStatus: AdminPaymentMethodStatus
    }

type OrderActionDialogInput = {
  reason?: string
  shipping?: ShippingUpdateDialogValues
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
  packingReady: 0,
  handoffReady: 0,
  readyToProcess: 0,
  deliveryConfirmations: 0,
  paymentRisk: 0,
  totalPriority: 0,
}

const onlinePaymentMethods: AdminOrderPaymentMethod[] = ['VNPAY', 'MOMO', 'CARD', 'BANK']
const codPaymentMethods: AdminOrderPaymentMethod[] = ['COD']
const allPaymentMethods: AdminOrderPaymentMethod[] = [...onlinePaymentMethods, ...codPaymentMethods]

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
    key: 'all',
    label: 'Tất cả',
    helper: 'Tra cứu toàn bộ đơn, hóa đơn, thanh toán và vận chuyển.',
    group: 'lookup',
  },
]

const orderTabGroups: Array<{
  key: OrderTabGroupKey
  label: string
}> = [
  { key: 'flow', label: 'Luồng vận hành' },
  { key: 'exceptions', label: 'Phát sinh cần xử lý' },
  { key: 'lookup', label: 'Tra cứu' },
]

const resolveInitialTabKey = (value: string | undefined, lockPaymentSection: boolean) =>
  orderTabs.some((tab) => tab.key === value) ? value as string : lockPaymentSection ? 'packing' : 'all'

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
  'order.shipping_webhook': 'Webhook vận chuyển',
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

const shippingSimulationActions: Array<{
  status: ShippingSimulationStatus
  label: string
  className: 'admin-secondary-button' | 'admin-primary-button' | 'admin-danger-button'
}> = [
  { status: 'picked', label: 'Đã lấy hàng', className: 'admin-secondary-button' },
  { status: 'shipping', label: 'Đang giao', className: 'admin-secondary-button' },
  { status: 'delivered', label: 'Đã giao', className: 'admin-primary-button' },
  { status: 'failed', label: 'Giao thất bại', className: 'admin-danger-button' },
]

const nextStatusOptions: Partial<Record<AdminOrderStatus, AdminOrderStatus[]>> = {
  confirmed: ['packed', 'cancelled'],
  packed: ['cancelled'],
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
  if (isBlockedOrder(order)) return null
  if (order.status === 'confirmed') return 'packing'
  if (order.status === 'packed') return 'handoff'
  if (order.status === 'shipping') return 'delivery'

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
  if (queue === 'packing') return operationalSummary.packingReady ?? 0
  if (queue === 'handoff') return operationalSummary.handoffReady ?? 0
  if (queue === 'delivery') return operationalSummary.deliveryConfirmations ?? summary.shipping

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

const canSimulateShippingStatus = (order: AdminOrder, status: ShippingSimulationStatus) => {
  if (order.shipping?.status === 'failed') return status === 'shipping' && order.status === 'shipping'
  if (status === 'picked') return order.status === 'packed'
  if (status === 'shipping') return order.status === 'packed' || order.status === 'shipping'
  if (status === 'delivered' || status === 'failed') return order.status === 'shipping'

  return false
}

const hasActiveGhnShipment = (order: AdminOrder) =>
  order.shipping?.provider === 'GHN' &&
  Boolean(order.shipping?.trackingCode) &&
  order.shipping?.status !== 'cancelled'

const canCreateGhnShipment = (order: AdminOrder) => {
  const paymentReady = order.paymentMethod === 'COD' || order.paymentStatus === 'paid'

  return order.status === 'packed' && paymentReady && !hasActiveGhnShipment(order)
}

const canCancelGhnShipment = (order: AdminOrder) =>
  order.shipping?.provider === 'GHN' &&
  Boolean(order.shipping?.trackingCode) &&
  order.shipping?.status !== 'delivered' &&
  order.shipping?.status !== 'cancelled' &&
  (order.status === 'packed' || order.status === 'cancelled')

const canSyncGhnShipment = (order: AdminOrder) =>
  order.shipping?.provider === 'GHN' && Boolean(order.shipping?.trackingCode)

const getShippingSimulationActionLabel = (
  order: AdminOrder,
  action: (typeof shippingSimulationActions)[number],
) => {
  if (action.status === 'shipping' && order.shipping?.status === 'failed') {
    return 'Giao lại'
  }

  return action.label
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

const getShippingUpdateDialogValues = (order: AdminOrder): ShippingUpdateDialogValues => ({
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

export function OrderListPage({
  currentUser,
  paymentSection = 'online',
  lockPaymentSection = false,
  initialTabKey,
}: OrdersPageProps) {
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null)
  const [transactions, setTransactions] = useState<AdminTransaction[]>([])
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([])
  const [customerPaymentMethods, setCustomerPaymentMethods] = useState<AdminCustomerPaymentMethod[]>([])
  const [keywordInput, setKeywordInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [activePaymentSectionKey, setActivePaymentSectionKey] = useState<PaymentSectionKey>(paymentSection)
  const [activeTabKey, setActiveTabKey] = useState(() => resolveInitialTabKey(initialTabKey, lockPaymentSection))
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
  const [actionDialog, setActionDialog] = useState<OrderActionDialogState | null>(null)
  const [actionDialogError, setActionDialogError] = useState('')

  const isLookupMode = !lockPaymentSection
  const activeTab = orderTabs.find((tab) => tab.key === activeTabKey) ?? orderTabs[0]
  const activePaymentSection =
    paymentSections.find((section) => section.key === activePaymentSectionKey) ?? paymentSections[0]
  const pageTitle = lockPaymentSection ? activePaymentSection.label : 'Tra cứu hóa đơn & đơn hàng'
  const pageHelper = lockPaymentSection ? activePaymentSection.helper : 'Tìm theo mã đơn, mã hóa đơn, khách hàng hoặc sản phẩm'
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

  useEffect(() => {
    setActivePaymentSectionKey(paymentSection)
    setPaymentMethod(paymentSection === 'cod' ? 'COD' : 'all')
    setPaymentStatus('all')
    setActiveTabKey(resolveInitialTabKey(initialTabKey, lockPaymentSection))
    setPage(1)
  }, [initialTabKey, lockPaymentSection, paymentSection])

  const loadOrders = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage('')

    try {
      const effectivePaymentStatus = activeTab.paymentStatus ?? paymentStatus
      const effectiveLimit = activeTab.queue ? 100 : pageSize
      const sectionPaymentMethods = isLookupMode ? undefined : getPaymentSectionMethods(activePaymentSectionKey)
      const selectedPaymentMethod = !isLookupMode && activePaymentSectionKey === 'cod' ? 'COD' : paymentMethod
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
          return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
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
  }, [activePaymentSectionKey, activeTab.paymentStatus, activeTab.queue, activeTab.statuses, isLookupMode, keyword, page, paymentMethod, paymentStatus])

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

  const openActionDialog = (dialog: OrderActionDialogState) => {
    setActionDialogError('')
    setActionDialog(dialog)
  }

  const closeActionDialog = () => {
    if (!actionLoading) {
      setActionDialog(null)
      setActionDialogError('')
    }
  }

  const closeDrawer = () => {
    if (!actionLoading) {
      setSelectedOrder(null)
      setTransactions([])
      setAuditLogs([])
      setCustomerPaymentMethods([])
      setActionDialog(null)
      setActionDialogError('')
    }
  }

  const handleStatusUpdate = async (nextStatus: AdminOrderStatus) => {
    if (!selectedOrder) return

    if (nextStatus === 'cancelled' || nextStatus === 'delivered') {
      openActionDialog({ type: 'status', order: selectedOrder, nextStatus })
      return
    }

    await executeStatusUpdate(selectedOrder, nextStatus)
  }

  const executeStatusUpdate = async (
    order: AdminOrder,
    nextStatus: AdminOrderStatus,
    reason?: string,
  ) => {
    setActionDialog(null)
    setActionDialogError('')

    setActionLoading(true)
    setNotice(null)

    try {
      const updatedOrder = await updateOrderStatus(order._id, nextStatus, reason?.trim())
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
      requestAdminNotificationRefresh()
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setActionLoading(false)
    }
  }

  const handleReviewReturnRequest = async (decision: AdminReturnReviewDecision) => {
    if (!selectedOrder) return

    openActionDialog({ type: 'return-review', order: selectedOrder, decision })
  }

  const executeReviewReturnRequest = async (
    order: AdminOrder,
    decision: AdminReturnReviewDecision,
    reason?: string,
  ) => {
    const normalizedReason = (reason ?? '').trim()

    setActionDialog(null)
    setActionDialogError('')

    setActionLoading(true)
    setNotice(null)

    try {
      const updatedOrder = await reviewReturnRequest(
        order._id,
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
      requestAdminNotificationRefresh()
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setActionLoading(false)
    }
  }

  const handleShippingUpdate = async () => {
    if (!selectedOrder) return

    openActionDialog({
      type: 'shipping',
      order: selectedOrder,
      values: getShippingUpdateDialogValues(selectedOrder),
    })
  }

  const executeShippingUpdate = async (order: AdminOrder, values: ShippingUpdateDialogValues) => {
    const actualCostText = values.actualProviderCost.trim()
    const reason = values.reason.trim()

    const actualProviderCost = actualCostText ? Number(actualCostText) : null
    if (actualProviderCost !== null && (!Number.isFinite(actualProviderCost) || actualProviderCost < 0)) {
      setActionDialogError('Chi phí vận chuyển không hợp lệ')
      return
    }

    if (!reason) {
      setActionDialogError('Cần nhập lý do cập nhật vận chuyển')
      return
    }

    setActionDialog(null)
    setActionDialogError('')
    setActionLoading(true)
    setNotice(null)

    try {
      const updatedOrder = await updateOrderShipping(order._id, {
        provider: values.provider.trim() || null,
        trackingCode: values.trackingCode.trim() || null,
        labelUrl: values.labelUrl.trim() || null,
        status: values.status.trim() || null,
        actualProviderCost,
        reason,
      })
      setSelectedOrder(updatedOrder)
      setOrders((currentOrders) =>
        currentOrders.map((order) => (order._id === updatedOrder._id ? updatedOrder : order)),
      )
      setNotice({ type: 'success', message: 'Đã cập nhật thông tin vận đơn' })
      await refreshSelectedOrder(updatedOrder._id)
      await loadOrders()
      requestAdminNotificationRefresh()
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setActionLoading(false)
    }
  }

  const handleSimulateShippingStatus = async (nextShippingStatus: ShippingSimulationStatus) => {
    if (!selectedOrder) return

    if (!canSimulateShippingStatus(selectedOrder, nextShippingStatus)) {
      setNotice({ type: 'error', message: 'Trạng thái giao hàng chưa phù hợp với bước hiện tại của đơn.' })
      return
    }

    const simulationAction = shippingSimulationActions.find((action) => action.status === nextShippingStatus)
    const actionLabel = simulationAction
      ? getShippingSimulationActionLabel(selectedOrder, simulationAction)
      : formatShippingStatus(nextShippingStatus)
    const reason = `Mô phỏng đơn vị vận chuyển: ${actionLabel}`

    setActionLoading(true)
    setNotice(null)

    try {
      const updatedOrder = await simulateShippingWebhook(selectedOrder._id, {
        status: nextShippingStatus,
        reason,
        provider: selectedOrder.shipping?.provider ?? 'GHN',
        trackingCode: selectedOrder.shipping?.trackingCode ?? null,
      })

      setSelectedOrder(updatedOrder)
      setOrders((currentOrders) =>
        currentOrders.map((order) => (order._id === updatedOrder._id ? updatedOrder : order)),
      )
      setNotice({ type: 'success', message: `Đã nhận webhook vận chuyển: ${actionLabel}` })
      await refreshSelectedOrder(updatedOrder._id)
      await loadOrders()
      requestAdminNotificationRefresh()
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setActionLoading(false)
    }
  }

  const handleCreateGhnShipment = async () => {
    if (!selectedOrder) return

    setActionLoading(true)
    setNotice(null)

    try {
      const updatedOrder = await createGhnShipment(selectedOrder._id)
      setSelectedOrder(updatedOrder)
      setOrders((currentOrders) =>
        currentOrders.map((order) => (order._id === updatedOrder._id ? updatedOrder : order)),
      )
      setNotice({ type: 'success', message: 'Đã tạo vận đơn GHN và liên kết vào đơn hàng' })
      await refreshSelectedOrder(updatedOrder._id)
      await loadOrders()
      requestAdminNotificationRefresh()
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancelGhnShipment = async () => {
    if (!selectedOrder) return

    openActionDialog({ type: 'cancel-ghn', order: selectedOrder })
  }

  const executeCancelGhnShipment = async (order: AdminOrder) => {
    setActionDialog(null)
    setActionDialogError('')
    setActionLoading(true)
    setNotice(null)

    try {
      const updatedOrder = await cancelGhnShipment(order._id, 'Admin cancelled GHN shipment')
      setSelectedOrder(updatedOrder)
      setOrders((currentOrders) =>
        currentOrders.map((order) => (order._id === updatedOrder._id ? updatedOrder : order)),
      )
      setNotice({ type: 'success', message: 'Đã hủy vận đơn GHN' })
      await refreshSelectedOrder(updatedOrder._id)
      await loadOrders()
      requestAdminNotificationRefresh()
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setActionLoading(false)
    }
  }

  const handleSyncGhnShipment = async () => {
    if (!selectedOrder) return

    setActionLoading(true)
    setNotice(null)

    try {
      const updatedOrder = await syncGhnShipment(selectedOrder._id)
      setSelectedOrder(updatedOrder)
      setOrders((currentOrders) =>
        currentOrders.map((order) => (order._id === updatedOrder._id ? updatedOrder : order)),
      )
      setNotice({ type: 'success', message: 'Đã đồng bộ trạng thái GHN' })
      await refreshSelectedOrder(updatedOrder._id)
      await loadOrders()
      requestAdminNotificationRefresh()
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
      requestAdminNotificationRefresh()
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

    openActionDialog({ type: 'payment-status', order: selectedOrder, nextStatus })
  }

  const executeAdjustPaymentStatus = async (
    order: AdminOrder,
    nextStatus: AdminOrderPaymentStatus,
    reason: string,
  ) => {
    setActionDialog(null)
    setActionDialogError('')
    setActionLoading(true)
    setNotice(null)

    try {
      const updatedOrder = await adjustOrderPaymentStatus(order._id, nextStatus, reason.trim())
      setSelectedOrder(updatedOrder)
      setOrders((currentOrders) =>
        currentOrders.map((order) => (order._id === updatedOrder._id ? updatedOrder : order)),
      )
      setNotice({ type: 'success', message: 'Đã điều chỉnh trạng thái thanh toán' })
      await refreshSelectedOrder(updatedOrder._id)
      await loadOrders()
      requestAdminNotificationRefresh()
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

    openActionDialog({ type: 'payment-method-status', order: selectedOrder, method, nextStatus })
  }

  const executeUpdatePaymentMethodStatus = async (
    order: AdminOrder,
    method: AdminCustomerPaymentMethod,
    nextStatus: AdminPaymentMethodStatus,
    reason: string,
  ) => {
    setActionDialog(null)
    setActionDialogError('')
    setActionLoading(true)
    setNotice(null)

    try {
      await updateCustomerPaymentMethodStatus(method._id, nextStatus, reason.trim())
      setNotice({ type: 'success', message: 'Đã cập nhật phương thức thanh toán của khách hàng' })
      await refreshSelectedOrder(order._id)
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setActionLoading(false)
    }
  }

  const handleSubmitActionDialog = (input: OrderActionDialogInput) => {
    if (!actionDialog) return

    if (actionDialog.type === 'status') {
      const reason = (input.reason ?? '').trim()
      if (actionDialog.nextStatus === 'cancelled' && !reason) {
        setActionDialogError('Cần nhập lý do hủy đơn')
        return
      }

      void executeStatusUpdate(actionDialog.order, actionDialog.nextStatus, reason || undefined)
      return
    }

    if (actionDialog.type === 'return-review') {
      const reason = (input.reason ?? '').trim()
      if (actionDialog.decision === 'rejected' && !reason) {
        setActionDialogError('Cần nhập lý do từ chối trả hàng')
        return
      }

      void executeReviewReturnRequest(actionDialog.order, actionDialog.decision, reason || undefined)
      return
    }

    if (actionDialog.type === 'shipping') {
      if (!input.shipping) return

      void executeShippingUpdate(actionDialog.order, input.shipping)
      return
    }

    if (actionDialog.type === 'cancel-ghn') {
      void executeCancelGhnShipment(actionDialog.order)
      return
    }

    const reason = (input.reason ?? '').trim()
    if (!reason) {
      setActionDialogError('Cần nhập lý do thao tác')
      return
    }

    if (actionDialog.type === 'payment-status') {
      void executeAdjustPaymentStatus(actionDialog.order, actionDialog.nextStatus, reason)
      return
    }

    void executeUpdatePaymentMethodStatus(
      actionDialog.order,
      actionDialog.method,
      actionDialog.nextStatus,
      reason,
    )
  }

  const renderOrderTabs = () => (
    <div className="admin-order-tab-groups" role="tablist" aria-label="Phân loại đơn hàng">
      {orderTabGroups.map((group) => {
        const tabs = orderTabs.filter((tab) => tab.group === group.key)

        return (
          <section className={`admin-order-tab-group is-${group.key}`} key={group.key}>
            <span className="admin-order-tab-group-label">{group.label}</span>
            <div className="admin-order-tabs">
              {tabs.map((tab) => {
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
          </section>
        )
      })}
    </div>
  )

  return (
    <section className="admin-orders-page" aria-busy={isLoading}>
      <header className="admin-page-heading">
        <div>
          <p>{isLookupMode ? 'Tra cứu bán hàng' : 'Vận hành đơn hàng'}</p>
          <h1>{pageTitle}</h1>
          <span>{pageHelper}</span>
        </div>

        <div className="admin-page-actions">
          {!isLookupMode ? (
            <button
              className="admin-secondary-button"
              type="button"
              disabled={!canUpdateOrders || actionLoading}
              onClick={() => void handleExpireStalePayments()}
            >
              Hết hạn thanh toán quá hạn
            </button>
          ) : null}
          <button className="admin-secondary-button" type="button" onClick={() => void loadOrders()}>
            Tải lại
          </button>
        </div>
      </header>

      {!isLookupMode || initialTabKey ? (
        renderOrderTabs()
      ) : null}

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
            value={!isLookupMode && activePaymentSectionKey === 'cod' ? 'COD' : paymentMethod}
            disabled={!isLookupMode && activePaymentSectionKey === 'cod'}
            onChange={(event) => {
              setPaymentMethod(event.target.value as AdminOrderPaymentMethod | 'all')
              setPage(1)
            }}
          >
            <option value="all">{isLookupMode ? 'Tất cả phương thức' : 'Tất cả online'}</option>
            {(isLookupMode ? allPaymentMethods : getPaymentSectionMethods(activePaymentSectionKey)).map((value) => (
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
          onCancelGhnShipment={() => void handleCancelGhnShipment()}
          onCreateGhnShipment={() => void handleCreateGhnShipment()}
          onUpdatePaymentMethodStatus={(method, status) => void handleUpdatePaymentMethodStatus(method, status)}
          onRefresh={() => void refreshSelectedOrder(selectedOrder._id)}
          onReviewReturnRequest={(decision) => void handleReviewReturnRequest(decision)}
          onShippingUpdate={() => void handleShippingUpdate()}
          onSimulateShippingStatus={(status) => void handleSimulateShippingStatus(status)}
          onSyncGhnShipment={() => void handleSyncGhnShipment()}
          onStatusUpdate={(status) => void handleStatusUpdate(status)}
        />
      ) : null}

      {actionDialog ? (
        <OrderActionDialog
          action={actionDialog}
          errorMessage={actionDialogError}
          isLoading={actionLoading}
          onClose={closeActionDialog}
          onSubmit={handleSubmitActionDialog}
        />
      ) : null}
    </section>
  )
}

function OrderActionDialog({
  action,
  errorMessage,
  isLoading,
  onClose,
  onSubmit,
}: {
  action: OrderActionDialogState
  errorMessage: string
  isLoading: boolean
  onClose: () => void
  onSubmit: (input: OrderActionDialogInput) => void
}) {
  const [reason, setReason] = useState('')
  const [shippingValues, setShippingValues] = useState<ShippingUpdateDialogValues>(
    action.type === 'shipping' ? action.values : getShippingUpdateDialogValues(action.order),
  )

  useEffect(() => {
    setReason('')
    setShippingValues(action.type === 'shipping' ? action.values : getShippingUpdateDialogValues(action.order))
  }, [action])

  const updateShippingValue = (field: keyof ShippingUpdateDialogValues, value: string) => {
    setShippingValues((current) => ({ ...current, [field]: value }))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (action.type === 'shipping') {
      onSubmit({ shipping: shippingValues })
      return
    }

    onSubmit({ reason })
  }

  const submitLabel = (() => {
    if (action.type === 'status' && action.nextStatus === 'cancelled') return 'Hủy đơn'
    if (action.type === 'status' && action.nextStatus === 'delivered') return 'Xác nhận đã giao'
    if (action.type === 'return-review') return action.decision === 'approved' ? 'Duyệt trả hàng' : 'Từ chối trả hàng'
    if (action.type === 'shipping') return 'Cập nhật vận đơn'
    if (action.type === 'cancel-ghn') return 'Hủy vận đơn GHN'
    if (action.type === 'payment-status') return 'Điều chỉnh thanh toán'
    return 'Cập nhật phương thức'
  })()

  const title = (() => {
    if (action.type === 'status' && action.nextStatus === 'cancelled') return 'Hủy đơn hàng'
    if (action.type === 'status' && action.nextStatus === 'delivered') return 'Xác nhận giao thành công'
    if (action.type === 'return-review') return action.decision === 'approved' ? 'Duyệt yêu cầu trả hàng' : 'Từ chối yêu cầu trả hàng'
    if (action.type === 'shipping') return 'Cập nhật vận đơn'
    if (action.type === 'cancel-ghn') return 'Hủy vận đơn GHN'
    if (action.type === 'payment-status') return 'Điều chỉnh trạng thái thanh toán'
    return 'Cập nhật phương thức thanh toán'
  })()

  const helper = (() => {
    if (action.type === 'status' && action.nextStatus === 'cancelled') {
      return 'Lý do hủy sẽ được ghi vào đơn và nhật ký thao tác.'
    }
    if (action.type === 'status' && action.nextStatus === 'delivered') {
      return 'Thời hạn trả hàng 7 ngày sẽ bắt đầu từ thời điểm xác nhận.'
    }
    if (action.type === 'return-review') {
      return action.decision === 'approved'
        ? 'Có thể thêm ghi chú để đội vận hành theo dõi xử lý sau duyệt.'
        : 'Lý do từ chối là bắt buộc để phản hồi cho khách hàng.'
    }
    if (action.type === 'shipping') {
      return 'Các trường bỏ trống sẽ được lưu dạng chưa có dữ liệu; lý do cập nhật là bắt buộc.'
    }
    if (action.type === 'cancel-ghn') {
      return 'Thao tác này hủy vận đơn đang liên kết với GHN cho đơn hiện tại.'
    }
    if (action.type === 'payment-status') {
      return `Chuyển thanh toán sang "${paymentStatusLabels[action.nextStatus]}". Lý do đối soát là bắt buộc.`
    }
    if (action.type === 'payment-method-status') {
      return `Chuyển "${action.method.displayName}" sang "${paymentMethodStatusLabels[action.nextStatus]}". Lý do là bắt buộc.`
    }
    return 'Vui lòng kiểm tra đúng đơn trước khi xác nhận thao tác.'
  })()

  const isDanger =
    (action.type === 'status' && action.nextStatus === 'cancelled') ||
    (action.type === 'return-review' && action.decision === 'rejected') ||
    action.type === 'cancel-ghn'
  const submitClassName = isDanger ? 'admin-danger-button' : 'admin-primary-button'

  return (
    <div className="admin-order-action-layer" role="dialog" aria-modal="true" aria-labelledby="admin-order-action-title">
      <button
        className="admin-order-action-backdrop"
        type="button"
        aria-label="Đóng"
        disabled={isLoading}
        onClick={onClose}
      />
      <form className="admin-order-action-dialog" onSubmit={handleSubmit}>
        <header>
          <div>
            <span>{action.order.orderCode}</span>
            <h2 id="admin-order-action-title">{title}</h2>
          </div>
          <button className="admin-icon-button" type="button" disabled={isLoading} onClick={onClose}>
            ×
          </button>
        </header>

        <p className="admin-order-action-helper">{helper}</p>

        {action.type === 'shipping' ? (
          <div className="admin-order-action-grid">
            <label>
              <span>Đơn vị vận chuyển</span>
              <input
                value={shippingValues.provider}
                onChange={(event) => updateShippingValue('provider', event.target.value)}
                disabled={isLoading}
                placeholder="GHN"
              />
            </label>
            <label>
              <span>Mã vận đơn</span>
              <input
                value={shippingValues.trackingCode}
                onChange={(event) => updateShippingValue('trackingCode', event.target.value)}
                disabled={isLoading}
                placeholder="Chưa có"
              />
            </label>
            <label>
              <span>Trạng thái vận chuyển</span>
              <input
                value={shippingValues.status}
                onChange={(event) => updateShippingValue('status', event.target.value)}
                disabled={isLoading}
                placeholder="created"
              />
            </label>
            <label>
              <span>Chi phí thực tế</span>
              <input
                type="number"
                min={0}
                step={1000}
                value={shippingValues.actualProviderCost}
                onChange={(event) => updateShippingValue('actualProviderCost', event.target.value)}
                disabled={isLoading}
                placeholder="Không bắt buộc"
              />
            </label>
            <label className="is-wide">
              <span>URL nhãn vận chuyển</span>
              <input
                value={shippingValues.labelUrl}
                onChange={(event) => updateShippingValue('labelUrl', event.target.value)}
                disabled={isLoading}
                placeholder="Không bắt buộc"
              />
            </label>
            <label className="is-wide">
              <span>Lý do cập nhật</span>
              <textarea
                value={shippingValues.reason}
                onChange={(event) => updateShippingValue('reason', event.target.value)}
                disabled={isLoading}
                rows={3}
                required
              />
            </label>
          </div>
        ) : action.type === 'cancel-ghn' || (action.type === 'status' && action.nextStatus === 'delivered') ? (
          <div className={`admin-order-action-warning${isDanger ? ' is-danger' : ''}`}>
            <strong>{submitLabel}</strong>
            <span>Vui lòng kiểm tra đúng đơn trước khi xác nhận thao tác này.</span>
          </div>
        ) : (
          <label className="admin-order-action-reason">
            <span>
              {action.type === 'return-review' && action.decision === 'approved'
                ? 'Ghi chú xử lý'
                : 'Lý do thao tác'}
            </span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={isLoading}
              rows={4}
              required={
                action.type !== 'return-review' ||
                action.decision === 'rejected'
              }
            />
          </label>
        )}

        {errorMessage ? (
          <p className="admin-notice is-error" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <footer>
          <button className="admin-secondary-button" type="button" disabled={isLoading} onClick={onClose}>
            Giữ lại
          </button>
          <button className={submitClassName} type="submit" disabled={isLoading}>
            {isLoading ? 'Đang xử lý...' : submitLabel}
          </button>
        </footer>
      </form>
    </div>
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
  onCancelGhnShipment,
  onCreateGhnShipment,
  onUpdatePaymentMethodStatus,
  onRefresh,
  onReviewReturnRequest,
  onShippingUpdate,
  onSimulateShippingStatus,
  onSyncGhnShipment,
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
  onCancelGhnShipment: () => void
  onCreateGhnShipment: () => void
  onUpdatePaymentMethodStatus: (method: AdminCustomerPaymentMethod, status: AdminPaymentMethodStatus) => void
  onRefresh: () => void
  onReviewReturnRequest: (decision: AdminReturnReviewDecision) => void
  onShippingUpdate: () => void
  onSimulateShippingStatus: (status: ShippingSimulationStatus) => void
  onSyncGhnShipment: () => void
  onStatusUpdate: (status: AdminOrderStatus) => void
}) {
  const statusOptions = nextStatusOptions[order.status] ?? []
  const hasPendingReturnRequest = order.status === 'return_requested' && order.returnRequest?.status === 'requested'
  const needsRefundHandling =
    order.paymentStatus === 'paid' && (order.status === 'cancelled' || order.status === 'returned')
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

        <div className="admin-order-drawer-body">
        <section className="admin-drawer-section admin-order-section-summary">
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
          <section className="admin-drawer-section admin-order-section-main">
            <div className="admin-section-inline-heading">
              <h3>Thông tin hủy đơn</h3>
              {order.paymentStatus === 'paid' ? (
                <span className="admin-status-pill is-warning">Cần hoàn tiền</span>
              ) : (
                <span className="admin-status-pill is-blocked">Đã hủy</span>
              )}
            </div>
            <article className="admin-return-request-card">
              <div className="admin-user-reason-block">
                <span>Đầu vào từ khách</span>
                <strong>Lý do hủy đơn</strong>
                <p>{order.cancellation.reason || 'Không có lý do hủy.'}</p>
              </div>
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
                <div className="admin-evidence-block">
                  <span>Ảnh minh chứng khách gửi</span>
                  <div className="admin-evidence-grid">
                    {order.cancellation.imageUrls.map((imageUrl) => (
                      <a href={imageUrl} key={imageUrl} target="_blank" rel="noreferrer">
                        <img src={imageUrl} alt="Minh chứng hủy đơn" />
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
            </article>
          </section>
        ) : null}

        {order.returnRequest ? (
          <section className="admin-drawer-section admin-order-section-main">
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
              <div className="admin-user-reason-block">
                <span>Đầu vào từ khách</span>
                <strong>Lý do yêu cầu trả hàng</strong>
                <p>{order.returnRequest.reason}</p>
              </div>
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
                  <dt>Phản hồi admin</dt>
                  <dd>{order.returnRequest.reviewReason || 'Chưa có'}</dd>
                </div>
              </dl>
              {order.returnRequest.imageUrls?.length ? (
                <div className="admin-evidence-block">
                  <span>Ảnh minh chứng khách gửi</span>
                  <div className="admin-evidence-grid">
                    {order.returnRequest.imageUrls.map((imageUrl) => (
                      <a href={imageUrl} key={imageUrl} target="_blank" rel="noreferrer">
                        <img src={imageUrl} alt="Minh chứng trả hàng" />
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
            </article>
          </section>
        ) : null}

        <section className="admin-drawer-section admin-order-section-side">
          <h3>Phương thức thanh toán của khách hàng</h3>
          {needsRefundHandling ? (
            <p className="admin-refund-bank-note">
              Đơn cần hoàn tiền. Ưu tiên tài khoản ngân hàng khách đã cập nhật/xác minh; sau khi chuyển khoản ngoài hệ thống thì đánh dấu Đã hoàn tiền.
            </p>
          ) : null}
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

        <section className="admin-drawer-section admin-order-section-main">
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
          <div className="admin-shipping-simulator">
            <div className="admin-shipping-simulator-header">
              <span>Đối tác vận chuyển</span>
              <strong className={getShippingPillClass(order.shipping?.status)}>
                {formatShippingStatus(order.shipping?.status)}
              </strong>
            </div>
            {order.shipping?.status === 'failed' ? (
              <p className="admin-shipping-failed-note">
                Đơn vị vận chuyển báo giao không thành công. Admin có thể bấm Giao lại sau khi liên hệ khách, hoặc xử lý hoàn tiền/hỗ trợ theo chính sách.
              </p>
            ) : null}
            <div className="admin-ghn-actions">
              <button
                className="admin-primary-button"
                type="button"
                disabled={!canUpdateOrders || isActionLoading || !canCreateGhnShipment(order)}
                onClick={onCreateGhnShipment}
              >
                Tạo vận đơn GHN
              </button>
              <button
                className="admin-secondary-button"
                type="button"
                disabled={!canUpdateOrders || isActionLoading || !canSyncGhnShipment(order)}
                onClick={onSyncGhnShipment}
              >
                Đồng bộ GHN
              </button>
              <button
                className="admin-danger-button"
                type="button"
                disabled={!canUpdateOrders || isActionLoading || !canCancelGhnShipment(order)}
                onClick={onCancelGhnShipment}
              >
                Hủy vận đơn GHN
              </button>
            </div>
            <div className="admin-shipping-simulator-actions">
              {shippingSimulationActions.map((action) => (
                <button
                  className={action.className}
                  type="button"
                  key={action.status}
                  disabled={!canUpdateOrders || isActionLoading || !canSimulateShippingStatus(order, action.status)}
                  onClick={() => onSimulateShippingStatus(action.status)}
                >
                  {getShippingSimulationActionLabel(order, action)}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="admin-drawer-section admin-order-section-main">
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

        <section className="admin-drawer-section admin-order-section-side">
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

        <section className="admin-drawer-section admin-order-section-side">
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

        <section className="admin-drawer-section admin-order-section-main">
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

        <section className="admin-drawer-section admin-order-section-side">
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
        </div>
      </aside>
    </div>
  )
}
