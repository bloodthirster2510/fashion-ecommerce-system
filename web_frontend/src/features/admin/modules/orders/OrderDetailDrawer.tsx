import type {
  AdminAuditLog,
  AdminCustomerPaymentMethod,
  AdminOrder,
  AdminOrderPaymentStatus,
  AdminOrderStatus,
  AdminPaymentMethodStatus,
  AdminReturnReviewDecision,
  AdminTransaction,
} from './orderAdminApi'
import type { ShippingSimulationStatus } from './orderTypes'
import {
  actorRoleLabels,
  auditActionLabels,
  auditTargetTypeLabels,
  canCancelGhnShipment,
  canCreateGhnShipment,
  canSimulateShippingStatus,
  canSyncGhnShipment,
  formatCurrency,
  formatDate,
  formatShippingProvider,
  formatShippingStatus,
  getAddressLine,
  getCustomerPaymentMethodSubtitle,
  getNoNextOrderStepMessage,
  getOrderAttention,
  getOrderPillClass,
  getOrderRowClass,
  getPaymentDeadlineStatus,
  getPaymentMethodStatusActions,
  getPaymentMethodStatusClass,
  getPaymentPillClass,
  getReturnRequestPillClass,
  getReturnWindowStatus,
  getShippingPillClass,
  getShippingSimulationActionLabel,
  getStatusActionLabel,
  isStatusBlockedByPayment,
  nextStatusOptions,
  OrderProgressRail,
  paymentMethodLabels,
  paymentMethodStatusLabels,
  paymentStatusLabels,
  returnRequestStatusLabels,
  shippingSimulationActions,
  shouldWarnPaymentBeforeShipping,
  statusLabels,
  transactionStatusLabels,
} from './orderPresentation'

export function OrderDetailDrawer({
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
  const paymentDeadlineStatus = getPaymentDeadlineStatus(order)

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
            {paymentDeadlineStatus ? (
              <span className={paymentDeadlineStatus.className}>{paymentDeadlineStatus.label}</span>
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
          <OrderProgressRail shippingStatus={order.shipping?.status} status={order.status} />
          <div className="admin-detail-grid">
            <div className="admin-detail-card is-order">
              <span>Trạng thái đơn</span>
              <strong className={getOrderPillClass(order.status)}>{statusLabels[order.status]}</strong>
            </div>
            <div className="admin-detail-card is-payment">
              <span>Trạng thái thanh toán</span>
              <strong className={getPaymentPillClass(order.paymentStatus)}>{paymentStatusLabels[order.paymentStatus]}</strong>
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
