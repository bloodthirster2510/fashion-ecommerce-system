import type {
  AdminOrder,
  AdminOrderStatus,
  AdminReturnReviewDecision,
} from '../orderAdminApi'
import {
  formatDate,
  getReturnRequestPillClass,
  returnRequestStatusLabels,
  statusLabels,
} from '../orderPresentation'

export function OrderReturnPanel({
  canUpdateOrders,
  isActionLoading,
  needsRefundHandling,
  order,
  onReviewReturnRequest,
  onStatusUpdate,
}: {
  canUpdateOrders: boolean
  isActionLoading: boolean
  needsRefundHandling: boolean
  order: AdminOrder
  onReviewReturnRequest: (decision: AdminReturnReviewDecision) => void
  onStatusUpdate: (status: AdminOrderStatus) => void
}) {
  const isReturnRejected = order.returnRequest?.status === 'rejected'
  const hasPendingReturnRequest = order.status === 'return_requested' && order.returnRequest?.status === 'requested'
  const canConfirmReturned = order.status === 'return_approved' && order.returnRequest?.status === 'approved'
  const issueSectionClass = needsRefundHandling ? 'admin-order-section-main' : 'admin-order-section-summary'

  return (
    <>
      {order.cancellation ? (
        <section className={`admin-drawer-section ${issueSectionClass} admin-order-section-issue`}>
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
        <section className={`admin-drawer-section ${issueSectionClass} admin-order-section-issue`}>
          <div className="admin-section-inline-heading">
            <h3>Yêu cầu trả hàng</h3>
            <span className={getReturnRequestPillClass(order.returnRequest.status)}>
              {returnRequestStatusLabels[order.returnRequest.status]}
            </span>
          </div>
          <article className={`admin-return-request-card${isReturnRejected ? ' is-rejected' : ''}`}>
            {isReturnRejected ? (
              <div className="admin-return-decision is-rejected">
                <strong>Đã từ chối yêu cầu trả hàng</strong>
                <span>
                  Đơn tiếp tục ở trạng thái “{statusLabels[order.status]}”. Quyết định này không tạo yêu cầu hoàn tiền.
                </span>
              </div>
            ) : (
              <strong className="admin-return-policy-note">
                Chính sách trả hàng: 7 ngày từ lúc đơn được giao tới khách.
              </strong>
            )}
            {hasPendingReturnRequest ? (
              <div className="admin-return-review-actions">
                <strong>Cần quyết định sau khi kiểm tra lý do và minh chứng</strong>
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
              </div>
            ) : null}
            {canConfirmReturned ? (
              <div className="admin-return-review-actions">
                <strong>Chỉ xác nhận sau khi shop thực tế nhận và kiểm tra sản phẩm trả.</strong>
                <button
                  className="admin-primary-button"
                  type="button"
                  disabled={!canUpdateOrders || isActionLoading}
                  onClick={() => onStatusUpdate('returned')}
                >
                  {isActionLoading ? 'Đang xử lý...' : 'Xác nhận đã nhận hàng trả'}
                </button>
              </div>
            ) : null}
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
                <dt>{isReturnRejected ? 'Lý do từ chối' : 'Phản hồi admin'}</dt>
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
            {(hasPendingReturnRequest || canConfirmReturned) && !canUpdateOrders ? (
              <p className="admin-permission-note">Tài khoản này chỉ có quyền xem đơn hàng.</p>
            ) : null}
          </article>
        </section>
      ) : null}

      {!order.cancellation && !order.returnRequest && !needsRefundHandling ? (
        <section className="admin-drawer-section admin-order-section-summary admin-order-section-issue">
          <h3>Trả/Hoàn</h3>
          <p className="admin-muted-text">Đơn hàng này chưa có yêu cầu trả hàng, hủy đơn hoặc thao tác hoàn tiền.</p>
        </section>
      ) : null}
    </>
  )
}
