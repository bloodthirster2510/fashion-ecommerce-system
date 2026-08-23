import { CircleAlert, CircleCheck, Clock3, Copy, RefreshCw, RotateCcw } from 'lucide-react'
import type {
  AdminCustomerPaymentMethod,
  AdminOrder,
  AdminPaymentMethodStatus,
  AdminTransaction,
} from '../orderAdminApi'
import {
  formatCurrency,
  getCustomerPaymentMethodSubtitle,
  getPaymentMethodStatusActions,
  getPaymentMethodStatusClass,
  paymentMethodStatusLabels,
} from '../orderPresentation'
import {
  getRecommendedRefundMethod,
  getRefundAccountHolder,
  getRefundAccountText,
  getRefundBankName,
  getRefundTransferContent,
} from '../utils/refundRecommend'
import { getVNPayRefundDisplayStatus } from '../utils/vnpayReconcile'
import { formatAdminDateTime } from '../../../utils/dateTime'

const isVNPaySandbox = String(import.meta.env.VITE_VNPAY_ENV ?? 'sandbox').toLowerCase() !== 'production'
const formatRefundUpdatedAt = (value?: string | null) => value
  ? formatAdminDateTime(value)
  : 'Chưa có'

type OrderRefundMethodsPanelProps = {
  canAdjustPayments: boolean
  canManageCustomerPaymentMethods: boolean
  canReadCustomerPaymentMethods: boolean
  isActionLoading: boolean
  isTransactionLoading: boolean
  needsRefundHandling: boolean
  order: AdminOrder
  paymentMethods: AdminCustomerPaymentMethod[]
  refundTransaction?: AdminTransaction | null
  revealedRefundAccounts: Record<string, string>
  onCopyReference: (value: string, label: string) => void
  onRefundVNPay: () => void
  onReconcileVNPay: () => void
  onRevealRefundAccount: (method: AdminCustomerPaymentMethod) => void
  onUpdatePaymentMethodStatus: (method: AdminCustomerPaymentMethod, status: AdminPaymentMethodStatus) => void
}

