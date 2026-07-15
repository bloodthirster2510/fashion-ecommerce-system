import { Copy } from 'lucide-react'
import type { AdminOrder } from '../orderAdminApi'
import {
  formatCurrency,
  formatShippingProvider,
  formatShippingStatus,
  getPaymentPillClass,
  getShippingPillClass,
  paymentMethodLabels,
  paymentStatusLabels,
} from '../orderPresentation'
import {
  getOrderAttention,
  getOrderAttentionClass,
  getPaymentDeadlineStatus,
} from '../utils/orderQueue'
import { OrderProgressRail } from './OrderProgressRail'
import { OrderStatusPill } from './OrderStatusPill'

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
  const paymentDeadlineStatus = getPaymentDeadlineStatus(order)
  const shippingStatus = order.shipping?.trackingCode || formatShippingStatus(order.shipping?.status)

  return (
    <div className="admin-order-status-cell admin-order-status-cell--combined">
      <OrderStatusPill order={order} />
      <OrderProgressRail compact shippingStatus={order.shipping?.status} status={order.status} />
      <small className="admin-order-status-subline">
        <span className={getPaymentPillClass(order.paymentStatus)}>
          {paymentStatusLabels[order.paymentStatus]}
        </span>
        <span>{paymentMethodLabels[order.paymentMethod]}</span>
      </small>
      <small className="admin-order-status-subline">
        <span className={getShippingPillClass(order.shipping?.status)}>{formatShippingProvider(order.shipping?.provider)}</span>
        <span>{shippingStatus}</span>
      </small>
      {paymentDeadlineStatus ? (
        <small className={paymentDeadlineStatus.className}>{paymentDeadlineStatus.label}</small>
      ) : null}
    </div>
  )
}
