import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AdminUser } from '../../auth/adminSession'
import {
  createManagedProduct,
  deleteManagedProduct,
  getManagedProductDetail,
  listManagedProducts,
  permanentlyDeleteManagedProduct,
  updateManagedProduct,
} from './product.service'
import type {
  CreateProductInput,
  ManagedProduct,
  ProductColor,
  ProductDetailResponse,
  ProductImageFileInput,
} from './product.types'
import { ProductCreateDialog } from './components/ProductCreateDialog'
import { getPaginationItems } from '../../../utils/pagination'
import './product.css'

type ProductManagementPageProps = {
  currentUser: AdminUser
}

type QuantityDetail = {
  productName: string
  fitTypeLabel: string
  color: ProductColor
  isActive: boolean
} | null

type Notice = {
  type: 'success' | 'error'
  message: string
} | null

type ProductActiveFilter = 'all' | 'active' | 'inactive'
type ProductStockFilter = 'all' | 'available' | 'low' | 'out'

const pageSize = 20
const lowStockPercentage = 0.15
const formatNumber = (value: number) => value.toLocaleString('vi-VN')
const formatPrice = (value: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)

const getInventory = (product: ManagedProduct) =>
  product.variants.flatMap((variant) =>
    variant.colors.flatMap((color) => color.inventory),
  )

const getDisplayPrice = (price: number, discount: number) =>
  discount > 0 ? Math.round(price * (1 - discount / 100)) : price

const getStockMeta = (items: Array<{ availableQuantity: number }>) => {
  const total = items.reduce((sum, item) => sum + item.availableQuantity, 0)
  const avg = items.length ? total / items.length : 0
  const threshold = avg * lowStockPercentage
  return {
    total,
    low: items.filter(
      (item) => item.availableQuantity > 0 && item.availableQuantity <= threshold,
    ).length,
    out: items.filter((item) => item.availableQuantity === 0).length,
  }
}

const getInventoryStatus = (
  items: Array<{ availableQuantity: number }>,
  isActive: boolean,
) => {
  if (!isActive) return { label: 'Tạm ẩn', className: 'is-inactive' }
  if (items.every((item) => item.availableQuantity === 0)) {
    return { label: 'Hết hàng', className: 'is-out' }
  }
  const total = items.reduce((sum, item) => sum + item.availableQuantity, 0)
  const avg = items.length ? total / items.length : 0
  const threshold = avg * lowStockPercentage
  if (items.every((item) => item.availableQuantity > 0 && item.availableQuantity <= threshold)) {
    return { label: 'Sắp hết', className: 'is-low' }
  }
  return { label: 'Còn hàng', className: 'is-available' }
}

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Không thể tải danh sách sản phẩm'

function StockWarning({ low, out }: { low: number; out: number }) {
  if (!low && !out) return <span className="admin-product-stock-ok">Đủ hàng</span>

  return (
    <span className="admin-product-warning">
      {low ? <strong>{low} sắp hết</strong> : null}
      {low && out ? <i aria-hidden="true">·</i> : null}
      {out ? <strong className="is-out">{out} hết hàng</strong> : null}
    </span>
  )
}

