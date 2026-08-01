import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query'
import type { AdminUser } from '../auth/adminSession'
import type { ManagedProduct } from '../catalog/products/product.types'
import {
  createInventoryImport,
  deleteInventoryImport,
  listInventoryImportsByColor,
  listInventory,
  listInventoryProducts,
  listInventoryReceipts,
  listInventorySuppliers,
} from './inventory.service'
import type {
  CreateInventoryImportInput,
  InventoryImport,
  InventoryItem,
  InventoryReceipt,
} from './inventory.types'
import { getPaginationItems } from '../../utils/pagination'
import { requestAdminNotificationRefresh } from '../../notifications/notification-summary-events'
import { ImportDialog, InventoryHistoryDialog } from './components/ImportLotDialogs'
import { InventoryReceiptDialog } from './components/ReceiptFormDialog'
import { InventoryReceiptListDialog } from './components/ReceiptListDialog'
import { ChevronIcon, EmptyRow, FilterSelect, SearchIcon, ViewIcon, WarningIcon } from './components/InventoryUi'
import type {
  InventoryColorGroup,
  InventoryProductGroup,
  InventoryRow,
  Notice,
  StockStatus,
} from './inventory.view-types'
import {
  formatInputDate,
  formatNumber,
  getErrorMessage,
  getNextReceiptCode,
  getReceiptListItem,
  getStatus,
  inventoryPageSize,
  lowStockThreshold,
} from './inventory.utils'
import './inventory.css'

type InventoryManagementPageProps = {
  currentUser: AdminUser
}

const inventoryMutationClient = new QueryClient()

// Dựng lại phần chi tiết màu đang xem sau khi số tồn thay đổi.
const buildViewingColorGroup = (
  items: InventoryItem[],
  productItems: ManagedProduct[],
  group: InventoryColorGroup,
): InventoryColorGroup => {
  const productById = new Map(productItems.map((product) => [product._id, product]))
  const rows = items
    .filter(
      (item) =>
        item.productId === group.productId &&
        item.variantId === group.variantId &&
        item.colorVariantId === group.colorVariantId,
    )
    .map((item) => {
      const product = productById.get(item.productId)
      const variant = product?.variants.find((entry) => entry._id === item.variantId)
      const color = variant?.colors.find((entry) => entry._id === item.colorVariantId)
      return { ...item, product, variant, color }
    })

  return {
    ...group,
    product: rows[0]?.product ?? group.product,
    variant: rows[0]?.variant ?? group.variant,
    color: rows[0]?.color ?? group.color,
    rows,
  }
}

// Khi xóa một lô nhập, trừ số tồn ngay trên màn hình mà không tải lại toàn bộ kho.
const subtractDeletedImportFromInventory = (
  items: InventoryItem[],
  importRecord: InventoryImport,
) => {
  const deletedQuantityBySize = new Map(
    importRecord.detail.map((detail) => [detail.size.toLowerCase(), detail.quantity]),
  )

  return items.map((item) => {
    if (
      item.productId !== importRecord.productId ||
      item.variantId !== importRecord.variantId ||
      item.colorVariantId !== importRecord.colorVariantId
    ) {
      return item
    }

    const deletedQuantity = deletedQuantityBySize.get(item.size.toLowerCase()) ?? 0
    if (!deletedQuantity) return item

    return {
      ...item,
      quantity: Math.max(0, item.quantity - deletedQuantity),
      availableQuantity: Math.max(0, item.availableQuantity - deletedQuantity),
    }
  })
}

// Khi tạo lô nhập mới, cộng số tồn ngay trên màn hình.
const addCreatedImportToInventory = (
  items: InventoryItem[],
  importRecord: InventoryImport,
) => {
  const importedQuantityBySize = new Map(
    importRecord.detail.map((detail) => [detail.size.toLowerCase(), detail.quantity]),
  )

  return items.map((item) => {
    if (
      item.productId !== importRecord.productId ||
      item.variantId !== importRecord.variantId ||
      item.colorVariantId !== importRecord.colorVariantId
    ) {
      return item
    }

    const importedQuantity = importedQuantityBySize.get(item.size.toLowerCase()) ?? 0
    if (!importedQuantity) return item

    return {
      ...item,
      quantity: item.quantity + importedQuantity,
      availableQuantity: item.availableQuantity + importedQuantity,
    }
  })
}

export function InventoryManagementPage({
  currentUser,
}: InventoryManagementPageProps) {
  return (
    <QueryClientProvider client={inventoryMutationClient}>
      <InventoryManagementContent currentUser={currentUser} />
    </QueryClientProvider>
  )
}

