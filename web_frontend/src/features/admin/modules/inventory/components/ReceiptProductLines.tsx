import {
  useMemo,
  type CSSProperties,
} from 'react'
import type { ManagedProduct } from '../../catalog/products/product.types'
import type {
  ReceiptProductEntry,
  ReceiptProductLine,
} from '../inventory.view-types'
import {
  formatNumber,
  formatPrice,
} from '../inventory.utils'

export function ReceiptProductBlock({
  entry,
  onRemove,
  onRemoveLine,
  onUpdateLine,
  setProductRef,
}: {
  entry: ReceiptProductEntry
  onRemove: (productId: string) => void
  onRemoveLine: (productId: string, lineId: string) => void
  onUpdateLine: (
    productId: string,
    lineId: string,
    updater: (line: ReceiptProductLine) => ReceiptProductLine,
  ) => void
  setProductRef: (element: HTMLElement | null) => void
}) {
  const { product } = entry
  // Lấy đủ các size của sản phẩm để mỗi khối nhập hàng có đủ cột size cần dùng.
  const sizeOptions = useMemo(
    () => [
      ...new Set(
        product.variants.flatMap((variant) =>
          variant.colors.flatMap((color) => color.inventory.map((item) => item.size)),
        ),
      ),
    ],
    [product],
  )

  return (
    <article className="admin-receipt-product-block" ref={setProductRef}>
      <header className="admin-receipt-product-summary">
        <div className="admin-receipt-product-identity">
          <img src={product.productImage} alt="" />
          <div>
            <strong>{product.name}</strong>
            <span>{product.categoryName || '-'}</span>
          </div>
        </div>
        <button className="admin-danger-link" type="button" onClick={() => onRemove(product._id)}>
          Xóa
        </button>
      </header>
      <div className="admin-receipt-lines-shell">
        <div
          className="admin-receipt-lines-grid"
          style={{ '--receipt-size-count': Math.max(4, sizeOptions.length) } as CSSProperties}
        >
          <div className="admin-receipt-lines-head">
            <span>Ảnh</span>
            <span>Phom dáng</span>
            <span>Màu sắc</span>
            {sizeOptions.map((size) => (
              <span className="admin-receipt-size-heading" key={size}>Size {size}</span>
            ))}
            <span>Đơn giá</span>
            <span>Tổng SL</span>
            <span>Thành tiền</span>
            <span>Xóa</span>
          </div>
          {entry.lines.map((line) => (
            <ReceiptProductLineRow
              key={line.id}
              line={line}
              product={product}
              sizeOptions={sizeOptions}
              onRemove={() => onRemoveLine(product._id, line.id)}
              onChange={(updater) => onUpdateLine(product._id, line.id, updater)}
            />
          ))}
        </div>
      </div>
    </article>
  )
}

function ReceiptProductLineRow({
  line,
  product,
  sizeOptions,
  onRemove,
  onChange,
}: {
  line: ReceiptProductLine
  product: ManagedProduct
  sizeOptions: string[]
  onRemove: () => void
  onChange: (updater: (line: ReceiptProductLine) => ReceiptProductLine) => void
}) {
  const selectedVariant = product.variants.find((variant) => variant._id === line.variantId)
  const selectedColor = selectedVariant?.colors.find((color) => color._id === line.colorVariantId)
  const isActive = Boolean(selectedVariant && selectedColor)
  const totalQuantity = sizeOptions.reduce(
    (sum, size) => sum + (Number.parseInt(line.quantities[size] ?? '0', 10) || 0),
    0,
  )
  const unitPrice = Number(line.unitPrice) || 0
  const totalAmount = totalQuantity * unitPrice

  // Khi rê chuột lên ô size, admin thấy tồn hiện tại của màu đang chọn.
  const getAvailableQuantity = (size: string) =>
    selectedColor?.inventory.find((item) => item.size === size)?.availableQuantity ?? 0

  return (
    <div className={`admin-receipt-line-row${isActive ? ' is-active' : ''}`}>
      <div className="admin-receipt-line-thumbnail">
        {selectedColor ? <img src={selectedColor.image || product.productImage} alt="" /> : <span />}
      </div>
      <select
        value={line.variantId}
        aria-label="Phom dáng"
        onChange={(event) =>
          onChange((current) => ({
            ...current,
            variantId: event.target.value,
            colorVariantId: '',
            quantities: {},
            unitPrice: '',
          }))
        }
      >
        <option value="">Chọn phom dáng</option>
        {product.variants.map((variant) => (
          <option value={variant._id} key={variant._id}>
            {variant.fitTypeLabel}
          </option>
        ))}
      </select>
      <select
        value={line.colorVariantId}
        aria-label="Màu sắc"
        disabled={!selectedVariant}
        onChange={(event) =>
          onChange((current) => ({
            ...current,
            colorVariantId: event.target.value,
            quantities: {},
          }))
        }
      >
        <option value="">Chọn màu</option>
        {selectedVariant?.colors.map((color) => (
          <option value={color._id} key={color._id}>
            {color.color}
          </option>
        ))}
      </select>
      {sizeOptions.map((size) => (
        <input
          type="number"
          min={0}
          step={1}
          key={size}
          disabled={!isActive}
          value={line.quantities[size] ?? ''}
          title={isActive ? `Tồn hiện tại size ${size}: ${formatNumber(getAvailableQuantity(size))}` : 'Chọn phom dáng và màu sắc trước'}
          aria-label={`Số lượng nhập size ${size}`}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              quantities: {
                ...current.quantities,
                [size]: event.target.value
                  ? String(Math.max(0, Number.parseInt(event.target.value, 10) || 0))
                  : '',
              },
            }))
          }
        />
      ))}
      <input
        type="number"
        min={0}
        step={1000}
        disabled={!isActive}
        value={line.unitPrice}
        placeholder="0"
        aria-label="Đơn giá"
        onChange={(event) =>
          onChange((current) => ({
            ...current,
            unitPrice: event.target.value
              ? String(Math.max(0, Number.parseInt(event.target.value, 10) || 0))
              : '',
          }))
        }
      />
      <input type="text" disabled value={formatNumber(totalQuantity)} aria-label="Tổng số lượng" />
      <input type="text" disabled value={formatPrice(totalAmount)} aria-label="Thành tiền" />
      <button className="admin-danger-link" type="button" onClick={onRemove}>
        Xóa
      </button>
    </div>
  )
}