export function ProductManagementPage({ currentUser }: ProductManagementPageProps) {
  const tableShellRef = useRef<HTMLDivElement>(null)
  const stickyScrollbarRef = useRef<HTMLDivElement>(null)
  const stickyScrollbarContentRef = useRef<HTMLDivElement>(null)
  const [products, setProducts] = useState<ManagedProduct[]>([])
  const [keyword, setKeyword] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [brandFilter, setBrandFilter] = useState('all')
  const [fitTypeFilter, setFitTypeFilter] = useState('all')
  const [activeFilter, setActiveFilter] = useState<ProductActiveFilter>('all')
  const [stockFilter, setStockFilter] = useState<ProductStockFilter>('all')
  const [page, setPage] = useState(1)
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set())
  const [expandedVariants, setExpandedVariants] = useState<Set<string>>(new Set())
  const [quantityDetail, setQuantityDetail] = useState<QuantityDetail>(null)
  const [editingProduct, setEditingProduct] = useState<ProductDetailResponse | null>(null)
  const [viewingProduct, setViewingProduct] = useState<ManagedProduct | null>(null)
  const [deletingProduct, setDeletingProduct] = useState<ManagedProduct | null>(null)
  const [isCreatingProduct, setIsCreatingProduct] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingEditor, setIsLoadingEditor] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (notice?.type !== 'success') return

    const timeoutId = window.setTimeout(() => {
      setNotice(null)
    }, 4500)

    return () => window.clearTimeout(timeoutId)
  }, [notice])
  const canWrite =
    currentUser.role === 'admin' || currentUser.permissions?.includes('products.write') === true

  const loadProducts = useCallback(async () => {
    setIsLoading(true)
    setLoadError('')
    try {
      setProducts(await listManagedProducts())
    } catch (error) {
      setLoadError(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadProducts()
  }, [loadProducts])

  const stats = useMemo(() => {
    const inventory = products.flatMap(getInventory)
    const warningProductCount = products.filter((product) => {
      const meta = getStockMeta(getInventory(product))
      return meta.low > 0
    }).length

    return {
      total: products.length,
      sold: products.reduce((sum, product) => sum + product.soldQuantity, 0),
      stock: inventory.reduce((sum, item) => sum + item.availableQuantity, 0),
      warning: warningProductCount,
      inactive: products.filter((product) => !product.isActive).length,
    }
  }, [products])

  const filterOptions = useMemo(
    () => ({
      categories: [...new Set(products.map((product) => product.categoryName).filter(Boolean))].sort(),
      brands: [...new Set(products.map((product) => product.brandName).filter(Boolean))].sort(),
      fitTypes: [
        ...new Set(
          products.flatMap((product) =>
            product.variants.map((variant) => variant.fitTypeLabel).filter(Boolean),
          ),
        ),
      ].sort(),
    }),
    [products],
  )

  const pagination = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLocaleLowerCase('vi')
    const filtered = products.filter((product) => {
      const inventory = getInventory(product)
      const isOut = inventory.length > 0 && inventory.every((item) => item.availableQuantity === 0)
      const total = inventory.reduce((sum, item) => sum + item.availableQuantity, 0)
      const avg = inventory.length ? total / inventory.length : 0
      const threshold = avg * lowStockPercentage
      const isLowStatus = !isOut && inventory.length > 0 && inventory.every(
        (item) => item.availableQuantity > 0 && item.availableQuantity <= threshold,
      )
      const stockStatus = isOut ? 'out' : isLowStatus ? 'low' : 'available'
      const matchesKeyword =
        !normalizedKeyword ||
        [product.name, product.brandName, product.categoryName].some((value) =>
          value.toLocaleLowerCase('vi').includes(normalizedKeyword),
        )

      return (
        matchesKeyword &&
        (categoryFilter === 'all' || product.categoryName === categoryFilter) &&
        (brandFilter === 'all' || product.brandName === brandFilter) &&
        (fitTypeFilter === 'all' ||
          product.variants.some((variant) => variant.fitTypeLabel === fitTypeFilter)) &&
        (activeFilter === 'all' ||
          (activeFilter === 'active' ? product.isActive : !product.isActive)) &&
        (stockFilter === 'all' || stockStatus === stockFilter)
      )
    })
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
    const safePage = Math.min(page, totalPages)
    const startIndex = (safePage - 1) * pageSize

    return {
      items: filtered.slice(startIndex, startIndex + pageSize),
      totalItems: filtered.length,
      totalPages,
      safePage,
      start: filtered.length ? startIndex + 1 : 0,
      end: Math.min(startIndex + pageSize, filtered.length),
    }
  }, [
    activeFilter,
    brandFilter,
    categoryFilter,
    fitTypeFilter,
    keyword,
    page,
    products,
    stockFilter,
  ])

  useEffect(
    () => setPage(1),
    [activeFilter, brandFilter, categoryFilter, fitTypeFilter, keyword, stockFilter],
  )

  useEffect(() => {
    setExpandedProducts(new Set())
    setExpandedVariants(new Set())
  }, [
    activeFilter,
    brandFilter,
    categoryFilter,
    fitTypeFilter,
    keyword,
    pagination.safePage,
    stockFilter,
  ])

  useEffect(() => {
    if (page !== pagination.safePage) setPage(pagination.safePage)
  }, [page, pagination.safePage])

  useEffect(() => {
    const tableShell = tableShellRef.current
    const stickyScrollbar = stickyScrollbarRef.current
    const stickyScrollbarContent = stickyScrollbarContentRef.current
    if (!tableShell || !stickyScrollbar || !stickyScrollbarContent) return

    let isSyncing = false

    const updateStickyScrollbar = () => {
      const rect = tableShell.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const hasHorizontalOverflow = tableShell.scrollWidth > tableShell.clientWidth
      const tableCrossesViewportBottom = rect.top < viewportHeight && rect.bottom > viewportHeight

      stickyScrollbar.hidden = !hasHorizontalOverflow || !tableCrossesViewportBottom
      stickyScrollbar.style.left = `${Math.max(0, rect.left)}px`
      stickyScrollbar.style.width = `${Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(0, rect.left))}px`
      stickyScrollbarContent.style.width = `${tableShell.scrollWidth}px`
      stickyScrollbar.scrollLeft = tableShell.scrollLeft
    }

    const syncScroll = (source: HTMLDivElement, target: HTMLDivElement) => {
      if (isSyncing) return
      isSyncing = true
      target.scrollLeft = source.scrollLeft
      window.requestAnimationFrame(() => {
        isSyncing = false
      })
    }

    const handleTableScroll = () => syncScroll(tableShell, stickyScrollbar)
    const handleStickyScroll = () => syncScroll(stickyScrollbar, tableShell)
    const resizeObserver = new ResizeObserver(updateStickyScrollbar)
    const contentScroller = tableShell.closest('.admin-content')

    tableShell.addEventListener('scroll', handleTableScroll)
    stickyScrollbar.addEventListener('scroll', handleStickyScroll)
    window.addEventListener('resize', updateStickyScrollbar)
    window.addEventListener('scroll', updateStickyScrollbar)
    contentScroller?.addEventListener('scroll', updateStickyScrollbar)
    resizeObserver.observe(tableShell)
    resizeObserver.observe(tableShell.firstElementChild ?? tableShell)
    updateStickyScrollbar()

    return () => {
      tableShell.removeEventListener('scroll', handleTableScroll)
      stickyScrollbar.removeEventListener('scroll', handleStickyScroll)
      window.removeEventListener('resize', updateStickyScrollbar)
      window.removeEventListener('scroll', updateStickyScrollbar)
      contentScroller?.removeEventListener('scroll', updateStickyScrollbar)
      resizeObserver.disconnect()
    }
  }, [loadError, pagination.items.length])

  const toggleExpanded = (
    id: string,
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
  ) => {
    setter((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleOpenEditor = async (product: ManagedProduct) => {
    setIsLoadingEditor(true)
    setNotice(null)
    try {
      setEditingProduct(await getManagedProductDetail(product._id))
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setIsLoadingEditor(false)
    }
  }

  const handleUpdateProduct = async (
    input: CreateProductInput,
    productImageFile?: File | null,
    colorImageFiles?: ProductImageFileInput[],
  ) => {
    if (!editingProduct) return
    setIsSaving(true)
    setNotice(null)
    try {
      await updateManagedProduct(editingProduct._id, input, productImageFile, colorImageFiles)
      setEditingProduct(null)
      setNotice({ type: 'success', message: 'Thông tin sản phẩm đã được cập nhật.' })
      await loadProducts()
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteProduct = async (mode: 'pause' | 'permanent') => {
    if (!deletingProduct) return
    setIsSaving(true)
    setNotice(null)
    try {
      if (mode === 'permanent') {
        await permanentlyDeleteManagedProduct(deletingProduct._id)
        setNotice({ type: 'success', message: 'Sản phẩm đã được gỡ khỏi danh sách quản lý.' })
      } else {
        await deleteManagedProduct(deletingProduct._id)
        setNotice({ type: 'success', message: 'Sản phẩm đã ngừng hiển thị trên cửa hàng.' })
      }
      setDeletingProduct(null)
      await loadProducts()
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setIsSaving(false)
    }
  }

  const handleCreateProduct = async (
    input: CreateProductInput,
    productImageFile?: File | null,
    colorImageFiles?: ProductImageFileInput[],
  ) => {
    setIsSaving(true)
    setNotice(null)
    try {
      await createManagedProduct(input, productImageFile, colorImageFiles)
      setIsCreatingProduct(false)
      setNotice({ type: 'success', message: 'Sản phẩm mới đã sẵn sàng để bán.' })
      await loadProducts()
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="admin-products-page" aria-busy={isLoading}>
      <header className="admin-page-heading">
        <div>
          <h1>Quản lý sản phẩm</h1>
          <span className="admin-product-heading-copy">
            Quản lý thông tin và trạng thái sản phẩm.
          </span>
        </div>
        <button
          className="admin-primary-button"
          type="button"
          disabled={!canWrite}
          onClick={() => {
            setNotice(null)
            setIsCreatingProduct(true)
          }}
        >
          + Thêm sản phẩm
        </button>
      </header>

      <div className="admin-product-stats" aria-label="Thống kê sản phẩm">
        {[
          ['Tổng sản phẩm', stats.total, 'is-total'],
          ['Đã bán', stats.sold, 'is-sold'],
          ['Tồn kho', stats.stock, 'is-stock'],
          ['Sắp hết hàng', stats.warning, 'is-warning'],
          ['Ngừng bán', stats.inactive, 'is-inactive'],
        ].map(([label, value, className]) => (
          <div className={String(className)} key={String(label)}>
            <span>{label}</span>
            <strong>{formatNumber(Number(value))}</strong>
          </div>
        ))}
      </div>

      <div className="admin-product-toolbar">
        <label className="admin-product-search">
          <SearchIcon />
          <input
            type="search"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Tìm kiếm sản phẩm..."
            aria-label="Tìm kiếm sản phẩm"
          />
        </label>
        <div className="admin-product-filter-grid">
          <ProductFilterSelect label="Danh mục" value={categoryFilter} options={filterOptions.categories} onChange={setCategoryFilter} />
          <ProductFilterSelect label="Thương hiệu" value={brandFilter} options={filterOptions.brands} onChange={setBrandFilter} />
          <ProductFilterSelect label="Fit type" value={fitTypeFilter} options={filterOptions.fitTypes} onChange={setFitTypeFilter} />
          <select value={activeFilter} onChange={(event) => setActiveFilter(event.target.value as ProductActiveFilter)} aria-label="Trạng thái bán">
            <option value="all">Trạng thái bán</option>
            <option value="active">Đang bán</option>
            <option value="inactive">Ngừng bán</option>
          </select>
          <select value={stockFilter} onChange={(event) => setStockFilter(event.target.value as ProductStockFilter)} aria-label="Trạng thái kho">
            <option value="all">Trạng thái kho</option>
            <option value="available">Còn hàng</option>
            <option value="low">Sắp hết</option>
            <option value="out">Hết hàng</option>
          </select>
          <button
            className="admin-secondary-button"
            type="button"
            onClick={() => {
              setKeyword('')
              setCategoryFilter('all')
              setBrandFilter('all')
              setFitTypeFilter('all')
              setActiveFilter('all')
              setStockFilter('all')
            }}
          >
            Đặt lại
          </button>
        </div>
      </div>

      {loadError ? (
        <div className="admin-empty-state" role="alert">
          <strong>Không tải được sản phẩm</strong>
          <span>{loadError}</span>
          <button className="admin-secondary-button" type="button" onClick={() => void loadProducts()}>
            Thử lại
          </button>
        </div>
      ) : (
        <>
          {notice ? (
            <div className="admin-toast-container" aria-live="polite" aria-atomic="true">
              <div className={`admin-toast is-${notice.type}`}>
                <span>{notice.message}</span>
                <button
                  type="button"
                  className="admin-toast-close"
                  onClick={() => setNotice(null)}
                  aria-label="Đóng thông báo"
                >
                  ×
                </button>
              </div>
            </div>
          ) : null}
          <div className="admin-table-shell" ref={tableShellRef}>
          <table className="admin-table admin-products-table">
            <thead>
              <tr>
                <th>Sản phẩm</th>
                <th>Nhãn hiệu</th>
                <th>Loại trang phục</th>
                <th>Form dáng</th>
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
              {!isLoading && pagination.items.length === 0 ? (
                <tr><td colSpan={10}><div className="admin-table-loading">Không có sản phẩm phù hợp.</div></td></tr>
              ) : null}
              {!isLoading
                ? pagination.items.map((product) => {
                    const inventory = getInventory(product)
                    const stock = getStockMeta(inventory)
                    const colorCount = new Set(
                      product.variants.flatMap((variant) =>
                        variant.colors.map((color) => color.color.toLocaleLowerCase('vi')),
                      ),
                    ).size
                    const isExpanded = expandedProducts.has(product._id)
                    const displayVariant = product.variants[0]

                    return [
                      <tr className="admin-product-row" key={product._id}>
                        <td>
                          <button
                            className="admin-product-expand"
                            type="button"
                            aria-expanded={isExpanded}
                            onClick={() => toggleExpanded(product._id, setExpandedProducts)}
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
                          <span className={`admin-product-status ${product.isActive ? 'is-active' : 'is-inactive'}`}>
                            {product.isActive ? 'Đang bán' : 'Ngừng bán'}
                          </span>
                        </td>
                        <td>
                          <div className="admin-product-actions">
                            <button
                              className="admin-secondary-link"
                              type="button"
                              onClick={() => setViewingProduct(product)}
                            >
                              <ViewIcon /> Xem
                            </button>
                            <button
                              className="admin-link-button"
                              type="button"
                              disabled={!canWrite || isLoadingEditor}
                              onClick={() => void handleOpenEditor(product)}
                            >
                              <EditIcon /> {isLoadingEditor ? 'Đang tải...' : 'Sửa'}
                            </button>
                            <button
                              className="admin-danger-link"
                              type="button"
                              disabled={!canWrite}
                              onClick={() => setDeletingProduct(product)}
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
                                    onClick={() => toggleExpanded(variantKey, setExpandedVariants)}
                                  >
                                    <ChevronIcon expanded={isVariantExpanded} />
                                    <span className="admin-tree-level-label is-fit">Form dáng</span>
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
                                                const stock = getStockMeta(color.inventory)
                                                const status = getInventoryStatus(
                                                  color.inventory,
                                                  variant.isActive,
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
                                                            setQuantityDetail({
                                                              productName: product.name,
                                                              fitTypeLabel: variant.fitTypeLabel,
                                                              color,
                                                              isActive: variant.isActive,
                                                            })
                                                          }
                                                        >
                                                          <StockDetailIcon />
                                                        </button>
                                                      </span>
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
      </>)}

      <div
        className="admin-product-sticky-scrollbar"
        ref={stickyScrollbarRef}
        hidden
        aria-hidden="true"
      >
        <div ref={stickyScrollbarContentRef} />
      </div>

      <footer className="admin-table-footer admin-product-pagination">
        <span>Hiển thị {pagination.start}–{pagination.end} / {pagination.totalItems}</span>
        <div>
          <button className="admin-secondary-button" type="button" disabled={pagination.safePage <= 1 || isLoading} onClick={() => setPage((value) => Math.max(1, value - 1))}>
            Trước
          </button>
          <div className="admin-page-numbers" aria-label="Phân trang sản phẩm">
            {getPaginationItems(pagination.totalPages, pagination.safePage).map((item) =>
              typeof item === 'number' ? (
                <button
                  className={`admin-page-button${item === pagination.safePage ? ' is-active' : ''}`}
                  type="button"
                  key={item}
                  aria-current={item === pagination.safePage ? 'page' : undefined}
                  disabled={isLoading}
                  onClick={() => setPage(item)}
                >
                  {item}
                </button>
              ) : (
                <span className="admin-page-ellipsis" key={item} aria-hidden="true">
                  ...
                </span>
              ),
            )}
          </div>
          <button className="admin-secondary-button" type="button" disabled={pagination.safePage >= pagination.totalPages || isLoading} onClick={() => setPage((value) => Math.min(pagination.totalPages, value + 1))}>
            Sau
          </button>
        </div>
      </footer>

      {quantityDetail ? (
        <QuantityDetailDialog
          detail={quantityDetail}
          onClose={() => setQuantityDetail(null)}
        />
      ) : null}

      {isCreatingProduct ? (
        <ProductCreateDialog
          isSaving={isSaving}
          errorMessage={notice?.type === 'error' ? notice.message : ''}
          onClose={() => setIsCreatingProduct(false)}
          onSave={handleCreateProduct}
        />
      ) : null}

      {editingProduct ? (
        <ProductCreateDialog
          product={editingProduct}
          isSaving={isSaving}
          onClose={() => setEditingProduct(null)}
          errorMessage={notice?.type === 'error' ? notice.message : ''}
          onSave={handleUpdateProduct}
        />
      ) : null}

      {viewingProduct ? (
        <ProductViewDialog product={viewingProduct} onClose={() => setViewingProduct(null)} />
      ) : null}

      {deletingProduct ? (
        <div className="admin-confirm-layer" role="dialog" aria-modal="true" aria-labelledby="delete-product-title">
          <div className="admin-confirm-box">
            <h2 id="delete-product-title">
              Xóa sản phẩm?
            </h2>
            <p>
              Nếu chỉ muốn ẩn “{deletingProduct.name}” khỏi cửa hàng, hãy chọn ngừng bán. Dữ
              liệu cũ vẫn được giữ lại để tra cứu.
            </p>
            <p className="admin-delete-warning">
              Chỉ xóa vĩnh viễn khi đây là sản phẩm tạo nhầm hoặc chưa từng phát sinh đơn hàng,
              tồn kho, phiếu nhập, giỏ hàng, khuyến mãi, yêu thích hay đánh giá.
            </p>
            {!deletingProduct.canDeletePermanently ? (
              <p className="admin-delete-blocked">
                {deletingProduct.permanentDeleteBlockReason ??
                  'Chưa thể xóa vĩnh viễn sản phẩm này vì đã có dữ liệu liên quan.'}
              </p>
            ) : null}
            <div>
              <button className="admin-secondary-button" type="button" disabled={isSaving} onClick={() => setDeletingProduct(null)}>Hủy</button>
              <button
                className="admin-secondary-button"
                type="button"
                disabled={isSaving || !deletingProduct.isActive}
                onClick={() => void handleDeleteProduct('pause')}
              >
                {isSaving ? 'Đang xử lý...' : 'Ngừng bán'}
              </button>
              <button
                className="admin-danger-button"
                type="button"
                disabled={isSaving || !deletingProduct.canDeletePermanently}
                onClick={() => void handleDeleteProduct('permanent')}
              >
                {isSaving ? 'Đang xử lý...' : 'Xóa vĩnh viễn'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function ProductFilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={label}>
      <option value="all">{label}</option>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  )
}

function ProductViewDialog({
  product,
  onClose,
}: {
  product: ManagedProduct
  onClose: () => void
}) {
  const inventory = getInventory(product)
  const stock = getStockMeta(inventory)
  const colorCount = new Set(
    product.variants.flatMap((variant) => variant.colors.map((color) => color.color.toLocaleLowerCase('vi'))),
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
            <div><dt>Form dáng</dt><dd>{product.variants.map((variant) => variant.fitTypeLabel).join(', ') || '-'}</dd></div>
            <div><dt>Màu sắc</dt><dd>{colorCount}</dd></div>
            <div><dt>Đã bán</dt><dd>{formatNumber(product.soldQuantity)}</dd></div>
            <div><dt>Tồn kho</dt><dd>{formatNumber(stock.total)}</dd></div>
            <div><dt>Cảnh báo</dt><dd><StockWarning low={stock.low} out={stock.out} /></dd></div>
            <div><dt>Trạng thái</dt><dd>{product.isActive ? 'Đang bán' : 'Ngừng bán'}</dd></div>
          </dl>
        </div>
      </section>
    </div>
  )
}

function QuantityDetailDialog({
  detail,
  onClose,
}: {
  detail: Exclude<QuantityDetail, null>
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
                <th>SKU</th>
                <th>Số lượng</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {detail.color.inventory.map((item) => {
                const status = getInventoryStatus([item], detail.isActive)
                return (
                  <tr key={`${detail.color._id}:${item.size}`}>
                    <td><strong>{item.size}</strong></td>
                    <td>{item.sku || '-'}</td>
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
          <span className="admin-inventory-status is-low">Sắp hết</span>
          <span className="admin-inventory-status is-out">Hết hàng</span>
          <span className="admin-inventory-status is-inactive">Tạm ẩn</span>
        </footer>
      </section>
    </div>
  )
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg className={expanded ? 'is-expanded' : ''} viewBox="0 0 24 24" aria-hidden="true">
      <path d="m9 5 7 7-7 7" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m21 20-4.6-4.6a7 7 0 1 0-1.4 1.4l4.6 4.6L21 20ZM5 10.5a5.5 5.5 0 1 1 11 0 5.5 5.5 0 0 1-11 0Z" />
    </svg>
  )
}

function StockDetailIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 5h16v14H4V5Zm2 2v3h5V7H6Zm7 0v3h5V7h-5Zm-7 5v5h5v-5H6Zm7 0v5h5v-5h-5Z" />
    </svg>
  )
}

function EditIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="admin-action-icon"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25ZM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z" /></svg>
}

function ViewIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="admin-action-icon"><path d="M12 5C6.5 5 2 9 1 12c1 3 5.5 7 11 7s10-4 11-7c-1-3-5.5-7-11-7Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm0-2a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" /></svg>
}

function DeleteIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="admin-action-icon"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12Zm3-9h6v8H9v-8Zm6.5-6-1-1h-5l-1 1H5v2h14V4h-3.5Z" /></svg>
}
