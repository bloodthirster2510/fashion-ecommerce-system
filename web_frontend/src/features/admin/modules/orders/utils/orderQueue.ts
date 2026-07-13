import type { AdminOrder, AdminOrderStatus } from '../orderAdminApi'
import type { OrderQueueKey, OrderTab } from '../orderTypes'
import { emptyOperationalSummary, formatDate } from '../orderPresentation'

export const getOrderRowClass = (order: AdminOrder) => {
  if (shouldWarnPaymentBeforeShipping(order) || order.paymentStatus === 'failed') {
    return 'admin-order-row is-payment-risk'
  }
  if (order.status === 'delivered' || order.status === 'completed') return 'admin-order-row is-complete'
  if (order.status === 'shipping') return 'admin-order-row is-shipping'
  if (order.status === 'packed') return 'admin-order-row is-packed'
  if (order.status === 'cancelled' || order.status === 'returned' || order.status === 'return_requested' || order.status === 'return_approved') {
    return 'admin-order-row is-exception'
  }
  return 'admin-order-row is-processing'
}

export const shouldWarnPaymentBeforeShipping = (order: AdminOrder) =>
  order.paymentMethod !== 'COD' &&
  order.paymentStatus !== 'paid' &&
  order.status !== 'cancelled' &&
  order.status !== 'returned' &&
  order.status !== 'completed'

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
  (order.status === 'cancelled' || order.status === 'returned') && order.paymentStatus === 'paid'

export const needsReasonReview = (order: AdminOrder) =>
  (order.status === 'return_requested' && order.returnRequest?.status === 'requested') ||
  (order.status === 'return_approved' && order.returnRequest?.status === 'approved')

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
  if (queue === 'delivery') return operationalSummary.deliveryConfirmations ?? summary.delivered

  const readyToProcess = operationalSummary.readyToProcess ?? Math.max(0, summary.confirmed + summary.packed)
  const deliveryConfirmations = operationalSummary.deliveryConfirmations ?? summary.delivered
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
  kind: 'return' | 'return-inbound' | 'refund' | 'paid-ready' | 'payment-risk' | 'new' | 'packed' | 'delivery'
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

  if (order.status === 'return_approved' && order.returnRequest?.status === 'approved') {
    return {
      kind: 'return-inbound',
      tone: 'info',
      label: 'Chờ nhận hàng trả',
      helper: 'Yêu cầu đã duyệt; chỉ đánh dấu đã trả khi shop thực tế nhận và kiểm tra hàng.',
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
      label: 'Cần đối soát thanh toán',
      helper: 'Chưa ghi nhận thanh toán, tạm dừng xử lý giao hàng.',
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
      label: 'Chờ xác nhận giao',
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
    'return-inbound': 1,
    refund: 2,
    'payment-risk': 3,
    'paid-ready': 4,
    new: 5,
    packed: 6,
    delivery: 7,
  }

  return ranks[attention.kind] ?? 8
}

export const isStatusBlockedByPayment = (order: AdminOrder, status: AdminOrderStatus) =>
  shouldWarnPaymentBeforeShipping(order) && status !== 'cancelled'

