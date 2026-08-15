import type { InventoryImport, InventoryMovement } from '../inventory.types'
import type { InventoryColorGroup } from '../inventory.view-types'
import {
  formatDate,
  formatNumber,
  formatPrice,
  getImportRemainingClass,
} from '../inventory.utils'

export function InventoryHistoryDialog({
  group,
  imports,
  movements,
  isLoading,
  errorMessage,
  onClose,
}: {
  group: InventoryColorGroup
  imports: InventoryImport[]
  movements: InventoryMovement[]
  isLoading: boolean
  errorMessage: string
  onClose: () => void
}) {
  const inventoryTotal = group.rows.reduce((sum, row) => sum + row.availableQuantity, 0)
  const movementLabels: Record<InventoryMovement['type'], string> = {
    import: 'Nhập kho',
    import_delete: 'Xóa lô nhập',
    adjustment: 'Điều chỉnh',
    sale_commit: 'Bán hàng',
    reservation: 'Giữ hàng',
    reservation_release: 'Hủy giữ',
    reservation_expire: 'Hết hạn giữ',
    stocktake: 'Kiểm kê',
  }

  return (
    <div className="admin-inventory-dialog-layer" role="dialog" aria-modal="true" aria-labelledby="inventory-history-title">
      <button className="admin-inventory-dialog-backdrop" type="button" aria-label="Đóng" onClick={onClose} />
      <section className="admin-inventory-dialog admin-inventory-history-dialog">
        <header>
          <div>
            <span>Lịch sử nhập kho</span>
            <h2 id="inventory-history-title">{group.product?.name}</h2>
          </div>
          <button className="admin-secondary-button" type="button" onClick={onClose}>Đóng</button>
        </header>
        <div className="admin-inventory-detail">
          <img src={group.color?.image || group.product?.productImage} alt="" />
          <dl>
            <div><dt>Phom dáng</dt><dd>{group.variant?.fitTypeLabel || '-'}</dd></div>
            <div><dt>Màu sắc</dt><dd>{group.color?.color || '-'}</dd></div>
            <div><dt>Số size</dt><dd>{group.rows.length}</dd></div>
            <div><dt>Tồn đang bán</dt><dd>{formatNumber(inventoryTotal)}</dd></div>
          </dl>
        </div>
        <div className="admin-import-history">
          <header>
            <span>Mã phiếu</span>
            <span>Thời gian nhập</span>
            <span>Nhà cung cấp</span>
            <span>Size</span>
            <span>Tồn/Tổng</span>
            <span>Tổng tiền</span>
          </header>
          {isLoading ? <p>Đang tải lịch sử nhập kho...</p> : null}
          {errorMessage ? <p className="admin-notice is-error">{errorMessage}</p> : null}
          {!isLoading && !errorMessage && imports.length === 0 ? (
            <p>Chưa có phiếu nhập kho cho màu này.</p>
          ) : null}
          {!isLoading && !errorMessage ? imports.map((item) => {
            return (
              <article key={item._id}>
                <strong>{item.importCode || item._id.slice(-8).toUpperCase()}</strong>
                <span>{formatDate(item.createdAt)}</span>
                <span>{item.supplierName || '-'}</span>
                <span className="admin-import-size-column">
                  {item.detail.map((detail) => (
                    <strong className="admin-import-size-pill" key={`${item._id}:${detail.size}`}>
                      {detail.size}
                    </strong>
                  ))}
                </span>
                <span className="admin-import-quantity-column">
                  {item.detail.map((detail) => (
                    <span className="admin-import-quantity-row" key={`${item._id}:${detail.size}`}>
                      <em className={getImportRemainingClass(detail.remainingQuantity, detail.quantity)}>
                        Tồn {formatNumber(detail.remainingQuantity)}
                      </em>
                      <em>Tổng {formatNumber(detail.quantity)}</em>
                      {detail.importPrice !== undefined ? <small>{formatPrice(detail.importPrice)}</small> : null}
                    </span>
                  ))}
                </span>
                <strong>{formatPrice(item.totalAmount ?? 0)}</strong>
              </article>
            )
          }) : null}
        </div>
        <div className="admin-inventory-movement-history">
          <div className="admin-inventory-history-section-heading">
            <h3>Bảng biến động kho</h3>
            <span>Theo dõi nhập, bán, điều chỉnh và kiểm kê theo từng size.</span>
          </div>
          <header>
            <span>Thời gian</span>
            <span>Loại</span>
            <span>Size</span>
            <span>Thay đổi</span>
            <span>Tồn sau</span>
            <span>Lý do</span>
          </header>
          {isLoading ? <p>Đang tải sổ biến động kho...</p> : null}
          {!isLoading && !errorMessage && movements.length === 0 ? (
            <p>Chưa có biến động kho cho màu này.</p>
          ) : null}
          {!isLoading && !errorMessage ? movements.map((movement) => (
            <article key={movement._id}>
              <span>{formatDate(movement.createdAt)}</span>
              <strong>{movementLabels[movement.type] ?? movement.type}</strong>
              <span>{movement.size}</span>
              <span>{movement.quantityDelta > 0 ? '+' : ''}{formatNumber(movement.quantityDelta)}</span>
              <span>{formatNumber(movement.quantityAfter)}</span>
              <span>{movement.reason || '-'}</span>
            </article>
          )) : null}
        </div>
      </section>
    </div>
  )
}
