import { useState } from 'react'
import {
  cancelInventoryReceipt,
  confirmInventoryReceipt,
} from '../inventory.service'
import type { InventoryReceipt } from '../inventory.types'
import type {
  InventoryReceiptListItem,
  ReceiptFilterStatus,
} from '../inventory.view-types'
import {
  formatDate,
  formatNumber,
  formatPrice,
  getErrorMessage,
} from '../inventory.utils'

export function InventoryReceiptListDialog({
  receipts,
  onRefresh,
  onClose,
  onOpenForm,
}: {
  receipts: InventoryReceiptListItem[]
  onRefresh: () => Promise<void>
  onClose: () => void
  onOpenForm: (receiptId: string) => void
}) {
  const [filterStatus, setFilterStatus] = useState<ReceiptFilterStatus>('all')
  const [selectedReceipt, setSelectedReceipt] = useState<InventoryReceiptListItem | null>(null)
  const [actionError, setActionError] = useState('')
  const [actionReceiptId, setActionReceiptId] = useState('')
  const filteredReceipts = receipts.filter(
    (receipt) => filterStatus === 'all' || receipt.status === filterStatus,
  )
  const counts = {
    all: receipts.length,
    draft: receipts.filter((receipt) => receipt.status === 'draft').length,
    confirmed: receipts.filter((receipt) => receipt.status === 'confirmed').length,
    cancelled: receipts.filter((receipt) => receipt.status === 'cancelled').length,
  }

  // Sau khi xác nhận hoặc hủy phiếu, tải lại danh sách để số liệu trên màn hình luôn đúng.
  const handleReceiptAction = async (
    receiptId: string,
    action: (receiptId: string) => Promise<InventoryReceipt>,
  ) => {
    setActionError('')
    setActionReceiptId(receiptId)
    try {
      await action(receiptId)
      await onRefresh()
    } catch (error) {
      setActionError(getErrorMessage(error))
    } finally {
      setActionReceiptId('')
    }
  }

  return (
    <div className="admin-inventory-dialog-layer" role="dialog" aria-modal="true" aria-labelledby="inventory-receipt-list-title">
      <button className="admin-inventory-dialog-backdrop" type="button" aria-label="Đóng" onClick={onClose} />
      <section className="admin-inventory-dialog admin-inventory-receipt-list-dialog">
        <header>
          <div>
            <span>Phiếu nhập kho</span>
            <h2 id="inventory-receipt-list-title">Danh sách phiếu nhập</h2>
          </div>
          <div className="admin-receipt-list-header-actions">
            <button className="admin-secondary-button" type="button" onClick={() => void onRefresh()}>Làm mới</button>
            <button className="admin-secondary-button" type="button" onClick={onClose}>Đóng</button>
          </div>
        </header>
        <div className="admin-receipt-list-tabs" aria-label="Lọc trạng thái phiếu nhập">
          {[
            ['all', 'Tất cả', counts.all],
            ['draft', 'Nháp', counts.draft],
            ['confirmed', 'Đã xác nhận', counts.confirmed],
            ['cancelled', 'Đã hủy', counts.cancelled],
          ].map(([value, label, count]) => (
            <button
              className={filterStatus === value ? 'is-active' : ''}
              type="button"
              key={value}
              onClick={() => setFilterStatus(value as ReceiptFilterStatus)}
            >
              <span>{label}</span>
              <strong>{formatNumber(Number(count))}</strong>
            </button>
          ))}
        </div>
        {actionError ? <p className="admin-notice is-error">{actionError}</p> : null}
        <div className="admin-receipt-list-table">
          <header>
            <span>Mã phiếu</span>
            <span>Nhà cung cấp</span>
            <span>Ngày nhập</span>
            <span>Số sản phẩm</span>
            <span>Tổng SL</span>
            <span>Tổng tiền</span>
            <span>Trạng thái</span>
            <span>Thao tác</span>
          </header>
          {filteredReceipts.length === 0 ? (
            <p>Chưa có phiếu nhập phù hợp.</p>
          ) : null}
          {filteredReceipts.map((receipt) => (
            <article key={receipt.id}>
              <strong>{receipt.code}</strong>
              <span>{receipt.supplierName}</span>
              <span>{formatDate(receipt.importDate)}</span>
              <span>{formatNumber(receipt.productCount)}</span>
              <span>{formatNumber(receipt.totalQuantity)}</span>
              <strong>{formatPrice(receipt.totalAmount)}</strong>
              <span className={`admin-receipt-status is-${receipt.status}`}>
                {receipt.status === 'draft' ? 'Nháp' : receipt.status === 'confirmed' ? 'Đã xác nhận' : 'Đã hủy'}
              </span>
              <div className="admin-receipt-row-actions">
                {receipt.status === 'draft' ? (
                  <>
                    <button className="admin-secondary-link" type="button" onClick={() => onOpenForm(receipt.id)}>Sửa</button>
                    <button
                      className="admin-danger-link"
                      type="button"
                      disabled={actionReceiptId === receipt.id}
                      onClick={() => void handleReceiptAction(receipt.id, cancelInventoryReceipt)}
                    >
                      Hủy
                    </button>
                    <button
                      className="admin-link-button"
                      type="button"
                      disabled={actionReceiptId === receipt.id}
                      onClick={() => void handleReceiptAction(receipt.id, confirmInventoryReceipt)}
                    >
                      Xác nhận
                    </button>
                  </>
                ) : (
                  <button className="admin-secondary-link" type="button" onClick={() => setSelectedReceipt(receipt)}>Xem</button>
                )}
              </div>
            </article>
          ))}
        </div>
        {selectedReceipt ? (
          <InventoryReceiptViewDialog
            receipt={selectedReceipt}
            onClose={() => setSelectedReceipt(null)}
          />
        ) : null}
      </section>
    </div>
  )
}

