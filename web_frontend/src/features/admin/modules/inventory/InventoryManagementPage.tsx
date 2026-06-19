import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import type { AdminUser } from '../auth/adminSession'
import { listManagedProducts } from '../catalog/products/product.service'
import type {
  ManagedProduct,
  ProductColor,
  ProductVariant,
} from '../catalog/products/product.types'
import {
  createInventoryImport,
  deleteInventoryImport,
  listInventoryImportsByColor,
  listInventory,
  listInventorySuppliers,
} from './inventory.service'
import type {
  CreateInventoryImportInput,
  InventoryImport,
  InventoryItem,
} from './inventory.types'
import { getPaginationItems } from '../../utils/pagination'
import './inventory.css'

type InventoryManagementPageProps = {
  currentUser: AdminUser
}

type StockStatus = 'all' | 'available' | 'low' | 'out'

type InventoryRow = InventoryItem & {
  product?: ManagedProduct
  variant?: ProductVariant
  color?: ProductColor
}

type InventoryProductGroup = {
  productId: string
  product?: ManagedProduct
  rows: InventoryRow[]
}

type InventoryColorGroup = {
  productId: string
  variantId: string
  colorVariantId: string
  product?: ManagedProduct
  variant?: ProductVariant
  color?: ProductColor
  rows: InventoryRow[]
}

type Notice = {
  type: 'success' | 'error'
  message: string
} | null

type ImportConfirmation = {
  input: CreateInventoryImportInput
  lines: string[]
} | null

const lowStockPercentage = 0.15
const pageSize = 10
const formatNumber = (value: number) => value.toLocaleString('vi-VN')
const formatPrice = (value: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)
const formatDate = (value: string) =>
  new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Không thể xử lý yêu cầu'

const getStatus = (quantity: number | Array<{ availableQuantity: number }>, total: number) => {
  let items: Array<{ availableQuantity: number }>
  if (typeof quantity === 'number') {
    items = [{ availableQuantity: quantity }]
  } else {
    items = quantity
  }

  const allZero = items.every((item) => item.availableQuantity === 0)
  if (allZero) return { id: 'out', label: 'Hết hàng', className: 'is-out' }
  const threshold = total * lowStockPercentage
  const allLow = items.length > 0 && items.every((item) => item.availableQuantity > 0 && item.availableQuantity <= threshold)
  if (allLow) {
    return { id: 'low', label: 'Sắp hết', className: 'is-low' }
  }
  return { id: 'available', label: 'Còn hàng', className: 'is-available' }
}

const getImportRemainingClass = (remainingQuantity: number, quantity: number) => {
  if (remainingQuantity === 0) return 'is-out'
  if (quantity > 0 && remainingQuantity / quantity <= 0.2) return 'is-low'
  return 'is-available'
}

