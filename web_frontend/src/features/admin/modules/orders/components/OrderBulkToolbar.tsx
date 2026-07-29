import type { AdminOrderStatus } from '../orderAdminApi'
import { statusLabels } from '../orderPresentation'

const bulkStatuses: AdminOrderStatus[] = [
  'confirmed',
  'packed',
  'shipping',
  'delivered',
  'completed',
  'cancelled',
]

type OrderBulkToolbarProps = {
  bulkReason: string
  bulkStatus: AdminOrderStatus
  canUpdateOrders: boolean
  isBulkLoading: boolean
  isExporting: boolean
  labelCount: number
  selectedCount: number
  onBulkGhn: (action: 'create' | 'sync') => void | Promise<void>
  onBulkReasonChange: (reason: string) => void
  onBulkStatusChange: (status: AdminOrderStatus) => void
  onBulkStatusUpdate: () => void | Promise<void>
  onClearSelection: () => void
  onExportCsv: () => void | Promise<void>
  onOpenLabels: () => void
}

export function OrderBulkToolbar({
  bulkReason,
  bulkStatus,
  canUpdateOrders,
  isBulkLoading,
  isExporting,
  labelCount,
  selectedCount,
  onBulkGhn,
  onBulkReasonChange,
  onBulkStatusChange,
  onBulkStatusUpdate,
  onClearSelection,
  onExportCsv,
  onOpenLabels,
}: OrderBulkToolbarProps) {
  const hasSelection = selectedCount > 0

  return (
    <section className="admin-order-bulk-toolbar" aria-label="Thao tác đơn hàng hàng loạt">
      <div className="admin-order-bulk-summary">
        <strong>Đã chọn {selectedCount} đơn</strong>
        {hasSelection ? (
          <button className="admin-link-button" type="button" disabled={isBulkLoading} onClick={onClearSelection}>
            Bỏ chọn
          </button>
        ) : (
          <span>Chọn các đơn trên trang để thao tác cùng lúc.</span>
        )}
      </div>

      {canUpdateOrders ? (
        <div className="admin-order-bulk-fields">
          <label>
            <span>Trạng thái đích</span>
            <select
              value={bulkStatus}
              disabled={isBulkLoading}
              onChange={(event) => onBulkStatusChange(event.target.value as AdminOrderStatus)}
            >
              {bulkStatuses.map((status) => (
                <option key={status} value={status}>{statusLabels[status]}</option>
              ))}
            </select>
          </label>
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

      <div className="admin-order-bulk-actions">
        {canUpdateOrders ? (
          <>
            <button
              className="admin-primary-button"
              type="button"
              disabled={!hasSelection || isBulkLoading}
              onClick={() => void onBulkStatusUpdate()}
            >
              {isBulkLoading ? 'Đang xử lý...' : 'Cập nhật trạng thái'}
            </button>
            <button
              className="admin-secondary-button"
              type="button"
              disabled={!hasSelection || isBulkLoading}
              onClick={() => void onBulkGhn('create')}
            >
              Tạo lại vận đơn GHN
            </button>
            <button
              className="admin-secondary-button"
              type="button"
              disabled={!hasSelection || isBulkLoading}
              onClick={() => void onBulkGhn('sync')}
            >
              Đồng bộ GHN
            </button>
          </>
        ) : null}
        <button
          className="admin-secondary-button"
          type="button"
          disabled={!hasSelection || isBulkLoading}
          onClick={onOpenLabels}
        >
          Mở/In nhãn ({labelCount})
        </button>
        <button
          className="admin-secondary-button"
          type="button"
          disabled={isExporting || isBulkLoading}
          onClick={() => void onExportCsv()}
        >
          {isExporting ? 'Đang xuất CSV...' : 'Xuất CSV theo bộ lọc'}
        </button>
      </div>
    </section>
  )
}
