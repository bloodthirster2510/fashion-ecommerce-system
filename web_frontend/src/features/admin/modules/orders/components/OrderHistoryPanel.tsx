import type {
  AdminAuditLog,
  AdminOrder,
  AdminOrderStatus,
  AdminReturnReviewDecision,
} from '../orderAdminApi'
import {
  actorRoleLabels,
  auditActionLabels,
  auditTargetTypeLabels,
  formatDate,
  getNoNextOrderStepMessage,
  getStatusActionLabel,
} from '../orderPresentation'
import { isStatusBlockedByPayment } from '../utils/orderQueue'

type OrderHistoryPanelProps = {
  auditLogPageSize: number
  auditLogs: AdminAuditLog[]
  canUpdateOrders: boolean
  hasMoreAuditLogs: boolean
  hasPendingReturnRequest: boolean
  isActionLoading: boolean
  order: AdminOrder
  statusOptions: AdminOrderStatus[]
  visibleAuditLogCount: number
  visibleAuditLogs: AdminAuditLog[]
  onLoadMoreAuditLogs: () => void
  onRefresh: () => void
  onReviewReturnRequest: (decision: AdminReturnReviewDecision) => void
  onStatusUpdate: (status: AdminOrderStatus) => void
}

export function OrderHistoryPanel({
  auditLogPageSize,
  auditLogs,
  canUpdateOrders,
  hasMoreAuditLogs,
  hasPendingReturnRequest,
  isActionLoading,
  order,
  statusOptions,
  visibleAuditLogCount,
  visibleAuditLogs,
  onLoadMoreAuditLogs,
  onRefresh,
  onReviewReturnRequest,
  onStatusUpdate,
}: OrderHistoryPanelProps) {
  return (
    <>
      <section className="admin-drawer-section admin-order-section-main admin-order-section-audit">
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
            {visibleAuditLogs.map((log) => (
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
            {hasMoreAuditLogs ? (
              <button
                className="admin-audit-log-more-button"
                type="button"
                onClick={onLoadMoreAuditLogs}
              >
                Xem thêm {Math.min(auditLogPageSize, auditLogs.length - visibleAuditLogCount)} thao tác
              </button>
            ) : null}
          </div>
        )}
      </section>

      <section className="admin-drawer-section admin-order-section-side admin-order-section-actions">
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
    </>
  )
}