function InventoryManagementContent({
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
  const [receipts, setReceipts] = useState<InventoryReceipt[]>([])
  const [supplierOptions, setSupplierOptions] = useState<string[]>([])
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [importing, setImporting] = useState<InventoryColorGroup | null>(null)
  const [isReceiptFormOpen, setIsReceiptFormOpen] = useState(false)
  const [isReceiptListOpen, setIsReceiptListOpen] = useState(false)
  const [editingReceipt, setEditingReceipt] = useState<InventoryReceipt | null>(null)
  const [notice, setNotice] = useState<Notice>(null)
  const [loadError, setLoadError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const canWrite =
    currentUser.role === 'admin' ||
    currentUser.permissions?.includes('inventory.write') === true

  // Tải dữ liệu chính của trang: số tồn, thông tin sản phẩm, phiếu nhập và nhà cung cấp.
  const loadData = useCallback(async () => {
    setIsLoading(true)
    setLoadError('')
    try {
      const [inventoryResult, productResult] = await Promise.all([
        listInventory(),
        listInventoryProducts(),
      ])
      setInventory(inventoryResult.items)
      setProducts(productResult)
      const receiptResult = await listInventoryReceipts().catch(() => null)
      if (receiptResult) {
        setReceipts(receiptResult.items)
      }
      void listInventorySuppliers()
        .then(setSupplierOptions)
        .catch(() => setSupplierOptions([]))
      return { inventoryItems: inventoryResult.items, productItems: productResult }
    } catch (error) {
      setLoadError(getErrorMessage(error))
      return null
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

  // Ghép số tồn với tên, ảnh, danh mục và màu của sản phẩm để hiển thị dễ đọc.
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
      return {
        total,
        low: inventory.filter(
          (item) =>
            item.availableQuantity > 0 &&
            item.availableQuantity <= lowStockThreshold,
        ).length,
        out: inventory.filter((item) => item.availableQuantity === 0).length,
      }
    },
    [inventory],
  )

  // Lọc trước rồi mới gom nhóm, để phân trang theo sản phẩm thay vì từng size.
  const pagination = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLocaleLowerCase('vi')
    const groupsByProduct = new Map<string, InventoryProductGroup>()

    rows.forEach((row) => {
      const rowStatus = getStatus(row.availableQuantity).id
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
    const totalPages = Math.max(1, Math.ceil(filtered.length / inventoryPageSize))
    const safePage = Math.min(page, totalPages)
    const startIndex = (safePage - 1) * inventoryPageSize
    return {
      items: filtered.slice(startIndex, startIndex + inventoryPageSize),
      totalItems: filtered.length,
      totalPages,
      safePage,
      start: filtered.length ? startIndex + 1 : 0,
      end: Math.min(startIndex + inventoryPageSize, filtered.length),
    }
  }, [brand, category, fitType, keyword, page, rows, status])

  useEffect(() => setPage(1), [brand, category, fitType, keyword, status])

  useEffect(() => {
    setExpandedProducts(new Set())
    setExpandedVariants(new Set())
  }, [pagination.safePage, brand, category, fitType, keyword, status])

  // Hiển thị thanh cuộn ngang cố định khi bảng dài và thanh cuộn thật nằm ngoài màn hình.
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

  // Tạo lô nhập xong thì cập nhật số tồn ngay, không bắt trang tải lại toàn bộ.
  const createImportMutation = useMutation({
    mutationFn: createInventoryImport,
    onMutate: () => {
      setNotice(null)
    },
    onSuccess: (createdImport) => {
      const nextInventory = addCreatedImportToInventory(inventory, createdImport)
      setImporting(null)
      setInventory(nextInventory)
      setViewing((current) => {
        if (
          !current ||
          current.productId !== createdImport.productId ||
          current.variantId !== createdImport.variantId ||
          current.colorVariantId !== createdImport.colorVariantId
        ) {
          return current
        }

        return buildViewingColorGroup(nextInventory, products, current)
      })
      const supplierName = createdImport.supplierName?.trim()
      if (supplierName) {
        setSupplierOptions((current) =>
          current.includes(supplierName)
            ? current
            : [...current, supplierName].sort(),
        )
      }
      setNotice({ type: 'success', message: 'Kho đã được cập nhật với phiếu nhập mới.' })
      requestAdminNotificationRefresh()
    },
    onError: (error) => {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    },
  })

  // Xóa lô nhập chỉ tải lại lịch sử của màu đang xem, còn số tồn được trừ ngay tại màn hình.
  const deleteImportMutation = useMutation({
    mutationFn: async (importId: string) => {
      if (!viewing) {
        throw new Error('Chưa chọn màu sản phẩm để xóa lô nhập.')
      }

      const currentViewing = viewing
      const localDeletedImport = importHistory.find((item) => item._id === importId)
      const deletedImportResult = await deleteInventoryImport(importId)
      const deletedImport = localDeletedImport ?? deletedImportResult
      const result = await listInventoryImportsByColor(
        currentViewing.productId,
        currentViewing.variantId,
        currentViewing.colorVariantId,
      )

      return { deletedImport, result }
    },
    onMutate: () => {
      setHistoryError('')
    },
    onSuccess: ({ deletedImport, result }) => {
      if (deletedImport) {
        const nextInventory = subtractDeletedImportFromInventory(inventory, deletedImport)
        setInventory(nextInventory)
        setViewing((current) => {
          if (
            !current ||
            current.productId !== deletedImport.productId ||
            current.variantId !== deletedImport.variantId ||
            current.colorVariantId !== deletedImport.colorVariantId
          ) {
            return current
          }

          return buildViewingColorGroup(nextInventory, products, current)
        })
      }

      setImportHistory(result.items)
      setNotice({ type: 'success', message: 'Lô nhập đã được xóa và tồn kho đã được cập nhật.' })
      requestAdminNotificationRefresh()
    },
    onError: (error) => {
      setHistoryError(getErrorMessage(error))
    },
  })
  const isImportMutating = createImportMutation.isPending || deleteImportMutation.isPending

  const handleCreateImport = async (input: CreateInventoryImportInput) => {
    await createImportMutation.mutateAsync(input).catch(() => undefined)
  }

  // Chỉ tải lịch sử lô nhập khi admin mở phần xem chi tiết màu.
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
    await deleteImportMutation.mutateAsync(importId).catch(() => undefined)
  }

  return (
    <section className="admin-inventory-page" aria-busy={isLoading}>
      <header className="admin-page-heading admin-inventory-heading">
        <div>
          <h1>Quản lý kho hàng</h1>
          <span>Theo dõi số lượng tồn kho và cảnh báo thiếu hàng theo từng sản phẩm.</span>
        </div>
        <div className="admin-inventory-heading-actions">
          <button
            className="admin-primary-button"
            type="button"
            disabled={!canWrite}
            onClick={() => {
              setEditingReceipt(null)
              setIsReceiptFormOpen(true)
            }}
          >
            Nhập hàng
          </button>
          <button className="admin-secondary-button" type="button" onClick={() => setIsReceiptListOpen(true)}>
            Danh sách phiếu nhập
          </button>
          <button className="admin-secondary-button" type="button" onClick={() => void loadData()}>
            Làm mới
          </button>
        </div>
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
                const low = group.rows.filter(
                  (row) => row.availableQuantity > 0 && row.availableQuantity <= lowStockThreshold,
                ).length
                const out = group.rows.filter((row) => row.availableQuantity === 0).length
                const productStatus = getStatus(group.rows)
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
                        const variantWarnings = variantRows.filter(
                          (row) => row.availableQuantity > 0 && row.availableQuantity <= lowStockThreshold,
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
                                const lowRows = colorGroup.rows.filter(
                                  (row) =>
                                    row.availableQuantity > 0 &&
                                    row.availableQuantity <= lowStockThreshold,
                                )
                                const outRows = colorGroup.rows.filter(
                                  (row) => row.availableQuantity === 0,
                                )
                                const colorStatus = getStatus(colorGroup.rows)
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
          isDeleting={isImportMutating}
          onDeleteImport={handleDeleteImport}
          onClose={() => setViewing(null)}
        />
      ) : null}
      {importing ? (
        <ImportDialog
          row={importing}
          supplierOptions={supplierOptions}
          isSaving={isImportMutating}
          errorMessage={notice?.type === 'error' ? notice.message : ''}
          onClose={() => setImporting(null)}
          onSave={handleCreateImport}
        />
      ) : null}
      {isReceiptFormOpen ? (
        <InventoryReceiptDialog
          currentUser={currentUser}
          defaultCode={getNextReceiptCode(receipts)}
          defaultDate={formatInputDate(new Date())}
          editingReceipt={editingReceipt}
          canWrite={canWrite}
          products={products}
          onSaved={async () => {
            await loadData()
          }}
          onClose={() => {
            setIsReceiptFormOpen(false)
            setEditingReceipt(null)
          }}
        />
      ) : null}
      {isReceiptListOpen ? (
        <InventoryReceiptListDialog
          receipts={receipts.map((item) => getReceiptListItem(item, products))}
          onRefresh={async () => {
            await loadData()
          }}
          onClose={() => setIsReceiptListOpen(false)}
          onOpenForm={(receiptId) => {
            const receipt = receipts.find((item) => item._id === receiptId)
            if (!receipt) return

            setEditingReceipt(receipt)
            setIsReceiptListOpen(false)
            setIsReceiptFormOpen(true)
          }}
        />
      ) : null}
    </section>
  )
}
