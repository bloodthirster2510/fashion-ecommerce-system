import {
  useState,
  type FormEvent,
} from 'react'
import type { CreateInventoryImportInput, InventoryImport } from '../inventory.types'
import type { InventoryColorGroup } from '../inventory.view-types'
import {
  formatDate,
  formatNumber,
  formatPrice,
  getImportRemainingClass,
} from '../inventory.utils'

type ImportConfirmation = {
  input: CreateInventoryImportInput
  lines: string[]
} | null

export function ImportDialog({
  row: group,
  supplierOptions,
  isSaving,
  errorMessage,
  onClose,
  onSave,
}: {
  row: InventoryColorGroup
  supplierOptions: string[]
  isSaving: boolean
  errorMessage: string
  onClose: () => void
  onSave: (input: CreateInventoryImportInput) => Promise<void>
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>(
    () => Object.fromEntries(group.rows.map((row) => [row.size, 0])),
  )
  const [importPrice, setImportPrice] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const [pendingConfirmation, setPendingConfirmation] = useState<ImportConfirmation>(null)
  const totalImport = Object.values(quantities).reduce(
    (sum, quantity) => sum + Math.max(0, quantity),
    0,
  )
  const hasImportPrice = importPrice.trim().length > 0
  const parsedImportPrice = hasImportPrice ? Number(importPrice) : null
  const isImportPriceValid =
    parsedImportPrice === null || (Number.isFinite(parsedImportPrice) && parsedImportPrice >= 0)
  const totalAmount = totalImport * (isImportPriceValid && parsedImportPrice ? parsedImportPrice : 0)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!isImportPriceValid) return

    const detail = group.rows
      .filter((row) => (quantities[row.size] ?? 0) > 0)
      .map((row) => ({
        size: row.size,
        quantity: quantities[row.size] ?? 0,
        ...(parsedImportPrice !== null ? { importPrice: parsedImportPrice } : {}),
      }))

    if (!detail.length) return

    const lines = [
      `Sản phẩm: ${group.product?.name || '-'}`,
      `Màu: ${group.color?.color || '-'}`,
      `Nhà cung cấp: ${supplierName.trim() || '-'}`,
      `Số lượng: ${formatNumber(totalImport)} sản phẩm`,
      `Thành tiền: ${formatPrice(totalAmount)}`,
    ]

    const input = {
      productId: group.productId,
      variantId: group.variantId,
      colorVariantId: group.colorVariantId,
      supplierName: supplierName.trim(),
      detail,
    }

    setPendingConfirmation({ input, lines })
  }

  return (
    <div className="admin-inventory-dialog-layer" role="dialog" aria-modal="true" aria-labelledby="import-dialog-title">
      <button className="admin-inventory-dialog-backdrop" type="button" aria-label="Đóng" disabled={isSaving} onClick={onClose} />
      <form className="admin-inventory-dialog admin-inventory-import-dialog" onSubmit={handleSubmit}>
        <header>
          <div><span>Nhập kho theo màu</span><h2 id="import-dialog-title">{group.product?.name}</h2></div>
          <button className="admin-icon-button" type="button" disabled={isSaving} onClick={onClose}>×</button>
        </header>
        <div className="admin-inventory-import-body">
          <div className="admin-import-selection">
            <div><span>Fit type</span><strong>{group.variant?.fitTypeLabel || '-'}</strong></div>
            <div><span>Màu sắc</span><strong>{group.color?.color || '-'}</strong></div>
            <div><span>Số size</span><strong>{group.rows.length}</strong></div>
            <div><span>Tổng tồn hiện tại</span><strong>{formatNumber(group.rows.reduce((sum, row) => sum + row.availableQuantity, 0))}</strong></div>
          </div>
          {errorMessage ? <p className="admin-notice is-error">{errorMessage}</p> : null}
          <label>
            <span>Nhà cung cấp</span>
            <input
              list="inventory-supplier-options"
              maxLength={120}
              placeholder="Nhập hoặc chọn nhà cung cấp"
              value={supplierName}
              onChange={(event) => setSupplierName(event.target.value)}
            />
            <datalist id="inventory-supplier-options">
              {supplierOptions.map((supplier) => (
                <option value={supplier} key={supplier} />
              ))}
            </datalist>
          </label>
          <div className="admin-import-size-list">
            <header>
              <span>Size</span>
              <span>Tồn hiện tại</span>
              <span>Số lượng nhập</span>
            </header>
            {group.rows.map((row) => (
              <label key={row.size}>
                <strong>{row.size}</strong>
                <span>{formatNumber(row.availableQuantity)}</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={(quantities[row.size] ?? 0) === 0 ? '' : quantities[row.size]}
                  onFocus={() =>
                    setQuantities((current) => ({
                      ...current,
                      [row.size]: current[row.size] ?? 0,
                    }))
                  }
                  onChange={(event) =>
                    setQuantities((current) => ({
                      ...current,
                      [row.size]: event.target.value
                        ? Math.max(0, Number.parseInt(event.target.value, 10) || 0)
                        : 0,
                    }))
                  }
                />
              </label>
            ))}
          </div>
          <label><span>Giá nhập (VND)</span><input type="number" min={0} step={1000} value={importPrice} placeholder="Không bắt buộc, áp dụng cho các size được nhập" onChange={(event) => setImportPrice(event.target.value)} /></label>
          <label><span>Thành tiền</span><input type="text" disabled value={formatPrice(totalAmount)} /></label>
        </div>
        {pendingConfirmation ? (
          <section className="admin-inventory-confirm-panel" role="alertdialog" aria-label="Xác nhận tạo phiếu nhập kho">
            <div>
              <strong>Xác nhận tạo phiếu nhập kho?</strong>
              {pendingConfirmation.lines.map((line) => <span key={line}>{line}</span>)}
            </div>
            <div>
              <button className="admin-secondary-button" type="button" disabled={isSaving} onClick={() => setPendingConfirmation(null)}>
                Kiểm tra lại
              </button>
              <button
                className="admin-primary-button"
                type="button"
                disabled={isSaving}
                onClick={() => {
                  const input = pendingConfirmation.input
                  setPendingConfirmation(null)
                  void onSave(input)
                }}
              >
                Xác nhận nhập kho
              </button>
            </div>
          </section>
        ) : null}
        <footer>
          <button className="admin-secondary-button" type="button" disabled={isSaving} onClick={onClose}>Hủy</button>
          <button className="admin-primary-button" type="submit" disabled={isSaving || Boolean(pendingConfirmation) || totalImport < 1 || !isImportPriceValid}>{isSaving ? 'Đang tạo...' : `Nhập ${formatNumber(totalImport)} sản phẩm`}</button>
        </footer>
      </form>
    </div>
  )
}

