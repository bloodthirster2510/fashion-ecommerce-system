import type { ManagedProduct } from '../product.types'
import {
  formatNumber,
  getInventory,
  isProductSelling,
  getStockMeta,
} from '../productDisplay.helpers'
import { StockWarning } from './ProductStatusIndicators'

export function ProductDetailsDialog({
  product,
  lowStockThreshold,
  onClose,
}: {
  product: ManagedProduct
  lowStockThreshold: number
  onClose: () => void
}) {
  const inventory = getInventory(product)
  const stock = getStockMeta(inventory, lowStockThreshold)
  const isSelling = isProductSelling(product)
  const colorCount = new Set(
    product.variants.flatMap((variant) =>
      variant.colors.map((color) => color.color.toLocaleLowerCase('vi')),
    ),
  ).size

  return (
    <div className="admin-quantity-dialog-layer" role="dialog" aria-modal="true" aria-labelledby="view-product-title">
      <button className="admin-quantity-dialog-backdrop" type="button" aria-label="Đóng" onClick={onClose} />
      <section className="admin-product-view-dialog">
        <header>
          <div>
            <span>Chi tiết sản phẩm</span>
            <h2 id="view-product-title">{product.name}</h2>
          </div>
          <button className="admin-secondary-button" type="button" onClick={onClose}>Đóng</button>
        </header>
        <div className="admin-product-view-content">
          <img src={product.productImage} alt={product.name} />
          <dl>
            <div><dt>Nhãn hiệu</dt><dd>{product.brandName || '-'}</dd></div>
            <div><dt>Loại trang phục</dt><dd>{product.categoryName || '-'}</dd></div>
            <div><dt>Phom dáng</dt><dd>{product.variants.map((variant) => variant.fitTypeLabel).join(', ') || '-'}</dd></div>
            <div><dt>Màu sắc</dt><dd>{colorCount}</dd></div>
            <div><dt>Đã bán</dt><dd>{formatNumber(product.soldQuantity)}</dd></div>
            <div><dt>Tồn kho</dt><dd>{formatNumber(stock.total)}</dd></div>
            <div><dt>Cảnh báo</dt><dd><StockWarning low={stock.low} out={stock.out} /></dd></div>
            <div><dt>Trạng thái</dt><dd>{isSelling ? 'Đang bán' : 'Ngừng bán'}</dd></div>
          </dl>
        </div>
      </section>
    </div>
  )
}