export function OrderRefundMethodsPanel({
  canAdjustPayments,
  canManageCustomerPaymentMethods,
  canReadCustomerPaymentMethods,
  isActionLoading,
  isTransactionLoading,
  needsRefundHandling,
  order,
  paymentMethods,
  refundTransaction,
  revealedRefundAccounts,
  onCopyReference,
  onRefundVNPay,
  onReconcileVNPay,
  onRevealRefundAccount,
  onUpdatePaymentMethodStatus,
}: OrderRefundMethodsPanelProps) {
  const refundTransferContent = getRefundTransferContent(order)
  const recommendedRefundMethod = getRecommendedRefundMethod(paymentMethods)
  const refundMethods = paymentMethods.filter((method) => method.type === 'BANK')
  const revealedRecommendedRefundAccount = recommendedRefundMethod
    ? revealedRefundAccounts[recommendedRefundMethod._id]
    : undefined
  const hasMaskedRefundAccount = Boolean(
    !revealedRecommendedRefundAccount &&
      recommendedRefundMethod?.maskedInfo &&
      /[•*xX]/.test(recommendedRefundMethod.maskedInfo),
  )
  const vnpayRefundStatus = getVNPayRefundDisplayStatus(refundTransaction)

  if (needsRefundHandling && order.paymentMethod === 'VNPAY') {
    const refundState = isTransactionLoading
      ? {
          className: 'is-pending',
          icon: <Clock3 size={18} aria-hidden="true" />,
          label: 'Đang kiểm tra lịch sử hoàn tiền',
          helper: 'Vui lòng chờ tải giao dịch trước khi gửi hoặc đối soát lệnh hoàn.',
        }
      : vnpayRefundStatus === 'pending'
      ? {
          className: 'is-pending',
          icon: <Clock3 size={18} aria-hidden="true" />,
          label: 'VNPay đang xử lý',
          helper: 'Đơn vẫn hiển thị đã thanh toán cho tới khi VNPay xác nhận hoàn thành.',
        }
      : vnpayRefundStatus === 'failed'
        ? {
            className: 'is-failed',
            icon: <CircleAlert size={18} aria-hidden="true" />,
            label: 'Lệnh hoàn gần nhất thất bại',
            helper: 'Kiểm tra phản hồi trong mục Thanh toán & xử lý trước khi gửi lại.',
          }
        : vnpayRefundStatus === 'completed'
          ? {
              className: 'is-completed',
              icon: <CircleCheck size={18} aria-hidden="true" />,
              label: 'VNPay đã xác nhận hoàn tiền',
              helper: 'Khoản hoàn được trả về nguồn thanh toán ban đầu của khách.',
            }
          : {
              className: 'is-ready',
              icon: <RotateCcw size={18} aria-hidden="true" />,
              label: 'Sẵn sàng gửi lệnh hoàn',
              helper: 'Hệ thống sẽ yêu cầu VNPay hoàn toàn bộ giao dịch gốc.',
            }

    return (
      <section className="admin-drawer-section admin-order-section-side admin-order-section-refund">
        <div className="admin-section-inline-heading">
          <h3>Hoàn tiền qua VNPay</h3>
          {isVNPaySandbox ? <span className="admin-vnpay-environment">Sandbox · tiền thử</span> : null}
        </div>
        <div className="admin-refund-panel">
          <div className="admin-refund-panel-header">
            <span>Số tiền hoàn</span>
            <strong>{formatCurrency(order.totalAmount)}</strong>
          </div>
          <div className={`admin-vnpay-refund-state ${refundState.className}`} role="status">
            {refundState.icon}
            <div>
              <strong>{refundState.label}</strong>
              <span>{refundState.helper}</span>
            </div>
          </div>
          <p className="admin-refund-bank-note is-caution">
            Tiền được trả về nguồn VNPay ban đầu, không chuyển vào tài khoản ngân hàng khách đã lưu.
          </p>
          {refundTransaction ? (
            <dl className="admin-refund-meta">
              <div><dt>Mã tham chiếu</dt><dd>{refundTransaction.txnRef || refundTransaction.gatewayTransactionId || 'Chưa có'}</dd></div>
              <div><dt>Cập nhật gần nhất</dt><dd>{formatRefundUpdatedAt(refundTransaction.updatedAt)}</dd></div>
              {vnpayRefundStatus === 'failed' && refundTransaction.failureReason ? (
                <div className="is-wide">
                  <dt>Lý do thất bại</dt>
                  <dd>{refundTransaction.failureReason}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
          {isTransactionLoading ? (
            <button className="admin-secondary-button" type="button" disabled>
              <Clock3 size={16} aria-hidden="true" />
              Đang kiểm tra giao dịch...
            </button>
          ) : vnpayRefundStatus === 'pending' ? (
            <button
              className="admin-secondary-button"
              type="button"
              disabled={!canAdjustPayments || isActionLoading}
              onClick={onReconcileVNPay}
            >
              <RefreshCw size={16} aria-hidden="true" />
              Đối soát trạng thái với VNPay
            </button>
          ) : vnpayRefundStatus !== 'completed' ? (
            <button
              className="admin-primary-button admin-refund-primary-action"
              type="button"
              disabled={!canAdjustPayments || isActionLoading}
              onClick={onRefundVNPay}
            >
              {vnpayRefundStatus === 'failed'
                ? `Gửi lại lệnh hoàn ${formatCurrency(order.totalAmount)}`
                : `Hoàn ${formatCurrency(order.totalAmount)} qua VNPay`}
            </button>
          ) : null}
          {!canAdjustPayments ? (
            <p className="admin-permission-note">Cần quyền payments.adjust để hoàn tiền.</p>
          ) : null}
        </div>
      </section>
    )
  }

  return (
    <section className="admin-drawer-section admin-order-section-side admin-order-section-refund">
      <h3>Hoàn tiền thủ công</h3>
      {needsRefundHandling ? (
        <div className="admin-refund-panel">
          <div className="admin-refund-panel-header">
            <span>Số tiền đề xuất</span>
            <strong>{formatCurrency(order.totalAmount)}</strong>
          </div>
          <div className="admin-refund-transfer-content">
            <span>Nội dung chuyển khoản</span>
            <strong className="admin-code-with-copy">
              <span>{refundTransferContent}</span>
              <button
                className="admin-copy-button"
                type="button"
                onClick={() => onCopyReference(refundTransferContent, 'nội dung chuyển khoản')}
                aria-label="Sao chép nội dung chuyển khoản"
              >
                <Copy size={14} strokeWidth={2.4} />
              </button>
            </strong>
          </div>
          {recommendedRefundMethod ? (
            <article className="admin-refund-account-card">
              <div>
                <span>Tài khoản nhận ưu tiên</span>
                <strong>{getRefundAccountHolder(recommendedRefundMethod)}</strong>
              </div>
              <dl>
                <div>
                  <dt>Ngân hàng</dt>
                  <dd>{getRefundBankName(recommendedRefundMethod)}</dd>
                </div>
                <div>
                  <dt>Mã NH</dt>
                  <dd>{recommendedRefundMethod.bankCode || 'Chưa có'}</dd>
                </div>
                <div>
                  <dt>{revealedRecommendedRefundAccount ? 'Số tài khoản' : hasMaskedRefundAccount ? 'Số TK đang che' : 'Số tài khoản'}</dt>
                  <dd className="admin-refund-account-number">
                    <span>{revealedRecommendedRefundAccount ?? getRefundAccountText(recommendedRefundMethod)}</span>
                    {revealedRecommendedRefundAccount ? (
                      <button
                        className="admin-inline-copy-button"
                        type="button"
                        onClick={() => onCopyReference(revealedRecommendedRefundAccount, 'số tài khoản')}
                      >
                        Sao chép số TK
                      </button>
                    ) : (
                      <button
                        className="admin-inline-copy-button"
                        type="button"
                        disabled={isActionLoading || !canAdjustPayments || !recommendedRefundMethod.hasStoredAccountNumber}
                        onClick={() => onRevealRefundAccount(recommendedRefundMethod)}
                        title={
                          !canAdjustPayments
                            ? 'Cần quyền payments.adjust để xem số tài khoản hoàn tiền'
                            : recommendedRefundMethod.hasStoredAccountNumber
                              ? 'Hiện số tài khoản đầy đủ để chuyển khoản'
                              : 'Tài khoản cũ chưa lưu số đầy đủ, khách cần cập nhật lại'
                        }
                      >
                        Hiện số TK
                      </button>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Trạng thái</dt>
                  <dd>{paymentMethodStatusLabels[recommendedRefundMethod.status]}</dd>
                </div>
              </dl>
            </article>
          ) : (
            <p className="admin-refund-bank-note">
              Khách chưa có tài khoản ngân hàng nhận hoàn tiền. Cần yêu cầu khách bổ sung trước khi chuyển khoản.
            </p>
          )}
          <p className="admin-refund-bank-note">
            Sau khi chuyển khoản ngoài hệ thống, dùng nút Đã hoàn tiền và ghi đúng nội dung chuyển khoản để đối soát sao kê.
          </p>
          {hasMaskedRefundAccount ? (
            <p className="admin-refund-bank-note is-caution">
              Số tài khoản đang được che theo chính sách bảo mật. Staff dùng nội dung chuyển khoản ở trên để đối soát khi hoàn tiền thủ công.
            </p>
          ) : null}
        </div>
      ) : null}
      {!canReadCustomerPaymentMethods ? (
        <p className="admin-muted-text">Cần quyền customers.read để xem tài khoản nhận hoàn tiền.</p>
      ) : refundMethods.length === 0 ? (
        <p className="admin-muted-text">Khách chưa lưu tài khoản ngân hàng nhận hoàn tiền.</p>
      ) : (
        <div className="admin-payment-method-list">
          {refundMethods.map((method) => {
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
        <p className="admin-permission-note">Cần quyền customers.manage để xác minh tài khoản nhận hoàn tiền.</p>
      ) : null}
    </section>
  )
}
