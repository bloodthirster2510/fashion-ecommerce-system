import {
  useMemo,
  useRef,
  useState,
} from 'react'
import type { AdminUser } from '../../auth/adminSession'
import type { ManagedProduct } from '../../catalog/products/product.types'
import { requestAdminNotificationRefresh } from '../../../notifications/notification-summary-events'
import {
  confirmInventoryReceipt,
  createInventoryReceipt,
  updateInventoryReceipt,
} from '../inventory.service'
import type {
  InventoryReceipt,
  InventoryReceiptLine,
} from '../inventory.types'
import type {
  InventoryReceiptStatus,
  Notice,
  ReceiptProductEntry,
  ReceiptProductLine,
} from '../inventory.view-types'
import {
  createReceiptLine,
  createReceiptProductEntries,
  formatInputDate,
  formatNumber,
  formatPrice,
  getErrorMessage,
  getReceiptSummary,
} from '../inventory.utils'
import { ReceiptProductBlock } from './ReceiptProductLines'

export function InventoryReceiptDialog({
  currentUser,
  defaultCode,
  defaultDate,
  editingReceipt,
  canWrite,
  products,
  onSaved,
  onClose,
}: {
  currentUser: AdminUser
  defaultCode: string
  defaultDate: string
  editingReceipt: InventoryReceipt | null
  canWrite: boolean
  products: ManagedProduct[]
  onSaved: () => Promise<void>
  onClose: () => void
}) {
  const productRefs = useRef<Map<string, HTMLElement>>(new Map())
  const [receiptCode, setReceiptCode] = useState(editingReceipt?.receiptCode ?? defaultCode)
  const [supplierName, setSupplierName] = useState(editingReceipt?.supplierName ?? '')
  const [importDate, setImportDate] = useState(
    editingReceipt ? formatInputDate(new Date(editingReceipt.importDate)) : defaultDate,
  )
  const [status, setStatus] = useState<InventoryReceiptStatus>(editingReceipt?.status ?? 'draft')
  const [note, setNote] = useState(editingReceipt?.note ?? '')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [productKeyword, setProductKeyword] = useState('')
  const [selectedProductId, setSelectedProductId] = useState('')
  const [receiptProducts, setReceiptProducts] = useState<ReceiptProductEntry[]>(
    () => createReceiptProductEntries(editingReceipt, products),
  )
  const [receiptNotice, setReceiptNotice] = useState<Notice>(null)
  const [isReceiptSaving, setIsReceiptSaving] = useState(false)
  const isEditingReceipt = Boolean(editingReceipt)
  const receiptSummary = useMemo(
    () => getReceiptSummary(receiptProducts),
    [receiptProducts],
  )

  const categoryOptions = useMemo(
    () => [...new Set(products.map((product) => product.categoryName).filter(Boolean))].sort(),
    [products],
  )

  const filteredProducts = useMemo(() => {
    const normalizedKeyword = productKeyword.trim().toLocaleLowerCase('vi')
    return products
      .filter((product) => selectedCategory === 'all' || product.categoryName === selectedCategory)
      .filter((product) => !normalizedKeyword || product.name.toLocaleLowerCase('vi').includes(normalizedKeyword))
      .sort((left, right) => left.name.localeCompare(right.name, 'vi'))
  }, [productKeyword, products, selectedCategory])

  // Không thêm trùng sản phẩm; nếu đã có thì cuộn tới khối sản phẩm đó.
  const handleAddProduct = () => {
    const normalizedKeyword = productKeyword.trim().toLocaleLowerCase('vi')
    const product =
      products.find((item) => item._id === selectedProductId) ??
      filteredProducts.find((item) => item.name.toLocaleLowerCase('vi') === normalizedKeyword) ??
      filteredProducts[0]

    if (!product) return

    const existing = receiptProducts.find((entry) => entry.product._id === product._id)
    if (existing) {
      productRefs.current.get(existing.product._id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setSelectedProductId('')
      setProductKeyword('')
      return
    }

    setReceiptProducts((current) => [
      ...current,
      { product, lines: [createReceiptLine()] },
    ])
    setSelectedProductId('')
    setProductKeyword('')
    window.requestAnimationFrame(() => {
      productRefs.current.get(product._id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const updateProductLines = (
    productId: string,
    updater: (lines: ReceiptProductLine[]) => ReceiptProductLine[],
  ) => {
    setReceiptProducts((current) =>
      current.map((entry) =>
        entry.product._id === productId
          ? { ...entry, lines: updater(entry.lines) }
          : entry,
      ),
    )
  }

  const updateReceiptLine = (
    productId: string,
    lineId: string,
    updater: (line: ReceiptProductLine) => ReceiptProductLine,
  ) => {
    // Luôn giữ một dòng trống để admin có thể chọn thêm form dáng hoặc màu tiếp theo.
    updateProductLines(productId, (lines) => {
      const nextLines = lines.map((line) => (line.id === lineId ? updater(line) : line))
      const hasDraftLine = nextLines.some((line) => !line.variantId || !line.colorVariantId)
      return hasDraftLine ? nextLines : [...nextLines, createReceiptLine()]
    })
  }

  const removeReceiptProduct = (productId: string) => {
    setReceiptProducts((current) => current.filter((entry) => entry.product._id !== productId))
    productRefs.current.delete(productId)
  }

  const removeReceiptLine = (productId: string, lineId: string) => {
    updateProductLines(productId, (lines) => {
      const nextLines = lines.filter((line) => line.id !== lineId)
      return nextLines.length ? nextLines : [createReceiptLine()]
    })
  }

  // Lấy các dòng có nhập số lượng để gửi lên server, bỏ qua dòng trống và size bằng 0.
  const getReceiptLines = () =>
    receiptProducts.flatMap((entry) =>
      entry.lines.flatMap<InventoryReceiptLine>((line) => {
        if (!line.variantId || !line.colorVariantId) return []

        const detail = Object.entries(line.quantities)
          .map(([size, value]) => ({
            size,
            quantity: Number.parseInt(value || '0', 10) || 0,
            ...(line.unitPrice ? { importPrice: Number(line.unitPrice) || 0 } : {}),
          }))
          .filter((item) => item.quantity > 0)

        if (!detail.length) return []

        return [{
          productId: entry.product._id,
          variantId: line.variantId,
          colorVariantId: line.colorVariantId,
          detail,
        }]
      }),
    )

  // Lưu nháp chỉ lưu phiếu; xác nhận phiếu mới tạo lô nhập và cộng tồn kho.
  const handleSaveReceipt = async (nextStatus: InventoryReceiptStatus) => {
    const lines = getReceiptLines()

    if (nextStatus === 'confirmed' && lines.length < 1) {
      setReceiptNotice({ type: 'error', message: 'Vui lòng nhập ít nhất một sản phẩm trước khi xác nhận phiếu.' })
      return
    }

    setIsReceiptSaving(true)
    setReceiptNotice(null)
    try {
      const payload = {
        receiptCode: receiptCode.trim(),
        supplierName: supplierName.trim(),
        importDate,
        note: note.trim(),
        lines,
      }

      if (editingReceipt) {
        await updateInventoryReceipt(editingReceipt._id, payload)
        if (nextStatus === 'confirmed') {
          await confirmInventoryReceipt(editingReceipt._id)
        }
      } else {
        await createInventoryReceipt({
          ...payload,
          status: nextStatus,
        })
      }

      setStatus(nextStatus)
      await onSaved()
      if (nextStatus === 'confirmed') {
        requestAdminNotificationRefresh()
      }
      setReceiptNotice({
        type: 'success',
        message: nextStatus === 'confirmed'
          ? 'Phiếu nhập kho đã được xác nhận.'
          : isEditingReceipt
            ? 'Phiếu nhập kho đã được cập nhật.'
            : 'Phiếu nhập kho đã được lưu nháp.',
      })
      onClose()
    } catch (error) {
      setReceiptNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setIsReceiptSaving(false)
    }
  }

  return (
    <div className="admin-inventory-dialog-layer" role="dialog" aria-modal="true" aria-labelledby="inventory-receipt-title">
      <button className="admin-inventory-dialog-backdrop" type="button" aria-label="Đóng" onClick={onClose} />
      <form className="admin-inventory-dialog admin-inventory-receipt-dialog" onSubmit={(event) => event.preventDefault()}>
        <header>
          <div>
            <span>Phiếu nhập kho</span>
            <h2 id="inventory-receipt-title">{isEditingReceipt ? 'Sửa phiếu nhập kho' : 'Phiếu nhập kho'}</h2>
          </div>
          <button className="admin-icon-button" type="button" onClick={onClose} aria-label="Đóng">×</button>
        </header>
        <section className="admin-receipt-info-card" aria-labelledby="inventory-receipt-info-title">
          <div className="admin-receipt-info-heading">
            <h3 id="inventory-receipt-info-title">Thông tin phiếu</h3>
          </div>
          <div className="admin-receipt-form-grid">
            <label>
              <span>Mã phiếu nhập</span>
              <input
                value={receiptCode}
                maxLength={40}
                placeholder="PN00001"
                disabled={isReceiptSaving}
                onChange={(event) => setReceiptCode(event.target.value.toUpperCase())}
              />
            </label>
            <label>
              <span>Nhà cung cấp</span>
              <input
                value={supplierName}
                maxLength={120}
                placeholder="Nhập tên nhà cung cấp"
                disabled={isReceiptSaving}
                onChange={(event) => setSupplierName(event.target.value)}
              />
            </label>
            <label>
              <span>Ngày nhập hàng</span>
              <input
                type="date"
                value={importDate}
                disabled={isReceiptSaving}
                onChange={(event) => setImportDate(event.target.value)}
              />
            </label>
            <label>
              <span>Người nhập kho</span>
              <input
                value={`${currentUser.name} (${currentUser.email})`}
                disabled
                aria-describedby="inventory-receipt-user-permission"
              />
              <small id="inventory-receipt-user-permission">
                {canWrite ? 'Tài khoản có quyền nhập kho.' : 'Tài khoản chưa có quyền nhập kho.'}
              </small>
            </label>
            <label>
              <span>Trạng thái phiếu</span>
              <select
                value={status}
                disabled={isReceiptSaving}
                onChange={(event) => setStatus(event.target.value as InventoryReceiptStatus)}
              >
                <option value="draft">Nháp</option>
                <option value="confirmed">Đã xác nhận</option>
              </select>
            </label>
            <label className="admin-receipt-note-field">
              <span>Ghi chú</span>
              <textarea
                value={note}
                maxLength={500}
                rows={4}
                placeholder="Nhập ghi chú cho phiếu nhập"
                disabled={isReceiptSaving}
                onChange={(event) => setNote(event.target.value)}
              />
            </label>
          </div>
        </section>
        <section className="admin-receipt-products-card" aria-labelledby="inventory-receipt-products-title">
          <div className="admin-receipt-info-heading">
            <h3 id="inventory-receipt-products-title">Hàng hóa nhập</h3>
          </div>
          <div className="admin-receipt-product-list">
            {receiptProducts.length === 0 ? (
              <p className="admin-receipt-empty-products">Chưa có sản phẩm trong phiếu nhập.</p>
            ) : null}
            {receiptProducts.map((entry) => (
              <ReceiptProductBlock
                key={entry.product._id}
                entry={entry}
                onRemove={removeReceiptProduct}
                onRemoveLine={removeReceiptLine}
                onUpdateLine={updateReceiptLine}
                setProductRef={(element) => {
                  if (element) productRefs.current.set(entry.product._id, element)
                  else productRefs.current.delete(entry.product._id)
                }}
              />
            ))}
          </div>
          <div className="admin-receipt-product-picker">
            <label>
              <span>Danh mục</span>
              <select
                value={selectedCategory}
                onChange={(event) => {
                  setSelectedCategory(event.target.value)
                  setSelectedProductId('')
                  setProductKeyword('')
                }}
              >
                <option value="all">Tất cả danh mục</option>
                {categoryOptions.map((option) => (
                  <option value={option} key={option}>{option}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Tìm theo tên sản phẩm</span>
              <input
                list="inventory-receipt-product-options"
                value={productKeyword}
                placeholder="Nhập tên sản phẩm"
                onChange={(event) => {
                  const nextKeyword = event.target.value
                  setProductKeyword(nextKeyword)
                  const matchedProduct = filteredProducts.find((product) => product.name === nextKeyword)
                  setSelectedProductId(matchedProduct?._id ?? '')
                }}
              />
              <datalist id="inventory-receipt-product-options">
                {filteredProducts.map((product) => (
                  <option value={product.name} key={product._id} />
                ))}
              </datalist>
            </label>
            <button
              className="admin-secondary-button"
              type="button"
              disabled={!filteredProducts.length}
              onClick={handleAddProduct}
            >
              + Thêm sản phẩm
            </button>
          </div>
        </section>
        <section className="admin-receipt-summary-card" aria-label="Tổng kết phiếu nhập">
          <article>
            <span>Số loại sản phẩm</span>
            <strong>{formatNumber(receiptSummary.productCount)}</strong>
          </article>
          <article>
            <span>Số biến thể màu</span>
            <strong>{formatNumber(receiptSummary.colorVariantCount)}</strong>
          </article>
          <article>
            <span>Tổng số lượng</span>
            <strong>{formatNumber(receiptSummary.totalQuantity)}</strong>
          </article>
          <article>
            <span>Tổng tiền hàng</span>
            <strong>{formatPrice(receiptSummary.totalAmount)}</strong>
          </article>
        </section>
        {receiptNotice ? (
          <p className={`admin-notice is-${receiptNotice.type} admin-receipt-form-notice`}>
            {receiptNotice.message}
          </p>
        ) : null}
        <footer>
          <button className="admin-secondary-button" type="button" onClick={onClose}>Đóng</button>
          <button
            className="admin-secondary-button"
            type="button"
            disabled={!canWrite || isReceiptSaving}
            onClick={() => void handleSaveReceipt('draft')}
          >
            {isEditingReceipt ? 'Cập nhật nháp' : 'Lưu nháp'}
          </button>
          <button
            className="admin-primary-button"
            type="button"
            disabled={!canWrite || isReceiptSaving || receiptSummary.totalQuantity < 1}
            onClick={() => void handleSaveReceipt('confirmed')}
          >
            Xác nhận phiếu
          </button>
        </footer>
      </form>
    </div>
  )
}
