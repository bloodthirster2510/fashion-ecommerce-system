import { RefreshCw } from 'lucide-react'
import type { AdminOrder, AdminOrderPaymentStatus, AdminTransaction } from '../orderAdminApi'
import {
  formatCurrency,
  formatDate,
  paymentStatusLabels,
  transactionStatusLabels,
} from '../orderPresentation'

type OrderPaymentPanelProps = {
  canAdjustPayments: boolean
  isActionLoading: boolean
  order: AdminOrder
  transactions: AdminTransaction[]
  onAdjustPaymentStatus: (status: AdminOrderPaymentStatus) => void
  onReconcileVNPay: () => void
  onRefresh: () => void
}

export function OrderPaymentPanel({
  canAdjustPayments,
  isActionLoading,
  order,
  transactions,
  onAdjustPaymentStatus,
  onReconcileVNPay,
  onRefresh,
}: OrderPaymentPanelProps) {
  return (
    <>
      <section className="admin-drawer-section admin-order-section-side admin-order-section-payments">
        <div className="admin-section-inline-heading">
          <h3>Lượt thanh toán</h3>
          <div className="admin-drawer-actions">
            {order.paymentMethod === 'VNPAY' ? (
              <button
                className="admin-secondary-button"
                type="button"
                disabled={!canAdjustPayments || isActionLoading}
                onClick={onReconcileVNPay}
              >
                <RefreshCw size={15} aria-hidden="true" />
                Đối soát VNPay
              </button>
            ) : null}
            <button className="admin-link-button" type="button" onClick={onRefresh}>
              Tải lại
            </button>
          </div>
        </div>
        {transactions.length === 0 ? (
          <p className="admin-muted-text">Chưa có giao dịch cho đơn này.</p>
        ) : (
          <div className="admin-payment-timeline">
            {transactions.map((transaction) => (
              <article className="admin-payment-attempt" key={transaction._id}>
                <header>
                  <strong>
                    {transaction.paymentDetail?.vnp_Command === 'refund' ? 'Hoàn tiền' : 'Lượt thanh toán'} #{transaction.attemptNo ?? '?'}
                  </strong>
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
                {transaction.failureReason ? <p>{transaction.failureReason}</p> : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="admin-drawer-section admin-order-section-side admin-order-section-payment-adjust">
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
    </>
  )
}