export function InventoryHistoryDialog({
  group,
  imports,
  isLoading,
  errorMessage,
  isDeleting,
  onDeleteImport,
  onClose,
}: {
  group: InventoryColorGroup
  imports: InventoryImport[]
  isLoading: boolean
  errorMessage: string
  isDeleting: boolean
  onDeleteImport: (importId: string) => Promise<void>
  onClose: () => void
}) {
  // So sánh tồn đang bán với tồn theo lô để báo khi dữ liệu bị lệch.
  const inventoryTotal = group.rows.reduce((sum, row) => sum + row.availableQuantity, 0)
  const lotTotal = imports.reduce(
    (sum, item) =>
      sum + item.detail.reduce((detailSum, detail) => detailSum + detail.remainingQuantity, 0),
    0,
  )
  const hasLotSnapshot = !isLoading && !errorMessage
  const hasInventoryLotMismatch = hasLotSnapshot && lotTotal !== inventoryTotal
  const [pendingDeleteImport, setPendingDeleteImport] = useState<InventoryImport | null>(null)

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
            <div><dt>Fit type</dt><dd>{group.variant?.fitTypeLabel || '-'}</dd></div>
            <div><dt>Màu sắc</dt><dd>{group.color?.color || '-'}</dd></div>
            <div><dt>Số size</dt><dd>{group.rows.length}</dd></div>
            <div><dt>Tồn theo lot</dt><dd>{hasLotSnapshot ? formatNumber(lotTotal) : 'Đang tải'}</dd></div>
            <div><dt>Tồn đang bán</dt><dd>{formatNumber(inventoryTotal)}</dd></div>
          </dl>
        </div>
        {hasInventoryLotMismatch ? (
          <p className="admin-inventory-reconcile-warning">
            Tồn theo lot đang lệch {formatNumber(Math.abs(inventoryTotal - lotTotal))} so với tồn đang bán.
          </p>
        ) : null}
        <div className="admin-import-history">
          <header>
            <span>Mã phiếu</span>
            <span>Thời gian nhập</span>
            <span>Nhà cung cấp</span>
            <span>Size</span>
            <span>Tồn/Tổng</span>
            <span>Tổng tiền</span>
            <span>Hành động</span>
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
                <button
                  className="admin-danger-link"
                  type="button"
                  disabled={isDeleting || Boolean(item.receiptId)}
                  title={item.receiptId ? 'Lot nhập từ phiếu nhập kho không thể xóa riêng lẻ.' : undefined}
                  onClick={() => setPendingDeleteImport(item)}
                >
                  Xóa
                </button>
              </article>
            )
          }) : null}
        </div>
      </section>
      {pendingDeleteImport ? (
        <div className="admin-inventory-delete-dialog-layer" role="alertdialog" aria-modal="true" aria-labelledby="delete-import-lot-title">
          <button
            className="admin-inventory-delete-dialog-backdrop"
            type="button"
            aria-label="Đóng xác nhận xóa lô nhập"
            disabled={isDeleting}
            onClick={() => setPendingDeleteImport(null)}
          />
          <section className="admin-inventory-delete-dialog">
            <div>
              <strong id="delete-import-lot-title">Xóa lô nhập này?</strong>
              <span>Mã lô nhập: {pendingDeleteImport.importCode || pendingDeleteImport._id.slice(-8).toUpperCase()}</span>
              <span>Hệ thống sẽ trừ lại tồn kho theo lượng còn lại của lô nhập.</span>
            </div>
            <footer>
              <button className="admin-secondary-button" type="button" disabled={isDeleting} onClick={() => setPendingDeleteImport(null)}>
                Giữ lại
              </button>
              <button
                className="admin-danger-button"
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  const importId = pendingDeleteImport._id
                  setPendingDeleteImport(null)
                  void onDeleteImport(importId)
                }}
              >
                Xóa lô nhập
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  )
}
