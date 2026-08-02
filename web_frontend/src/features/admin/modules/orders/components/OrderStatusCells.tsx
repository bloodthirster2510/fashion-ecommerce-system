import { Copy } from 'lucide-react'
import type { AdminOrder } from '../orderAdminApi'
import {
  formatCurrency,
  formatShippingProvider,
  formatShippingStatus,
  getOrderDisplayStatus,
  getOrderProgressPercent,
  paymentMethodLabels,
  paymentStatusLabels,
} from '../orderPresentation'
import {
  getOrderAttention,
  getOrderAttentionClass,
  getPaymentDeadlineStatus,
} from '../utils/orderQueue'
import { OrderProgressRail } from './OrderProgressRail'

type CopyReferenceHandler = (value: string, label: string) => void | Promise<void>

export function OrderReferenceCell({
  order,
  onCopyReference,
}: {
  order: AdminOrder
  onCopyReference: CopyReferenceHandler
}) {
  const attention = getOrderAttention(order)

  return (
    <div className="admin-order-code-cell">
      <div className="admin-code-with-copy">
        <strong>{order.orderCode}</strong>
        <button
          className="admin-copy-button"
          type="button"
          onClick={() => void onCopyReference(order.orderCode, 'mã đơn')}
          aria-label="Sao chép mã đơn"
        >
          <Copy size={14} strokeWidth={2.4} />
        </button>
      </div>
      {order.invoiceCode ? (
        <div className="admin-code-with-copy is-subtle">
          <span>{order.invoiceCode}</span>
          <button
            className="admin-copy-button"
            type="button"
            onClick={() => void onCopyReference(order.invoiceCode ?? '', 'mã hóa đơn')}
            aria-label="Sao chép mã hóa đơn"
          >
            <Copy size={14} strokeWidth={2.4} />
          </button>
        </div>
      ) : (
        <span>Chưa có hóa đơn</span>
      )}
      {attention ? <em className={getOrderAttentionClass(order)}>{attention.label}</em> : null}
    </div>
  )
}

export function OrderTotalCell({ order }: { order: AdminOrder }) {
  return (
    <>
      <strong>{formatCurrency(order.totalAmount)}</strong>
      <span>{order.order_list.length} sản phẩm</span>
    </>
  )
}

export function OrderFulfillmentCell({ order }: { order: AdminOrder }) {
  const displayStatus = getOrderDisplayStatus(order)
  const progressPercent = Math.round(getOrderProgressPercent(order.status, order.shipping?.status))
  const isException = order.status === 'return_requested' || order.status === 'return_approved' || order.status === 'returned'
  const progressLabel = order.status === 'cancelled'
    ? 'Đã dừng'
    : isException
      ? 'Luồng trả hàng'
      : `${progressPercent}%`

  return (
    <div className="admin-order-status-cell admin-order-workflow-cell">
      <div className="admin-order-status-heading">
        <span className={`${displayStatus.className} admin-order-primary-status`}>{displayStatus.label}</span>
        <span className="admin-order-progress-value">{progressLabel}</span>
      </div>
      <OrderProgressRail compact shippingStatus={order.shipping?.status} status={order.status} />
    </div>
  )
}

export function OrderPaymentStatusCell({ order }: { order: AdminOrder }) {
  const paymentDeadlineStatus = getPaymentDeadlineStatus(order)

  return (
    <div className="admin-order-operation-cell">
      <span className={`admin-order-meta-state is-${order.paymentStatus}`}>
        {paymentStatusLabels[order.paymentStatus]}
      </span>
      <span className="admin-order-operation-meta">{paymentMethodLabels[order.paymentMethod]}</span>
      {paymentDeadlineStatus ? (
        <small className={`${paymentDeadlineStatus.className} admin-order-deadline-note`}>
          {paymentDeadlineStatus.label}
        </small>
      ) : null}
    </div>
  )
}

export function OrderShippingStatusCell({ order }: { order: AdminOrder }) {
  const shippingStatus = formatShippingStatus(order.shipping?.status)
  const trackingCode = order.shipping?.trackingCode?.trim()

  return (
    <div className="admin-order-operation-cell">
      <span className="admin-order-meta-provider">{formatShippingProvider(order.shipping?.provider)}</span>
      <span className="admin-order-operation-meta" title={shippingStatus}>{shippingStatus}</span>
      {trackingCode ? (
        <span className="admin-order-tracking-code" title={trackingCode}>{trackingCode}</span>
      ) : null}
    </div>
  )
}
