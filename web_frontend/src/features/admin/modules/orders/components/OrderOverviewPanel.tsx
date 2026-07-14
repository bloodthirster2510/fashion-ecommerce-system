import { Copy } from 'lucide-react'
import type { AdminOrder } from '../orderAdminApi'
import {
  formatCurrency,
  formatDate,
  getPaymentPillClass,
  paymentMethodLabels,
  paymentStatusLabels,
} from '../orderPresentation'
import { OrderProgressRail } from './OrderProgressRail'
import { OrderStatusPill } from './OrderStatusPill'

export function OrderOverviewPanel({
  order,
  onCopyReference,
}: {
  order: AdminOrder
  onCopyReference: (value: string, label: string) => void
}) {
  return (
    <section className="admin-drawer-section admin-order-section-summary">
      <h3>Tổng quan</h3>
      <OrderProgressRail shippingStatus={order.shipping?.status} status={order.status} />
      <div className="admin-detail-grid">
        <div className="admin-detail-card is-order">
          <span>Trạng thái đơn</span>
          <strong>
            <OrderStatusPill order={order} />
          </strong>
        </div>
        <div className="admin-detail-card is-payment">
          <span>Trạng thái thanh toán</span>
          <strong className={getPaymentPillClass(order.paymentStatus)}>{paymentStatusLabels[order.paymentStatus]}</strong>
        </div>
        <div className="admin-detail-card is-invoice">
          <span>Mã hóa đơn</span>
          <strong className="admin-code-with-copy">
            <span>{order.invoiceCode || 'Chưa có'}</span>
            {order.invoiceCode ? (
              <button
                className="admin-copy-button"
                type="button"
                onClick={() => onCopyReference(order.invoiceCode ?? '', 'mã hóa đơn')}
                aria-label="Sao chép mã hóa đơn"
              >
                <Copy size={14} strokeWidth={2.4} />
              </button>
            ) : null}
          </strong>
        </div>
        {order.paymentDeadlineAt ? (
          <div className="admin-detail-card is-payment-deadline">
            <span>Hạn thanh toán</span>
            <strong>{formatDate(order.paymentDeadlineAt)}</strong>
          </div>
        ) : null}
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
  )
}
