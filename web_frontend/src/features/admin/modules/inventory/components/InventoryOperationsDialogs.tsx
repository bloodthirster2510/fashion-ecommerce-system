import { useState, type FormEvent } from 'react'
import type {
  InventorySupplier,
  UpsertInventorySupplierInput,
} from '../inventory.types'
import type { InventoryColorGroup } from '../inventory.view-types'
import { formatNumber } from '../inventory.utils'

const reasonOptions = [
  'Kiểm kê lệch',
  'Hàng lỗi',
  'Mất hàng',
  'Bù tồn',
  'Sai số nhập liệu',
]

export function InventoryAdjustDialog({
  group,
  isSaving,
  errorMessage,
  onClose,
  onSave,
}: {
  group: InventoryColorGroup
  isSaving: boolean
  errorMessage: string
  onClose: () => void
  onSave: (inventoryId: string, quantity: number, reason: string, note: string) => Promise<void>
}) {
  const [inventoryId, setInventoryId] = useState(group.rows[0]?._id ?? '')
  const selectedRow = group.rows.find((row) => row._id === inventoryId) ?? group.rows[0]
  const [quantity, setQuantity] = useState(String(selectedRow?.quantity ?? 0))
  const [reason, setReason] = useState(reasonOptions[0])
  const [note, setNote] = useState('')

  const handleSelectRow = (nextId: string) => {
    const row = group.rows.find((item) => item._id === nextId)
    setInventoryId(nextId)
    setQuantity(String(row?.quantity ?? 0))
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const parsedQuantity = Number.parseInt(quantity || '0', 10)
    if (!selectedRow || !Number.isSafeInteger(parsedQuantity) || parsedQuantity < selectedRow.reservedQuantity) return
    void onSave(selectedRow._id, parsedQuantity, reason, note)
  }

  return (
    <div className="admin-inventory-dialog-layer" role="dialog" aria-modal="true" aria-labelledby="inventory-adjust-title">
      <button className="admin-inventory-dialog-backdrop" type="button" aria-label="Đóng" disabled={isSaving} onClick={onClose} />
      <form className="admin-inventory-dialog admin-inventory-operation-dialog" onSubmit={handleSubmit}>
        <header>
          <div>
            <span>Điều chỉnh tồn kho</span>
            <h2 id="inventory-adjust-title">{group.product?.name}</h2>
          </div>
          <button className="admin-icon-button" type="button" disabled={isSaving} onClick={onClose}>×</button>
        </header>
        <div className="admin-operation-grid">
          <label>
            <span>Size cần điều chỉnh</span>
            <select value={inventoryId} disabled={isSaving} onChange={(event) => handleSelectRow(event.target.value)}>
              {group.rows.map((row) => (
                <option value={row._id} key={row._id}>
                  Size {row.size} - hiện có {formatNumber(row.quantity)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Tồn sau điều chỉnh</span>
            <input
              type="number"
              min={selectedRow?.reservedQuantity ?? 0}
              step={1}
              disabled={isSaving}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
            <small>Không được thấp hơn số đang giữ: {formatNumber(selectedRow?.reservedQuantity ?? 0)}</small>
          </label>
          <label>
            <span>Lý do</span>
            <select value={reason} disabled={isSaving} onChange={(event) => setReason(event.target.value)}>
              {reasonOptions.map((option) => <option value={option} key={option}>{option}</option>)}
            </select>
          </label>
          <label className="admin-operation-full">
            <span>Ghi chú</span>
            <textarea
              rows={4}
              maxLength={500}
              disabled={isSaving}
              value={note}
              placeholder="Ví dụ: kiểm kê cuối ngày, hàng lỗi không bán được..."
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
        </div>
        {errorMessage ? <p className="admin-notice is-error">{errorMessage}</p> : null}
        <footer>
          <button className="admin-secondary-button" type="button" disabled={isSaving} onClick={onClose}>Hủy</button>
          <button className="admin-primary-button" type="submit" disabled={isSaving || !reason.trim()}>
            {isSaving ? 'Đang lưu...' : 'Lưu điều chỉnh'}
          </button>
        </footer>
      </form>
    </div>
  )
}

export function InventoryThresholdDialog({
  value,
  isSaving,
  errorMessage,
  onClose,
  onSave,
}: {
  value: number
  isSaving: boolean
  errorMessage: string
  onClose: () => void
  onSave: (lowStockThreshold: number) => Promise<void>
}) {
  const [threshold, setThreshold] = useState(String(value))
  const parsedThreshold = Number.parseInt(threshold || '0', 10)
  const isValid = Number.isSafeInteger(parsedThreshold) && parsedThreshold >= 0
  const isChanged = isValid && parsedThreshold !== value

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!isChanged) return
    void onSave(parsedThreshold)
  }

  return (
    <div className="admin-inventory-dialog-layer" role="dialog" aria-modal="true" aria-labelledby="inventory-threshold-title">
      <button className="admin-inventory-dialog-backdrop" type="button" aria-label="Đóng" disabled={isSaving} onClick={onClose} />
      <form className="admin-inventory-dialog admin-inventory-operation-dialog" onSubmit={handleSubmit}>
        <header>
          <div>
            <span>Ngưỡng cảnh báo</span>
            <h2 id="inventory-threshold-title">Cài đặt chung</h2>
          </div>
          <button className="admin-icon-button" type="button" disabled={isSaving} onClick={onClose}>×</button>
        </header>
        <div className="admin-operation-grid">
          <label className="admin-operation-full">
            <span>Số lượng bắt đầu cảnh báo sắp hết</span>
            <input
              type="number"
              min={0}
              step={1}
              disabled={isSaving}
              value={threshold}
              onChange={(event) => setThreshold(event.target.value)}
            />
            <small>Áp dụng chung cho tất cả sản phẩm, màu và size trong kho.</small>
          </label>
        </div>
        {errorMessage ? <p className="admin-notice is-error">{errorMessage}</p> : null}
        <footer>
          <button className="admin-secondary-button" type="button" disabled={isSaving} onClick={onClose}>Hủy</button>
          <button className="admin-primary-button" type="submit" disabled={isSaving || !isChanged}>
            {isSaving ? 'Đang lưu...' : 'Lưu ngưỡng'}
          </button>
        </footer>
      </form>
    </div>
  )
}

export function InventoryStocktakeDialog({
  group,
  isSaving,
  errorMessage,
  onClose,
  onSave,
}: {
  group: InventoryColorGroup
  isSaving: boolean
  errorMessage: string
  onClose: () => void
  onSave: (lines: Array<{ inventoryId: string; countedQuantity: number; reason?: string }>, note: string) => Promise<void>
}) {
  const [counts, setCounts] = useState<Record<string, string>>(
    () => Object.fromEntries(group.rows.map((row) => [row._id, String(row.quantity)])),
  )
  const [note, setNote] = useState('')
  const lines = group.rows.map((row) => ({
    inventoryId: row._id,
    countedQuantity: Number.parseInt(counts[row._id] || '0', 10) || 0,
    reason: 'Kiểm kê kho',
  }))
  const hasInvalid = lines.some((line) => {
    const row = group.rows.find((item) => item._id === line.inventoryId)
    return !Number.isSafeInteger(line.countedQuantity) || line.countedQuantity < (row?.reservedQuantity ?? 0)
  })
  const hasDifference = lines.some((line) => {
    const row = group.rows.find((item) => item._id === line.inventoryId)
    return line.countedQuantity !== (row?.quantity ?? 0)
  })

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (hasInvalid || !hasDifference) return
    void onSave(lines, note)
  }

  return (
    <div className="admin-inventory-dialog-layer" role="dialog" aria-modal="true" aria-labelledby="inventory-stocktake-title">
      <button className="admin-inventory-dialog-backdrop" type="button" aria-label="Đóng" disabled={isSaving} onClick={onClose} />
      <form className="admin-inventory-dialog admin-inventory-operation-dialog" onSubmit={handleSubmit}>
        <header>
          <div>
            <span>Kiểm kê kho</span>
            <h2 id="inventory-stocktake-title">{group.product?.name}</h2>
          </div>
          <button className="admin-icon-button" type="button" disabled={isSaving} onClick={onClose}>×</button>
        </header>
        <div className="admin-stocktake-list">
          {group.rows.map((row) => (
            <label key={row._id}>
              <span>Size {row.size}</span>
              <strong>Hệ thống {formatNumber(row.quantity)}</strong>
              <input
                type="number"
                min={row.reservedQuantity}
                step={1}
                disabled={isSaving}
                value={counts[row._id] ?? ''}
                onChange={(event) =>
                  setCounts((current) => ({
                    ...current,
                    [row._id]: event.target.value,
                  }))
                }
              />
              <small>Đang giữ {formatNumber(row.reservedQuantity)}</small>
            </label>
          ))}
        </div>
        <label className="admin-operation-note">
          <span>Ghi chú kiểm kê</span>
          <textarea rows={3} maxLength={500} disabled={isSaving} value={note} onChange={(event) => setNote(event.target.value)} />
        </label>
        {errorMessage ? <p className="admin-notice is-error">{errorMessage}</p> : null}
        <footer>
          <button className="admin-secondary-button" type="button" disabled={isSaving} onClick={onClose}>Hủy</button>
          <button className="admin-primary-button" type="submit" disabled={isSaving || hasInvalid || !hasDifference}>
            {isSaving ? 'Đang ghi nhận...' : 'Ghi nhận kiểm kê'}
          </button>
        </footer>
      </form>
    </div>
  )
}

export function InventorySupplierDialog({
  suppliers,
  isSaving,
  errorMessage,
  onClose,
  onCreate,
  onUpdate,
  onDisable,
}: {
  suppliers: InventorySupplier[]
  isSaving: boolean
  errorMessage: string
  onClose: () => void
  onCreate: (input: UpsertInventorySupplierInput) => Promise<void>
  onUpdate: (id: string, input: Partial<UpsertInventorySupplierInput>) => Promise<void>
  onDisable: (id: string) => Promise<void>
}) {
  const [editingId, setEditingId] = useState('')
  const editing = suppliers.find((item) => item._id === editingId)
  const [form, setForm] = useState<UpsertInventorySupplierInput>({ name: '' })

  const resetForm = () => {
    setEditingId('')
    setForm({ name: '' })
  }

  const handleEdit = (supplier: InventorySupplier) => {
    setEditingId(supplier._id)
    setForm({
      name: supplier.name,
      phone: supplier.phone ?? '',
      email: supplier.email ?? '',
      address: supplier.address ?? '',
      note: supplier.note ?? '',
      isActive: supplier.isActive,
    })
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!form.name.trim()) return
    void (editing ? onUpdate(editing._id, form) : onCreate(form)).then(resetForm)
  }

  return (
    <div className="admin-inventory-dialog-layer" role="dialog" aria-modal="true" aria-labelledby="inventory-supplier-title">
      <button className="admin-inventory-dialog-backdrop" type="button" aria-label="Đóng" disabled={isSaving} onClick={onClose} />
      <section className="admin-inventory-dialog admin-inventory-supplier-dialog">
        <header>
          <div>
            <span>Nhà cung cấp</span>
            <h2 id="inventory-supplier-title">Quản lý nhà cung cấp</h2>
          </div>
          <button className="admin-icon-button" type="button" disabled={isSaving} onClick={onClose}>×</button>
        </header>
        <form className="admin-supplier-form" onSubmit={handleSubmit}>
          <label><span>Tên nhà cung cấp</span><input value={form.name} disabled={isSaving} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label>
          <label><span>Số điện thoại</span><input value={form.phone ?? ''} disabled={isSaving} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} /></label>
          <label><span>Email</span><input value={form.email ?? ''} disabled={isSaving} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></label>
          <label className="admin-operation-full"><span>Địa chỉ</span><input value={form.address ?? ''} disabled={isSaving} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} /></label>
          <label className="admin-operation-full"><span>Ghi chú</span><textarea rows={3} value={form.note ?? ''} disabled={isSaving} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} /></label>
          <footer>
            {editing ? <button className="admin-secondary-button" type="button" disabled={isSaving} onClick={resetForm}>Tạo mới</button> : null}
            <button className="admin-primary-button" type="submit" disabled={isSaving || !form.name.trim()}>
              {editing ? 'Lưu nhà cung cấp' : 'Thêm nhà cung cấp'}
            </button>
          </footer>
        </form>
        {errorMessage ? <p className="admin-notice is-error">{errorMessage}</p> : null}
        <div className="admin-supplier-list">
          {suppliers.length === 0 ? <p>Chưa có nhà cung cấp.</p> : null}
          {suppliers.map((supplier) => (
            <article className={supplier.isActive ? '' : 'is-disabled'} key={supplier._id}>
              <div>
                <strong>{supplier.name}</strong>
                <span>{[supplier.phone, supplier.email].filter(Boolean).join(' · ') || 'Chưa có thông tin liên hệ'}</span>
              </div>
              <div>
                <button className="admin-secondary-link" type="button" disabled={isSaving} onClick={() => handleEdit(supplier)}>Sửa</button>
                {supplier.isActive ? (
                  <button className="admin-danger-link" type="button" disabled={isSaving} onClick={() => void onDisable(supplier._id)}>
                    Tạm ngưng
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
