import type { AdminOrderStatus } from '../orderAdminApi'
import { statusLabels } from '../orderPresentation'

type OrderBulkToolbarProps = {
  availableBulkStatuses: AdminOrderStatus[]
  bulkReason: string
  bulkStatus: AdminOrderStatus
  canBulkCreateGhn: boolean
  canBulkSyncGhn: boolean
  canUpdateOrders: boolean
  isBulkLoading: boolean
  labelCount: number
  selectedCount: number
  onBulkGhn: (action: 'create' | 'sync') => void | Promise<void>
  onBulkReasonChange: (reason: string) => void
  onBulkStatusChange: (status: AdminOrderStatus) => void
  onBulkStatusUpdate: () => void | Promise<void>
  onClearSelection: () => void
  onOpenLabels: () => void
}

export function OrderBulkToolbar({
  availableBulkStatuses,
  bulkReason,
  bulkStatus,
  canBulkCreateGhn,
  canBulkSyncGhn,
  canUpdateOrders,
  isBulkLoading,
  labelCount,
  selectedCount,
  onBulkGhn,
  onBulkReasonChange,
  onBulkStatusChange,
  onBulkStatusUpdate,
  onClearSelection,
  onOpenLabels,
}: OrderBulkToolbarProps) {
  if (selectedCount === 0) return null
  const hasOperationalAction = availableBulkStatuses.length > 0 || canBulkCreateGhn || canBulkSyncGhn

  return (
    <section className="admin-order-bulk-toolbar" aria-label="Thao tác đơn hàng hàng loạt">
      <div className="admin-order-bulk-summary">
        <strong>Thao tác với {selectedCount} đơn đã chọn</strong>
        <button className="admin-link-button" type="button" disabled={isBulkLoading} onClick={onClearSelection}>
          Bỏ chọn
        </button>
      </div>

      {canUpdateOrders && hasOperationalAction ? (
        <div className="admin-order-bulk-fields">
          {availableBulkStatuses.length > 0 ? (
            <label>
              <span>Bước tiếp theo</span>
              <select
                value={bulkStatus}
                disabled={isBulkLoading}
                onChange={(event) => onBulkStatusChange(event.target.value as AdminOrderStatus)}
              >
                {availableBulkStatuses.map((status) => (
                  <option key={status} value={status}>{statusLabels[status]}</option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="admin-order-bulk-reason">
            <span>Lý do bắt buộc</span>
            <input
              type="text"
              maxLength={500}
              value={bulkReason}
              disabled={isBulkLoading}
              placeholder="Ví dụ: Bàn giao ca vận hành 29/07"
              onChange={(event) => onBulkReasonChange(event.target.value)}
            />
          </label>
        </div>
      ) : null}

      {canUpdateOrders && !hasOperationalAction ? (
        <p className="admin-muted-text">Các đơn đã chọn không còn thao tác trạng thái hoặc GHN chung.</p>
      ) : null}

      <div className="admin-order-bulk-actions">
        {canUpdateOrders ? (
          <>
            {availableBulkStatuses.length > 0 ? (
              <button
                className="admin-primary-button"
                type="button"
                disabled={isBulkLoading}
                onClick={() => void onBulkStatusUpdate()}
              >
                {isBulkLoading ? 'Đang xử lý...' : 'Cập nhật bước tiếp theo'}
              </button>
            ) : null}
            {canBulkCreateGhn ? (
              <button
                className="admin-secondary-button"
                type="button"
                disabled={isBulkLoading}
                onClick={() => void onBulkGhn('create')}
              >
                Tạo vận đơn GHN
              </button>
            ) : null}
            {canBulkSyncGhn ? (
              <button
                className="admin-secondary-button"
                type="button"
                disabled={isBulkLoading}
                onClick={() => void onBulkGhn('sync')}
              >
                Đồng bộ GHN
              </button>
            ) : null}
          </>
        ) : null}
        <button
          className="admin-secondary-button"
          type="button"
          disabled={isBulkLoading}
          onClick={onOpenLabels}
        >
          Mở/In nhãn ({labelCount})
        </button>
      </div>
    </section>
  )
}
