import { Copy, RotateCcw } from 'lucide-react'
import type {
  AdminCustomerPaymentMethod,
  AdminOrder,
  AdminPaymentMethodStatus,
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

type OrderRefundMethodsPanelProps = {
  canAdjustPayments: boolean
  canManageCustomerPaymentMethods: boolean
  canReadCustomerPaymentMethods: boolean
  isActionLoading: boolean
  needsRefundHandling: boolean
  order: AdminOrder
  paymentMethods: AdminCustomerPaymentMethod[]
  revealedRefundAccounts: Record<string, string>
  onCopyReference: (value: string, label: string) => void
  onRefundVNPay: () => void
  onRevealRefundAccount: (method: AdminCustomerPaymentMethod) => void
  onUpdatePaymentMethodStatus: (method: AdminCustomerPaymentMethod, status: AdminPaymentMethodStatus) => void
}

export function OrderRefundMethodsPanel({
  canAdjustPayments,
  canManageCustomerPaymentMethods,
  canReadCustomerPaymentMethods,
  isActionLoading,
  needsRefundHandling,
  order,
  paymentMethods,
  revealedRefundAccounts,
  onCopyReference,
  onRefundVNPay,
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

  if (needsRefundHandling && order.paymentMethod === 'VNPAY') {
    return (
      <section className="admin-drawer-section admin-order-section-side admin-order-section-refund">
        <h3>Hoàn tiền VNPay</h3>
        <div className="admin-refund-panel">
          <div className="admin-refund-panel-header">
            <span>Số tiền hoàn toàn phần</span>
            <strong>{formatCurrency(order.totalAmount)}</strong>
          </div>
          <button
            className="admin-primary-button"
            type="button"
            disabled={!canAdjustPayments || isActionLoading}
            onClick={onRefundVNPay}
          >
            <RotateCcw size={16} aria-hidden="true" />
            Gửi yêu cầu hoàn qua VNPay
          </button>
          {!canAdjustPayments ? (
            <p className="admin-permission-note">Cần quyền payments.adjust để hoàn tiền.</p>
          ) : null}
        </div>
      </section>
    )
  }

  return (
    <section className="admin-drawer-section admin-order-section-side admin-order-section-refund">
      <h3>{needsRefundHandling ? 'Hoàn tiền & tài khoản nhận' : 'Phương thức thanh toán của khách hàng'}</h3>
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
        <p className="admin-muted-text">Cần quyền customers.read để xem phương thức thanh toán của khách.</p>
      ) : paymentMethods.length === 0 ? (
        <p className="admin-muted-text">Khách hàng chưa lưu phương thức thanh toán nào.</p>
      ) : needsRefundHandling && refundMethods.length === 0 ? (
        <p className="admin-muted-text">Khách chưa lưu tài khoản ngân hàng. Các phương thức khác vẫn nằm trong hồ sơ thanh toán nhưng không dùng để chuyển khoản hoàn tiền.</p>
      ) : (
        <div className="admin-payment-method-list">
          {(needsRefundHandling ? refundMethods : paymentMethods).map((method) => {
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
                  {!needsRefundHandling ? statusActions.map((action) => (
                    <button
                      className={action.className}
                      type="button"
                      key={action.status}
                      disabled={!canManageCustomerPaymentMethods || isActionLoading}
                      onClick={() => onUpdatePaymentMethodStatus(method, action.status)}
                    >
                      {action.label}
                    </button>
                  )) : null}
                </div>
              </article>
            )
          })}
        </div>
      )}
      {!needsRefundHandling && !canManageCustomerPaymentMethods ? (
        <p className="admin-permission-note">Cần quyền customers.manage để cập nhật phương thức thanh toán.</p>
      ) : null}
    </section>
  )
}
