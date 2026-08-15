import type { RefObject } from 'react'
import type { ManagedProduct, ProductColor } from '../product.types'
import {
  formatNumber,
  formatPrice,
  getDisplayPrice,
  getInventory,
  getInventoryStatus,
  isProductSelling,
  getStockMeta,
} from '../productDisplay.helpers'
import {
  ChevronIcon,
  DeleteIcon,
  EditIcon,
  StockDetailIcon,
  ViewIcon,
} from './ProductIcons'
import { StockWarning } from './ProductStatusIndicators'

type ProductTableProps = {
  products: ManagedProduct[]
  isLoading: boolean
  canWrite: boolean
  expandedProducts: Set<string>
  expandedVariants: Set<string>
  loadingEditorProductId: string | null
  lowStockThreshold: number
  tableShellRef: RefObject<HTMLDivElement | null>
  onToggleProduct: (productId: string) => void
  onToggleVariant: (variantKey: string) => void
  onViewProduct: (product: ManagedProduct) => void
  onEditProduct: (product: ManagedProduct) => void
  onDeleteProduct: (product: ManagedProduct) => void
  onViewQuantity: (detail: {
    productName: string
    fitTypeLabel: string
    color: ProductColor
    isActive: boolean
  }) => void
}

export function ProductTable({
  products,
  isLoading,
  canWrite,
  expandedProducts,
  expandedVariants,
  loadingEditorProductId,
  lowStockThreshold,
  tableShellRef,
  onToggleProduct,
  onToggleVariant,
  onViewProduct,
  onEditProduct,
  onDeleteProduct,
  onViewQuantity,
}: ProductTableProps) {
  return (
    <div className="admin-table-shell" ref={tableShellRef}>
      <table className="admin-table admin-products-table">
        <thead>
          <tr>
            <th>Sản phẩm</th>
            <th>Nhãn hiệu</th>
            <th>Loại trang phục</th>
            <th>Phom dáng</th>
            <th>Màu sắc</th>
            <th>Giá</th>
            <th>Tồn kho</th>
            <th>Cảnh báo hết hàng</th>
            <th>Trạng thái</th>
            <th>Hành động</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr><td colSpan={10}><div className="admin-table-loading">Đang tải sản phẩm...</div></td></tr>
          ) : null}
          {!isLoading && products.length === 0 ? (
            <tr><td colSpan={10}><div className="admin-table-loading">Không có sản phẩm phù hợp.</div></td></tr>
          ) : null}
          {!isLoading
            ? products.map((product) => {
                const inventory = getInventory(product)
                const stock = getStockMeta(inventory, lowStockThreshold)
                const colorCount = new Set(
                  product.variants.flatMap((variant) =>
                    variant.colors.map((color) => color.color.toLocaleLowerCase('vi')),
                  ),
                ).size
                const isExpanded = expandedProducts.has(product._id)
                const displayVariant = product.variants[0]
                const isEditorLoadingForProduct = loadingEditorProductId === product._id
                const isSelling = isProductSelling(product)

                return [
                  <tr className="admin-product-row" key={product._id}>
                    <td>
                      <button
                        className="admin-product-expand"
                        type="button"
                        aria-expanded={isExpanded}
                        onClick={() => onToggleProduct(product._id)}
                      >
                        <ChevronIcon expanded={isExpanded} />
                        <img src={product.productImage} alt="" />
                        <span>
                          <strong>{product.name}</strong>
                        </span>
                      </button>
                    </td>
                    <td><strong>{product.brandName || '-'}</strong></td>
                    <td>{product.categoryName || '-'}</td>
                    <td>
                      <div className="admin-product-fit-list">
                        {product.variants.map((variant) => (
                          <span key={variant._id}>{variant.fitTypeLabel}</span>
                        ))}
                      </div>
                    </td>
                    <td><strong>{colorCount}</strong></td>
                    <td>
                      {displayVariant ? (
                        <div className={`admin-product-main-price${displayVariant.discount > 0 ? ' has-discount' : ' no-discount'}`}>
                          <span>
                            <strong>
                              {formatPrice(
                                getDisplayPrice(displayVariant.price, displayVariant.discount),
                              )}
                            </strong>
                            {displayVariant.discount > 0 ? (
                              <small>{formatPrice(displayVariant.price)}</small>
                            ) : null}
                          </span>
                          {displayVariant.discount > 0 ? (
                            <span className="admin-product-discount-slot">
                              <em>-{displayVariant.discount}%</em>
                            </span>
                          ) : null}
                        </div>
                      ) : '-'}
                    </td>
                    <td><strong>{formatNumber(stock.total)}</strong></td>
                    <td><StockWarning low={stock.low} out={stock.out} /></td>
                    <td>
                      <span className={`admin-product-status ${isSelling ? 'is-active' : 'is-inactive'}`}>
                        {isSelling ? 'Đang bán' : 'Ngừng bán'}
                      </span>
                    </td>
                    <td>
                      <div className="admin-product-actions">
                        <button
                          className="admin-secondary-link"
                          type="button"
                          onClick={() => onViewProduct(product)}
                        >
                          <ViewIcon /> Xem
                        </button>
                        <button
                          className="admin-link-button"
                          type="button"
                          disabled={!canWrite || isEditorLoadingForProduct}
                          onClick={() => onEditProduct(product)}
                        >
                          <EditIcon /> {isEditorLoadingForProduct ? 'Đang tải...' : 'Sửa'}
                        </button>
                        <button
                          className="admin-danger-link"
                          type="button"
                          disabled={!canWrite}
                          onClick={() => onDeleteProduct(product)}
                        >
                          <DeleteIcon /> Xóa
                        </button>
                      </div>
                    </td>
                  </tr>,
                  ...(isExpanded
                    ? product.variants.flatMap((variant) => {
                        const variantKey = `${product._id}:${variant._id}`
                        const isVariantExpanded = expandedVariants.has(variantKey)

                        return [
                          <tr className="admin-product-variant-row" key={variantKey}>
                            <td colSpan={10}>
                              <button
                                className="admin-variant-expand"
                                type="button"
                                aria-expanded={isVariantExpanded}
                                onClick={() => onToggleVariant(variantKey)}
                              >
                                <ChevronIcon expanded={isVariantExpanded} />
                                <span className="admin-tree-level-label is-fit">Phom dáng</span>
                                <strong>{variant.fitTypeLabel}</strong>
                              </button>
                            </td>
                          </tr>,
                          ...(isVariantExpanded
                            ? [
                                <tr className="admin-variant-block-row" key={`${variantKey}:options`}>
                                  <td colSpan={10}>
                                    <div className="admin-variant-block-list">
                                      {variant.colors.map((color) => {
                                        const stock = getStockMeta(color.inventory, lowStockThreshold)
                                        const status = getInventoryStatus(
                                          color.inventory,
                                          variant.isActive && color.isActive,
                                          lowStockThreshold,
                                        )

                                        return (
                                          <article className="admin-variant-block" key={`${variantKey}:${color._id}`}>
                                            <div className="admin-option-name">
                                              <img src={color.image} alt="" />
                                              <strong>{color.color}</strong>
                                            </div>
                                            <div className="admin-variant-block-field">
                                              <span>Màu sắc</span>
                                              <span className="admin-option-color">
                                                <span className="admin-color-swatch" style={{ backgroundColor: color.colorCode }} />
                                                <strong>{color.color}</strong>
                                              </span>
                                            </div>
                                            <div className="admin-variant-block-field">
                                              <span>Số lượng</span>
                                              <span className="admin-stock-total">
                                                <strong>{formatNumber(stock.total)}</strong>
                                                <button
                                                  type="button"
                                                  aria-label={`Xem số lượng theo size của ${color.color}`}
                                                  onClick={() =>
                                                    onViewQuantity({
                                                      productName: product.name,
                                                      fitTypeLabel: variant.fitTypeLabel,
                                                      color,
                                                      isActive: variant.isActive && color.isActive,
                                                    })
                                                  }
                                                >
                                                  <StockDetailIcon />
                                                </button>
                                              </span>
                                            </div>
                                            <div className="admin-variant-block-field">
                                              <span>Cảnh báo</span>
                                              <StockWarning low={stock.low} out={stock.out} />
                                            </div>
                                            <div className="admin-variant-block-field">
                                              <span>Trạng thái kho</span>
                                              <span className={`admin-inventory-status ${status.className}`}>
                                                {status.label}
                                              </span>
                                            </div>
                                          </article>
                                        )
                                      })}
                                    </div>
                                  </td>
                                </tr>,
                              ]
                            : []),
                        ]
                      })
                    : []),
                ]
              })
            : null}
        </tbody>
      </table>
    </div>
  )
}