export function InventoryManagementPage({
  currentUser,
}: InventoryManagementPageProps) {
  const tableShellRef = useRef<HTMLDivElement>(null)
  const stickyScrollbarRef = useRef<HTMLDivElement>(null)
  const stickyScrollbarContentRef = useRef<HTMLDivElement>(null)
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [products, setProducts] = useState<ManagedProduct[]>([])
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState('all')
  const [brand, setBrand] = useState('all')
  const [fitType, setFitType] = useState('all')
  const [status, setStatus] = useState<StockStatus>('all')
  const [page, setPage] = useState(1)
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set())
  const [expandedVariants, setExpandedVariants] = useState<Set<string>>(new Set())
  const [viewing, setViewing] = useState<InventoryColorGroup | null>(null)
  const [importHistory, setImportHistory] = useState<InventoryImport[]>([])
  const [supplierOptions, setSupplierOptions] = useState<string[]>([])
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [importing, setImporting] = useState<InventoryColorGroup | null>(null)
  const [notice, setNotice] = useState<Notice>(null)
  const [loadError, setLoadError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const canWrite =
    currentUser.role === 'admin' ||
    currentUser.permissions?.includes('inventory.write') === true

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setLoadError('')
    try {
      const [inventoryResult, productResult] = await Promise.all([
        listInventory(),
        listManagedProducts(),
      ])
      setInventory(inventoryResult.items)
      setProducts(productResult)
      void listInventorySuppliers()
        .then(setSupplierOptions)
        .catch(() => setSupplierOptions([]))
    } catch (error) {
      setLoadError(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (notice?.type !== 'success') return

    const timeoutId = window.setTimeout(() => {
      setNotice(null)
    }, 4500)

    return () => window.clearTimeout(timeoutId)
  }, [notice])

  const rows = useMemo<InventoryRow[]>(() => {
    const productById = new Map(products.map((product) => [product._id, product]))
    return inventory.map((item) => {
      const product = productById.get(item.productId)
      const variant = product?.variants.find((entry) => entry._id === item.variantId)
      const color = variant?.colors.find((entry) => entry._id === item.colorVariantId)
      return { ...item, product, variant, color }
    })
  }, [inventory, products])

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

  const stats = useMemo(
    () => {
      const total = inventory.reduce((sum, item) => sum + item.availableQuantity, 0)
      const avg = inventory.length ? total / inventory.length : 0
      const threshold = avg * lowStockPercentage
      return {
        total,
        low: inventory.filter(
          (item) =>
            item.availableQuantity > 0 &&
            item.availableQuantity <= threshold,
        ).length,
        out: inventory.filter((item) => item.availableQuantity === 0).length,
      }
    },
    [inventory],
  )

  const productTotals = useMemo(() => {
    const totals = new Map<string, { total: number; count: number }>()
    rows.forEach((row) => {
      const current = totals.get(row.productId) ?? { total: 0, count: 0 }
      totals.set(row.productId, { total: current.total + row.availableQuantity, count: current.count + 1 })
    })
    return totals
  }, [rows])

  const pagination = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLocaleLowerCase('vi')
    const groupsByProduct = new Map<string, InventoryProductGroup>()

    rows.forEach((row) => {
      const productEntry = productTotals.get(row.productId) ?? { total: 0, count: 1 }
      const productAvg = productEntry.count ? productEntry.total / productEntry.count : 0
      const rowStatus = getStatus(row.availableQuantity, productAvg).id
      const matchesKeyword =
        !normalizedKeyword ||
        [row.product?.name, row.sku, row.color?.color, row.size].some((value) =>
          value?.toLocaleLowerCase('vi').includes(normalizedKeyword),
        )
      const matchesFilters =
        matchesKeyword &&
        (category === 'all' || row.product?.categoryName === category) &&
        (brand === 'all' || row.product?.brandName === brand) &&
        (fitType === 'all' || row.variant?.fitTypeLabel === fitType) &&
        (status === 'all' || rowStatus === status)

      if (!matchesFilters) return

      const group = groupsByProduct.get(row.productId) ?? {
        productId: row.productId,
        product: row.product,
        rows: [],
      }
      group.rows.push(row)
      groupsByProduct.set(row.productId, group)
    })

    const filtered = [...groupsByProduct.values()]
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
  }, [brand, category, fitType, keyword, page, rows, status, productTotals])

  useEffect(() => setPage(1), [brand, category, fitType, keyword, status])

  useEffect(() => {
    setExpandedProducts(new Set())
    setExpandedVariants(new Set())
  }, [pagination.safePage, brand, category, fitType, keyword, status])

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
      const tableCrossesViewportBottom =
        rect.top < viewportHeight && rect.bottom > viewportHeight

      stickyScrollbar.hidden =
        !hasHorizontalOverflow || !tableCrossesViewportBottom
      stickyScrollbar.style.left = `${Math.max(0, rect.left)}px`
      stickyScrollbar.style.width = `${Math.max(
        0,
        Math.min(rect.right, window.innerWidth) - Math.max(0, rect.left),
      )}px`
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

  const resetFilters = () => {
    setKeyword('')
    setCategory('all')
    setBrand('all')
    setFitType('all')
    setStatus('all')
  }

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

  const handleCreateImport = async (input: CreateInventoryImportInput) => {
    setIsSaving(true)
    setNotice(null)
    try {
      await createInventoryImport(input)
      setImporting(null)
      setNotice({ type: 'success', message: 'Kho đã được cập nhật với phiếu nhập mới.' })
      await loadData()
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setIsSaving(false)
    }
  }

  const handleViewHistory = async (colorGroup: InventoryColorGroup) => {
    setViewing(colorGroup)
    setImportHistory([])
    setHistoryError('')
    setIsHistoryLoading(true)
    try {
      const result = await listInventoryImportsByColor(
        colorGroup.productId,
        colorGroup.variantId,
        colorGroup.colorVariantId,
      )
      setImportHistory(result.items)
    } catch (error) {
      setHistoryError(getErrorMessage(error))
    } finally {
      setIsHistoryLoading(false)
    }
  }

  const handleDeleteImport = async (importId: string) => {
    if (!viewing) return
    setIsSaving(true)
    setHistoryError('')

    try {
      await deleteInventoryImport(importId)
      const result = await listInventoryImportsByColor(
        viewing.productId,
        viewing.variantId,
        viewing.colorVariantId,
      )
      setImportHistory(result.items)
      setNotice({ type: 'success', message: 'Phiếu nhập đã được xóa và tồn kho đã được cập nhật.' })
      await loadData()
    } catch (error) {
      setHistoryError(getErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="admin-inventory-page" aria-busy={isLoading}>
      <header className="admin-page-heading admin-inventory-heading">
        <div>
          <h1>Quản lý kho hàng</h1>
          <span>Theo dõi số lượng tồn kho và cảnh báo thiếu hàng theo từng sản phẩm.</span>
        </div>
        <button className="admin-secondary-button" type="button" onClick={() => void loadData()}>
          Làm mới
        </button>
      </header>

      <div className="admin-inventory-stats">
        {[
          ['Tổng tồn kho', stats.total, 'is-total'],
          ['Mặt hàng sắp hết', stats.low, 'is-low'],
          ['Mặt hàng hết hàng', stats.out, 'is-out'],
        ].map(([label, value, className]) => (
          <article className={String(className)} key={String(label)}>
            <span>{label}</span>
            <strong>{formatNumber(Number(value))}</strong>
          </article>
        ))}
      </div>

      <section className="admin-inventory-toolbar">
        <label className="admin-inventory-search">
          <SearchIcon />
          <input
            type="search"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Tìm tên sản phẩm, SKU..."
          />
        </label>
        <div className="admin-inventory-filters">
          <FilterSelect value={category} onChange={setCategory} label="Danh mục" options={filterOptions.categories} />
          <FilterSelect value={brand} onChange={setBrand} label="Thương hiệu" options={filterOptions.brands} />
          <FilterSelect value={fitType} onChange={setFitType} label="Fit type" options={filterOptions.fitTypes} />
          <select value={status} onChange={(event) => setStatus(event.target.value as StockStatus)} aria-label="Trạng thái kho">
            <option value="all">Trạng thái kho</option>
            <option value="available">Còn hàng</option>
            <option value="low">Sắp hết</option>
            <option value="out">Hết hàng</option>
          </select>
          <button className="admin-secondary-button" type="button" onClick={resetFilters}>Đặt lại</button>
        </div>
        <div className="admin-inventory-tabs" aria-label="Lọc nhanh tồn kho">
          {[
            ['all', 'Tất cả'],
            ['available', 'Còn hàng'],
            ['low', 'Sắp hết'],
            ['out', 'Hết hàng'],
          ].map(([value, label]) => (
            <button
              className={status === value ? 'is-active' : ''}
              type="button"
              key={value}
              onClick={() => setStatus(value as StockStatus)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

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

      {loadError ? (
        <div className="admin-empty-state" role="alert">
          <strong>Không tải được dữ liệu kho</strong>
          <span>{loadError}</span>
          <button className="admin-secondary-button" type="button" onClick={() => void loadData()}>Thử lại</button>
        </div>
      ) : (
        <div className="admin-table-shell" ref={tableShellRef}>
          <table className="admin-table admin-inventory-table">
            <thead>
              <tr>
                <th>Sản phẩm</th>
                <th>Danh mục</th>
                <th>Thương hiệu</th>
                <th>Tồn kho hiện tại</th>
                <th>Cảnh báo hết hàng</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? <EmptyRow label="Đang tải dữ liệu kho..." /> : null}
              {!isLoading && pagination.items.length === 0 ? <EmptyRow label="Không có tồn kho phù hợp." /> : null}
              {!isLoading ? pagination.items.flatMap((group) => {
                const total = group.rows.reduce((sum, row) => sum + row.availableQuantity, 0)
                const groupAvg = group.rows.length ? total / group.rows.length : 0
                const threshold = groupAvg * lowStockPercentage
                const low = group.rows.filter((row) => row.availableQuantity > 0 && row.availableQuantity <= threshold).length
                const out = group.rows.filter((row) => row.availableQuantity === 0).length
                const productStatus = getStatus(group.rows, groupAvg)
                const isProductExpanded = expandedProducts.has(group.productId)
                const rowsByVariant = new Map<string, InventoryRow[]>()
                group.rows.forEach((row) => {
                  const variantRows = rowsByVariant.get(row.variantId) ?? []
                  variantRows.push(row)
                  rowsByVariant.set(row.variantId, variantRows)
                })

                return [
                  <tr className="admin-inventory-product-row" key={group.productId}>
                    <td>
                      <button
                        className="admin-inventory-product-expand"
                        type="button"
                        aria-expanded={isProductExpanded}
                        onClick={() => toggleExpanded(group.productId, setExpandedProducts)}
                      >
                        <ChevronIcon expanded={isProductExpanded} />
                        <img src={group.product?.productImage} alt="" />
                        <strong>{group.product?.name || 'Sản phẩm không xác định'}</strong>
                      </button>
                    </td>
                    <td>{group.product?.categoryName || '-'}</td>
                    <td><strong>{group.product?.brandName || '-'}</strong></td>
                    <td><strong>{formatNumber(total)}</strong></td>
                    <td>{low || out ? <span className={`admin-product-warning-copy${out ? ' is-out' : ''}`}><WarningIcon />{low ? `${low} sắp hết` : ''}{low && out ? ' · ' : ''}{out ? `${out} hết hàng` : ''}</span> : <span className="admin-stock-safe">Đủ hàng</span>}</td>
                    <td><span className={`admin-inventory-status ${productStatus.className}`}>{productStatus.label}</span></td>
                  </tr>,
                  ...(isProductExpanded
                    ? [...rowsByVariant.entries()].flatMap(([variantId, variantRows]) => {
                        const variantKey = `${group.productId}:${variantId}`
                        const isVariantExpanded = expandedVariants.has(variantKey)
                        const variantTotal = variantRows.reduce((sum, row) => sum + row.availableQuantity, 0)
                        const variantAvg = variantRows.length ? variantTotal / variantRows.length : 0
                        const variantThreshold = variantAvg * lowStockPercentage
                        const variantWarnings = variantRows.filter(
                          (row) => row.availableQuantity > 0 && row.availableQuantity <= variantThreshold,
                        )
                        const rowsByColor = new Map<string, InventoryColorGroup>()
                        variantRows.forEach((row) => {
                          const colorGroup = rowsByColor.get(row.colorVariantId) ?? {
                            productId: row.productId,
                            variantId: row.variantId,
                            colorVariantId: row.colorVariantId,
                            product: row.product,
                            variant: row.variant,
                            color: row.color,
                            rows: [],
                          }
                          colorGroup.rows.push(row)
                          rowsByColor.set(row.colorVariantId, colorGroup)
                        })
                        return [
                          <tr className="admin-inventory-fit-row" key={variantKey}>
                            <td colSpan={6}>
                              <button
                                type="button"
                                aria-expanded={isVariantExpanded}
                                onClick={() => toggleExpanded(variantKey, setExpandedVariants)}
                              >
                                <ChevronIcon expanded={isVariantExpanded} />
                                <span>Fit type</span>
                                <strong>{variantRows[0]?.variant?.fitTypeLabel || '-'}</strong>
                                {variantWarnings.length ? (
                                  <span className="admin-variant-warning">
                                    <WarningIcon />
                                    {variantWarnings.map((row) => `${row.color?.color} / ${row.size}`).join(', ')} đang thiếu hàng
                                  </span>
                                ) : null}
                                <small>{formatNumber(variantTotal)} sản phẩm</small>
                              </button>
                            </td>
                          </tr>,
                          ...(isVariantExpanded
                            ? [
                                <tr className="admin-inventory-color-block-row" key={`${variantKey}:colors`}>
                                  <td colSpan={6}>
                                    <div className="admin-inventory-color-block-list">
                                      {[...rowsByColor.values()].map((colorGroup) => {
                                const colorTotal = colorGroup.rows.reduce(
                                  (sum, row) => sum + row.availableQuantity,
                                  0,
                                )
                                const colorAvg = colorGroup.rows.length ? colorTotal / colorGroup.rows.length : 0
                                const threshold = colorAvg * lowStockPercentage
                                const lowRows = colorGroup.rows.filter(
                                  (row) =>
                                    row.availableQuantity > 0 &&
                                    row.availableQuantity <= threshold,
                                )
                                const outRows = colorGroup.rows.filter(
                                  (row) => row.availableQuantity === 0,
                                )
                                const colorStatus = getStatus(colorGroup.rows, colorAvg)
                                        return (
                                          <article className="admin-inventory-color-block" key={colorGroup.colorVariantId}>
                                            <div className="admin-option-name">
                                              <img src={colorGroup.color?.image} alt="" />
                                              <strong>{colorGroup.color?.color || '-'}</strong>
                                            </div>
                                            <div className="admin-inventory-color-block-field">
                                              <span>Màu sản phẩm</span>
                                              <strong>{colorGroup.color?.color || '-'}</strong>
                                            </div>
                                            <div className="admin-inventory-color-block-field">
                                              <span>Số size</span>
                                              <strong>{colorGroup.rows.length} size</strong>
                                            </div>
                                            <div className="admin-inventory-color-block-field">
                                              <span>Tồn kho</span>
                                              <strong>{formatNumber(colorTotal)}</strong>
                                            </div>
                                            <div className="admin-inventory-color-block-field">
                                              <span>Cảnh báo</span>
                                              {lowRows.length || outRows.length ? (
                                                <span className="admin-color-warning">
                                                  <WarningIcon />
                                                  <span>
                                                    {lowRows.length ? `Sắp hết: ${lowRows.map((row) => row.size).join(', ')}` : ''}
                                                    {lowRows.length && outRows.length ? ' · ' : ''}
                                                    {outRows.length ? `Hết: ${outRows.map((row) => row.size).join(', ')}` : ''}
                                                  </span>
                                                </span>
                                              ) : <span className="admin-stock-safe">Đủ hàng</span>}
                                            </div>
                                            <div className="admin-inventory-color-block-field">
                                              <span>Trạng thái</span>
                                              <span className={`admin-inventory-status ${colorStatus.className}`}>{colorStatus.label}</span>
                                            </div>
                                            <div className="admin-inventory-color-block-field">
                                              <span>Hành động</span>
                                              <div className="admin-inventory-actions">
                                                <button className="admin-secondary-link" type="button" onClick={() => void handleViewHistory(colorGroup)}><ViewIcon /> Xem</button>
                                                <button className="admin-link-button" type="button" disabled={!canWrite} onClick={() => setImporting(colorGroup)}>+ Nhập kho</button>
                                              </div>
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
              }) : null}
            </tbody>
          </table>
        </div>
      )}

      <div
        className="admin-inventory-sticky-scrollbar"
        ref={stickyScrollbarRef}
        hidden
        aria-hidden="true"
      >
        <div ref={stickyScrollbarContentRef} />
      </div>

      <footer className="admin-table-footer admin-inventory-pagination">
        <span>Hiển thị {pagination.start}–{pagination.end} / {pagination.totalItems}</span>
        <div>
          <button className="admin-secondary-button" type="button" disabled={pagination.safePage <= 1 || isLoading} onClick={() => setPage((value) => Math.max(1, value - 1))}>Trước</button>
          <div className="admin-page-numbers" aria-label="Phân trang kho hàng">
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
          <button className="admin-secondary-button" type="button" disabled={pagination.safePage >= pagination.totalPages || isLoading} onClick={() => setPage((value) => Math.min(pagination.totalPages, value + 1))}>Sau</button>
        </div>
      </footer>

      {viewing ? (
        <InventoryHistoryDialog
          group={viewing}
          imports={importHistory}
          isLoading={isHistoryLoading}
          errorMessage={historyError}
          isDeleting={isSaving}
          onDeleteImport={handleDeleteImport}
          onClose={() => setViewing(null)}
        />
      ) : null}
      {importing ? (
        <ImportDialog
          row={importing}
          supplierOptions={supplierOptions}
          isSaving={isSaving}
          errorMessage={notice?.type === 'error' ? notice.message : ''}
          onClose={() => setImporting(null)}
          onSave={handleCreateImport}
        />
      ) : null}
    </section>
  )
}

function FilterSelect({
  value,
  onChange,
  label,
  options,
}: {
  value: string
  onChange: (value: string) => void
  label: string
  options: string[]
}) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={label}>
      <option value="all">{label}</option>
      {options.map((option) => <option value={option} key={option}>{option}</option>)}
    </select>
  )
}

function EmptyRow({ label }: { label: string }) {
  return <tr><td colSpan={6}><div className="admin-table-loading">{label}</div></td></tr>
}

function ImportDialog({
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
                  placeholder="0"
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

function InventoryHistoryDialog({
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
  const total = group.rows.reduce((sum, row) => sum + row.availableQuantity, 0)
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
            <div><dt>Tổng có thể bán</dt><dd>{formatNumber(total)}</dd></div>
          </dl>
        </div>
        {pendingDeleteImport ? (
          <section className="admin-inventory-confirm-panel is-danger" role="alertdialog" aria-label="Xác nhận xóa phiếu nhập kho">
            <div>
              <strong>Xóa phiếu nhập kho này?</strong>
              <span>Mã phiếu: {pendingDeleteImport.importCode || pendingDeleteImport._id.slice(-8).toUpperCase()}</span>
              <span>Hệ thống sẽ trừ lại tồn kho theo lượng còn lại của phiếu nhập.</span>
            </div>
            <div>
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
                Xóa phiếu nhập
              </button>
            </div>
          </section>
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
                  disabled={isDeleting}
                  onClick={() => setPendingDeleteImport(item)}
                >
                  Xóa
                </button>
              </article>
            )
          }) : null}
        </div>
      </section>
    </div>
  )
}

function SearchIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21 20-4.6-4.6a7 7 0 1 0-1.4 1.4l4.6 4.6L21 20ZM5 10.5a5.5 5.5 0 1 1 11 0 5.5 5.5 0 0 1-11 0Z" /></svg>
}

function ViewIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="admin-action-icon"><path d="M12 5C6.5 5 2 9 1 12c1 3 5.5 7 11 7s10-4 11-7c-1-3-5.5-7-11-7Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z" /></svg>
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg className={expanded ? 'is-expanded' : ''} viewBox="0 0 24 24" aria-hidden="true">
      <path d="m9 5 7 7-7 7" />
    </svg>
  )
}

function WarningIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 1.8 21h20.4L12 3Zm-1 6h2v6h-2V9Zm0 8h2v2h-2v-2Z" />
    </svg>
  )
}
