import type { AdminAuditLog } from '../orderAdminApi'
import {
  actorRoleLabels,
  auditActionLabels,
  auditTargetTypeLabels,
  formatDate,
} from '../orderPresentation'

type OrderHistoryPanelProps = {
  auditLogPageSize: number
  auditLogs: AdminAuditLog[]
  hasMoreAuditLogs: boolean
  visibleAuditLogCount: number
  visibleAuditLogs: AdminAuditLog[]
  onLoadMoreAuditLogs: () => void
  onRefresh: () => void
}

export function OrderHistoryPanel({
  auditLogPageSize,
  auditLogs,
  hasMoreAuditLogs,
  visibleAuditLogCount,
  visibleAuditLogs,
  onLoadMoreAuditLogs,
  onRefresh,
}: OrderHistoryPanelProps) {
  return (
    <section className="admin-drawer-section admin-order-section-summary admin-order-section-audit">
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
  )
}