function InventoryReceiptViewDialog({
  receipt,
  onClose,
}: {
  receipt: InventoryReceiptListItem
  onClose: () => void
}) {
  return (
    <div className="admin-inventory-dialog-layer admin-receipt-view-layer" role="dialog" aria-modal="true" aria-labelledby="inventory-receipt-view-title">
      <button className="admin-inventory-dialog-backdrop" type="button" aria-label="Đóng chi tiết phiếu nhập" onClick={onClose} />
      <section className="admin-inventory-dialog admin-inventory-receipt-view-dialog">
        <header>
          <div>
            <span>Chi tiết phiếu nhập</span>
            <h2 id="inventory-receipt-view-title">{receipt.code}</h2>
          </div>
          <button className="admin-secondary-button" type="button" onClick={onClose}>Đóng</button>
        </header>
        <section className="admin-receipt-view-panel" aria-label="Thông tin phiếu nhập">
          <dl>
            <div><dt>Nhà cung cấp</dt><dd>{receipt.supplierName}</dd></div>
            <div><dt>Ngày nhập</dt><dd>{formatDate(receipt.importDate)}</dd></div>
            <div><dt>Trạng thái</dt><dd>{receipt.status === 'confirmed' ? 'Đã xác nhận' : receipt.status === 'cancelled' ? 'Đã hủy' : 'Nháp'}</dd></div>
          </dl>
          <div className="admin-receipt-view-summary">
            <article>
              <span>Số loại sản phẩm</span>
              <strong>{formatNumber(receipt.productCount)}</strong>
            </article>
            <article>
              <span>Số biến thể màu</span>
              <strong>{formatNumber(receipt.colorVariantCount)}</strong>
            </article>
            <article>
              <span>Tổng số lượng</span>
              <strong>{formatNumber(receipt.totalQuantity)}</strong>
            </article>
            <article>
              <span>Tổng tiền hàng</span>
              <strong>{formatPrice(receipt.totalAmount)}</strong>
            </article>
          </div>
          {receipt.products.map((product) => (
            <div className="admin-receipt-view-product-card" key={product.productId}>
              <div className="admin-receipt-view-product">
                <img src={product.productImage} alt="" />
                <div>
                  <strong>{product.productName}</strong>
                  <small>{product.categoryName}</small>
                </div>
              </div>
              <div className="admin-receipt-view-detail">
                <header>
                  <span>Phom dáng</span>
                  <span>Màu sắc</span>
                  <span>Size / Số lượng</span>
                  <span>Đơn giá</span>
                  <span>Thành tiền</span>
                </header>
                {product.rows.map((row) => (
                  <article key={row.key}>
                    <span>{row.fitTypeLabel}</span>
                    <span className="admin-receipt-view-color">
                      <span className="admin-receipt-view-thumb">
                        <img src={row.colorImage || product.productImage} alt="" />
                      </span>
                      <span>{row.colorName}</span>
                    </span>
                    <span className="admin-receipt-view-size-list">
                      {row.detail.map((detail) => (
                        <span className="admin-receipt-view-size-pill" key={`${row.key}:${detail.size}`}>
                          <strong>{detail.size}</strong>
                          <small>{formatNumber(detail.quantity)}</small>
                        </span>
                      ))}
                    </span>
                    <span className="admin-receipt-view-price-list">
                      {[...new Set(row.detail.map((detail) => detail.importPrice ?? 0))].map((price) => (
                        <small key={price}>{price ? formatPrice(price) : '-'}</small>
                      ))}
                    </span>
                    <strong>{formatPrice(row.totalAmount)}</strong>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </section>
      </section>
    </div>
  )
}
