import {
  type QuantityDetail,
  formatNumber,
  getInventoryStatus,
} from '../productDisplay.helpers'

export function ProductInventoryBySizeDialog({
  detail,
  lowStockThreshold,
  onClose,
}: {
  detail: Exclude<QuantityDetail, null>
  lowStockThreshold: number
  onClose: () => void
}) {
  const total = detail.color.inventory.reduce(
    (sum, item) => sum + item.availableQuantity,
    0,
  )

  return (
    <div className="admin-quantity-dialog-layer" role="dialog" aria-modal="true" aria-labelledby="quantity-dialog-title">
      <button className="admin-quantity-dialog-backdrop" type="button" aria-label="Đóng" onClick={onClose} />
      <section className="admin-quantity-dialog">
        <header>
          <div>
            <span>Chi tiết tồn kho</span>
            <h2 id="quantity-dialog-title">{detail.color.color}</h2>
            <p>{detail.productName} · {detail.fitTypeLabel}</p>
          </div>
          <button className="admin-secondary-button" type="button" onClick={onClose}>Đóng</button>
        </header>

        <div className="admin-quantity-summary">
          <span>Tổng số lượng</span>
          <strong>{formatNumber(total)}</strong>
        </div>

        <div className="admin-quantity-table-shell">
          <table className="admin-quantity-table">
            <thead>
              <tr>
                <th>Size</th>
                <th>Số lượng</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {detail.color.inventory.map((item) => {
                const status = getInventoryStatus([item], detail.isActive, lowStockThreshold)
                return (
                  <tr key={`${detail.color._id}:${item.size}`}>
                    <td><strong>{item.size}</strong></td>
                    <td>{formatNumber(item.availableQuantity)}</td>
                    <td>
                      <span className={`admin-inventory-status ${status.className}`}>
                        {status.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <footer>
          <span className="admin-inventory-status is-available">Còn hàng</span>
          <span className="admin-inventory-status is-low">Sắp hết ≤ {formatNumber(lowStockThreshold)}</span>
          <span className="admin-inventory-status is-out">Hết hàng</span>
          <span className="admin-inventory-status is-inactive">Tạm ẩn</span>
        </footer>
      </section>
    </div>
  )
}
