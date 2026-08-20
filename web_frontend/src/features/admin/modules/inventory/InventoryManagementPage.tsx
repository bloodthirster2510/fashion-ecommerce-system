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
  adjustInventory,
  createInventoryStocktake,
  createInventorySupplier,
  deleteInventorySupplier,
  listInventoryImportsByColor,
  listInventoryMovementsByColor,
  listInventoryMovements,
  listInventory,
  listInventoryProducts,
  listInventoryReceipts,
  getInventoryThreshold,
  listManagedInventorySuppliers,
  updateInventorySupplier,
  updateInventoryThreshold,
} from './inventory.service'
import type {
  AdjustInventoryInput,
  CreateInventoryStocktakeInput,
  InventoryImport,
  InventoryItem,
  InventoryMovement,
  InventoryMovementType,
  InventoryReceipt,
  InventorySupplier,
  UpsertInventorySupplierInput,
} from './inventory.types'
import { getPaginationItems } from '../../utils/pagination'
import { requestAdminNotificationRefresh } from '../../notifications/notification-summary-events'
import { useToast } from '../../notifications/notification-context'
import { InventoryHistoryDialog } from './components/ImportLotDialogs'
import { InventoryReceiptDialog } from './components/ReceiptFormDialog'
import { InventoryReceiptListDialog } from './components/ReceiptListDialog'
import {
  InventoryAdjustDialog,
  InventoryStocktakeDialog,
  InventorySupplierDialog,
  InventoryThresholdDialog,
} from './components/InventoryOperationsDialogs'
import { ChevronIcon, EmptyRow, FilterSelect, LoadingRows, SearchIcon, ViewIcon, WarningIcon } from './components/InventoryUi'
import type {
  InventoryColorGroup,
  InventoryProductGroup,
  InventoryRow,
  Notice,
  StockStatus,
} from './inventory.view-types'
import {
  formatDate,
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
const movementPageSize = 12
const movementLabels: Record<InventoryMovementType, string> = {
  import: 'Nhập kho',
  import_delete: 'Xóa lô nhập',
  adjustment: 'Điều chỉnh',
  sale_commit: 'Bán hàng',
  reservation: 'Giữ hàng',
  reservation_release: 'Hủy giữ',
  reservation_expire: 'Hết hạn giữ',
  stocktake: 'Kiểm kê',
}

const movementTypeOptions: Array<{ value: InventoryMovementType | 'all'; label: string }> = [
  { value: 'all', label: 'Tất cả biến động' },
  { value: 'import', label: 'Nhập kho' },
  { value: 'adjustment', label: 'Điều chỉnh' },
  { value: 'stocktake', label: 'Kiểm kê' },
  { value: 'sale_commit', label: 'Bán hàng' },
  { value: 'reservation', label: 'Giữ hàng' },
  { value: 'reservation_release', label: 'Hủy giữ' },
  { value: 'reservation_expire', label: 'Hết hạn giữ' },
  { value: 'import_delete', label: 'Xóa lô nhập' },
]

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

const replaceInventoryItem = (items: InventoryItem[], updatedItem: InventoryItem) =>
  items.map((item) => (item._id === updatedItem._id ? updatedItem : item))

const uniqueTextValues = (values: Array<string | undefined>) =>
  [...new Set(values.map((value) => value?.trim()).filter(Boolean))]

const getInventoryWarningCounts = (
  rows: InventoryRow[],
  threshold: number,
  keyBuilder: (row: InventoryRow) => string,
) => {
  const lowKeys = new Set<string>()
  const outKeys = new Set<string>()

  rows.forEach((row) => {
    const key = keyBuilder(row)
    if (!key) return
    if (row.availableQuantity === 0) outKeys.add(key)
    else if (row.availableQuantity <= threshold) lowKeys.add(key)
  })

  return { low: lowKeys.size, out: outKeys.size }
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
  const { showToast } = useToast()
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
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [page, setPage] = useState(1)
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set())
  const [expandedVariants, setExpandedVariants] = useState<Set<string>>(new Set())
  const [viewing, setViewing] = useState<InventoryColorGroup | null>(null)
  const [importHistory, setImportHistory] = useState<InventoryImport[]>([])
  const [movementHistory, setMovementHistory] = useState<InventoryMovement[]>([])
  const [inventoryMovements, setInventoryMovements] = useState<InventoryMovement[]>([])
  const [movementType, setMovementType] = useState<InventoryMovementType | 'all'>('all')
  const [movementPage, setMovementPage] = useState(1)
  const [movementTotalItems, setMovementTotalItems] = useState(0)
  const [movementTotalPages, setMovementTotalPages] = useState(1)
  const [isMovementListLoading, setIsMovementListLoading] = useState(false)
  const [movementListError, setMovementListError] = useState('')
  const [receipts, setReceipts] = useState<InventoryReceipt[]>([])
  const [managedSuppliers, setManagedSuppliers] = useState<InventorySupplier[]>([])
  const [globalLowStockThreshold, setGlobalLowStockThreshold] = useState(lowStockThreshold)
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [adjusting, setAdjusting] = useState<InventoryColorGroup | null>(null)
  const [isThresholdDialogOpen, setIsThresholdDialogOpen] = useState(false)
  const [stocktaking, setStocktaking] = useState<InventoryColorGroup | null>(null)
  const [isSupplierDialogOpen, setIsSupplierDialogOpen] = useState(false)
  const [isReceiptFormOpen, setIsReceiptFormOpen] = useState(false)
  const [isReceiptListOpen, setIsReceiptListOpen] = useState(false)
  const [editingReceipt, setEditingReceipt] = useState<InventoryReceipt | null>(null)
  const [notice, setNotice] = useState<Notice>(null)
  const [loadError, setLoadError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const canWrite =
    currentUser.role === 'admin' ||
    currentUser.permissions?.includes('inventory.write') === true
  const hasAdvancedFilters = category !== 'all' || brand !== 'all' || fitType !== 'all'

  const loadMovementList = useCallback(async () => {
    setIsMovementListLoading(true)
    setMovementListError('')
    try {
      const result = await listInventoryMovements({
        page: movementPage,
        limit: movementPageSize,
        type: movementType,
      })
      setInventoryMovements(result.items)
      setMovementTotalItems(result.pagination.totalItems)
      setMovementTotalPages(Math.max(1, result.pagination.totalPages))
    } catch (error) {
      setMovementListError(getErrorMessage(error))
    } finally {
      setIsMovementListLoading(false)
    }
  }, [movementPage, movementType])

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
      void getInventoryThreshold()
        .then((result) => setGlobalLowStockThreshold(result.lowStockThreshold))
        .catch(() => setGlobalLowStockThreshold(lowStockThreshold))
      void listManagedInventorySuppliers()
        .then(setManagedSuppliers)
        .catch(() => setManagedSuppliers([]))
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
    if (!notice) return
    showToast(notice.message, notice.type)
    if (notice.type === 'success') setNotice(null)
  }, [notice, showToast])

  useEffect(() => {
    void loadMovementList()
  }, [loadMovementList])

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

  const productById = useMemo(
    () => new Map(products.map((product) => [product._id, product])),
    [products],
  )

  const getMovementContext = (movement: InventoryMovement) => {
    const product = productById.get(movement.productId)
    const variant = product?.variants.find((item) => item._id === movement.variantId)
    const color = variant?.colors.find((item) => item._id === movement.colorVariantId)

    return { product, variant, color }
  }

  const stats = useMemo(
    () => {
      const total = inventory.reduce((sum, item) => sum + item.availableQuantity, 0)
      return {
        total,
        low: inventory.filter(
          (item) =>
            item.availableQuantity > 0 &&
            item.availableQuantity <= globalLowStockThreshold,
        ).length,
        out: inventory.filter((item) => item.availableQuantity === 0).length,
      }
    },
    [globalLowStockThreshold, inventory],
  )

  // Lọc các thuộc tính trước rồi mới lọc trạng thái ở cấp nhóm, để không làm mất bối cảnh size.
  const pagination = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLocaleLowerCase('vi')
    const groupsByProduct = new Map<string, InventoryProductGroup>()

    rows.forEach((row) => {
      const matchesKeyword =
        !normalizedKeyword ||
        [row.product?.name, row.sku, row.color?.color, row.size].some((value) =>
          value?.toLocaleLowerCase('vi').includes(normalizedKeyword),
        )
      const matchesFilters =
        matchesKeyword &&
        (category === 'all' || row.product?.categoryName === category) &&
        (brand === 'all' || row.product?.brandName === brand) &&
        (fitType === 'all' || row.variant?.fitTypeLabel === fitType)

      if (!matchesFilters) return

      const group = groupsByProduct.get(row.productId) ?? {
        productId: row.productId,
        product: row.product,
        rows: [],
      }
      group.rows.push(row)
      groupsByProduct.set(row.productId, group)
    })

    const matchesStockStatus = (group: InventoryProductGroup) => {
      if (status === 'all') return true

      const hasOut = group.rows.some((row) => row.availableQuantity === 0)
      const hasLow = group.rows.some(
        (row) =>
          row.availableQuantity > 0 &&
          row.availableQuantity <= globalLowStockThreshold,
      )

      if (status === 'warning') return hasLow || hasOut

      return group.rows.length > 0 && !hasLow && !hasOut
    }

    const filtered = [...groupsByProduct.values()].filter(matchesStockStatus)
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
  }, [brand, category, fitType, globalLowStockThreshold, keyword, page, rows, status])

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
    setShowAdvancedFilters(false)
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

  const adjustInventoryMutation = useMutation({
    mutationFn: ({ inventoryId, input }: { inventoryId: string; input: AdjustInventoryInput }) =>
      adjustInventory(inventoryId, input),
    onMutate: () => {
      setNotice(null)
    },
    onSuccess: (updatedItem) => {
      const nextInventory = replaceInventoryItem(inventory, updatedItem)
      setInventory(nextInventory)
      setAdjusting(null)
      setViewing((current) => (current ? buildViewingColorGroup(nextInventory, products, current) : current))
      setNotice({ type: 'success', message: 'Tồn kho đã được điều chỉnh và ghi vào sổ kho.' })
      void loadMovementList()
      requestAdminNotificationRefresh()
    },
    onError: (error) => {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    },
  })

  const thresholdMutation = useMutation({
    mutationFn: (nextThreshold: number) =>
      updateInventoryThreshold({ lowStockThreshold: nextThreshold }),
    onMutate: () => {
      setNotice(null)
    },
    onSuccess: (result) => {
      setGlobalLowStockThreshold(result.lowStockThreshold)
      setIsThresholdDialogOpen(false)
      setNotice({ type: 'success', message: 'Ngưỡng cảnh báo kho đã được cập nhật.' })
    },
    onError: (error) => {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    },
  })

  const stocktakeMutation = useMutation({
    mutationFn: (input: CreateInventoryStocktakeInput) => createInventoryStocktake(input),
    onMutate: () => {
      setNotice(null)
    },
    onSuccess: async () => {
      setStocktaking(null)
      await loadData()
      await loadMovementList()
      setNotice({ type: 'success', message: 'Phiếu kiểm kê đã được ghi nhận và tồn kho đã cập nhật.' })
      requestAdminNotificationRefresh()
    },
    onError: (error) => {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    },
  })

  const supplierMutation = useMutation({
    mutationFn: async (
      action:
        | { type: 'create'; input: UpsertInventorySupplierInput }
        | { type: 'update'; id: string; input: Partial<UpsertInventorySupplierInput> }
        | { type: 'delete'; id: string },
    ) => {
      if (action.type === 'create') return createInventorySupplier(action.input)
      if (action.type === 'update') return updateInventorySupplier(action.id, action.input)
      return deleteInventorySupplier(action.id)
    },
    onMutate: () => {
      setNotice(null)
    },
    onSuccess: async () => {
      const suppliers = await listManagedInventorySuppliers().catch(() => [])
      setManagedSuppliers(suppliers)
      setNotice({ type: 'success', message: 'Danh sách nhà cung cấp đã được cập nhật.' })
    },
    onError: (error) => {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    },
  })

  const isOperationSaving =
    adjustInventoryMutation.isPending ||
    thresholdMutation.isPending ||
    stocktakeMutation.isPending ||
    supplierMutation.isPending

  // Chỉ tải lịch sử lô nhập khi admin mở phần xem chi tiết màu.
  const handleViewHistory = async (colorGroup: InventoryColorGroup) => {
    setViewing(colorGroup)
    setImportHistory([])
    setMovementHistory([])
    setHistoryError('')
    setIsHistoryLoading(true)
    try {
      const [importResult, movementResult] = await Promise.all([
        listInventoryImportsByColor(
          colorGroup.productId,
          colorGroup.variantId,
          colorGroup.colorVariantId,
        ),
        listInventoryMovementsByColor(
          colorGroup.productId,
          colorGroup.variantId,
          colorGroup.colorVariantId,
        ),
      ])
      setImportHistory(importResult.items)
      setMovementHistory(movementResult.items)
    } catch (error) {
      setHistoryError(getErrorMessage(error))
    } finally {
      setIsHistoryLoading(false)
    }
  }

  const handleAdjustInventory = async (
    inventoryId: string,
    quantity: number,
    reason: string,
    note: string,
  ) => {
    await adjustInventoryMutation.mutateAsync({
      inventoryId,
      input: { quantity, reason, note },
    }).catch(() => undefined)
  }

  const handleUpdateThreshold = async (nextThreshold: number) => {
    await thresholdMutation.mutateAsync(nextThreshold).catch(() => undefined)
  }

  const handleCreateStocktake = async (
    lines: Array<{ inventoryId: string; countedQuantity: number; reason?: string }>,
    note: string,
  ) => {
    await stocktakeMutation.mutateAsync({ lines, note }).catch(() => undefined)
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
          <button className="admin-secondary-button" type="button" onClick={() => setIsSupplierDialogOpen(true)}>
            Nhà cung cấp
          </button>
          <button className="admin-secondary-button" type="button" onClick={() => setIsThresholdDialogOpen(true)}>
            Ngưỡng cảnh báo
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
        <div className="admin-inventory-primary-filters">
          <label className="admin-inventory-search">
            <SearchIcon />
            <input
              type="search"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Tìm tên sản phẩm, màu, size..."
            />
          </label>
          <select value={status} onChange={(event) => setStatus(event.target.value as StockStatus)} aria-label="Cảnh báo tồn kho">
            <option value="all">Tất cả tồn kho</option>
            <option value="warning">Cần xử lý</option>
            <option value="available">Đủ hàng</option>
          </select>
          <button
            className={`admin-secondary-button${showAdvancedFilters || hasAdvancedFilters ? ' is-active' : ''}`}
            type="button"
            onClick={() => setShowAdvancedFilters((current) => !current)}
          >
            Bộ lọc nâng cao{hasAdvancedFilters ? ' (đang dùng)' : ''}
          </button>
          <button className="admin-secondary-button" type="button" onClick={resetFilters}>Đặt lại</button>
        </div>
        {showAdvancedFilters || hasAdvancedFilters ? (
          <div className="admin-inventory-filters">
            <FilterSelect value={category} onChange={setCategory} label="Danh mục" options={filterOptions.categories} />
            <FilterSelect value={brand} onChange={setBrand} label="Thương hiệu" options={filterOptions.brands} />
            <FilterSelect value={fitType} onChange={setFitType} label="Phom dáng" options={filterOptions.fitTypes} />
          </div>
        ) : null}
        <div className="admin-inventory-tabs" aria-label="Lọc nhanh tồn kho">
          {[
            ['all', 'Tất cả tồn kho'],
            ['warning', 'Cần xử lý'],
            ['available', 'Đủ hàng'],
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
              {isLoading ? <LoadingRows /> : null}
              {!isLoading && pagination.items.length === 0 ? <EmptyRow label="Không có tồn kho phù hợp." /> : null}
              {!isLoading ? pagination.items.flatMap((group) => {
                const total = group.rows.reduce((sum, row) => sum + row.availableQuantity, 0)
                const warningCounts = getInventoryWarningCounts(
                  group.rows,
                  globalLowStockThreshold,
                  (row) => `${row.variantId}:${row.colorVariantId}:${row.size.trim().toLowerCase()}`,
                )
                const low = warningCounts.low
                const out = warningCounts.out
                const productStatus = getStatus(group.rows, globalLowStockThreshold)
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
                          (row) => row.availableQuantity <= globalLowStockThreshold,
                        )
                        const variantWarningLabels = uniqueTextValues(
                          variantWarnings.map((row) => `${row.color?.color || '-'} / ${row.size}`),
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
                                <span>Phom dáng</span>
                                <strong>{variantRows[0]?.variant?.fitTypeLabel || '-'}</strong>
                                {variantWarnings.length ? (
                                  <span className="admin-variant-warning">
                                    <WarningIcon />
                                    {variantWarningLabels.join(', ')} đang thiếu hàng
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
                                    row.availableQuantity <= globalLowStockThreshold,
                                )
                                const outRows = colorGroup.rows.filter(
                                  (row) => row.availableQuantity === 0,
                                )
                                const uniqueSizeCount = uniqueTextValues(colorGroup.rows.map((row) => row.size)).length
                                const lowSizes = uniqueTextValues(lowRows.map((row) => row.size))
                                const outSizes = uniqueTextValues(outRows.map((row) => row.size))
                                const colorStatus = getStatus(colorGroup.rows, globalLowStockThreshold)
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
                                              <strong>{uniqueSizeCount} size</strong>
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
                                                    {lowSizes.length ? `Sắp hết: ${lowSizes.join(', ')}` : ''}
                                                    {lowSizes.length && outSizes.length ? ' · ' : ''}
                                                    {outSizes.length ? `Hết: ${outSizes.join(', ')}` : ''}
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
                                                <button className="admin-secondary-link" type="button" disabled={!canWrite} onClick={() => setAdjusting(colorGroup)}>Điều chỉnh</button>
                                                <button className="admin-secondary-link" type="button" disabled={!canWrite} onClick={() => setStocktaking(colorGroup)}>Kiểm kê</button>
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

      <section className="admin-inventory-movement-panel" aria-labelledby="inventory-movement-log-title">
        <header>
          <div>
            <span>Sổ kho</span>
            <h2 id="inventory-movement-log-title">Biến động kho hàng</h2>
          </div>
          <div>
            <select
              value={movementType}
              onChange={(event) => {
                setMovementType(event.target.value as InventoryMovementType | 'all')
                setMovementPage(1)
              }}
              aria-label="Lọc loại biến động kho"
            >
              {movementTypeOptions.map((option) => (
                <option value={option.value} key={option.value}>{option.label}</option>
              ))}
            </select>
            <button className="admin-secondary-button" type="button" onClick={() => void loadMovementList()}>
              Làm mới
            </button>
          </div>
        </header>
        <div className="admin-inventory-movement-table">
          <header>
            <span>Thời gian</span>
            <span>Sản phẩm</span>
            <span>Phom dáng</span>
            <span>Màu</span>
            <span>Size</span>
            <span>Loại</span>
            <span>Thay đổi</span>
            <span>Tồn sau</span>
            <span>Lý do</span>
          </header>
          {isMovementListLoading ? <p>Đang tải biến động kho...</p> : null}
          {movementListError ? <p className="admin-notice is-error">{movementListError}</p> : null}
          {!isMovementListLoading && !movementListError && inventoryMovements.length === 0 ? (
            <p>Chưa có biến động kho phù hợp.</p>
          ) : null}
          {!isMovementListLoading && !movementListError ? inventoryMovements.map((movement) => {
            const context = getMovementContext(movement)

            return (
              <article key={movement._id}>
                <span>{formatDate(movement.createdAt)}</span>
                <strong>{context.product?.name || movement.sku || '-'}</strong>
                <span>{context.variant?.fitTypeLabel || '-'}</span>
                <span>{context.color?.color || '-'}</span>
                <span>{movement.size}</span>
                <span>{movementLabels[movement.type] ?? movement.type}</span>
                <strong className={movement.quantityDelta < 0 ? 'is-negative' : 'is-positive'}>
                  {movement.quantityDelta > 0 ? '+' : ''}{formatNumber(movement.quantityDelta)}
                </strong>
                <span>{formatNumber(movement.quantityAfter)}</span>
                <span>{movement.reason || '-'}</span>
              </article>
            )
          }) : null}
        </div>
        <footer>
          <span>Hiển thị {inventoryMovements.length ? ((movementPage - 1) * movementPageSize) + 1 : 0}–{Math.min(movementPage * movementPageSize, movementTotalItems)} / {movementTotalItems}</span>
          <div>
            <button
              className="admin-secondary-button"
              type="button"
              disabled={movementPage <= 1 || isMovementListLoading}
              onClick={() => setMovementPage((value) => Math.max(1, value - 1))}
            >
              Trước
            </button>
            <span>{movementPage} / {movementTotalPages}</span>
            <button
              className="admin-secondary-button"
              type="button"
              disabled={movementPage >= movementTotalPages || isMovementListLoading}
              onClick={() => setMovementPage((value) => Math.min(movementTotalPages, value + 1))}
            >
              Sau
            </button>
          </div>
        </footer>
      </section>

      {viewing ? (
        <InventoryHistoryDialog
          group={viewing}
          imports={importHistory}
          movements={movementHistory}
          isLoading={isHistoryLoading}
          errorMessage={historyError}
          onClose={() => setViewing(null)}
        />
      ) : null}
      {adjusting ? (
        <InventoryAdjustDialog
          group={adjusting}
          isSaving={isOperationSaving}
          errorMessage={notice?.type === 'error' ? notice.message : ''}
          onClose={() => setAdjusting(null)}
          onSave={handleAdjustInventory}
        />
      ) : null}
      {isThresholdDialogOpen ? (
        <InventoryThresholdDialog
          value={globalLowStockThreshold}
          isSaving={isOperationSaving}
          errorMessage={notice?.type === 'error' ? notice.message : ''}
          onClose={() => setIsThresholdDialogOpen(false)}
          onSave={handleUpdateThreshold}
        />
      ) : null}
      {stocktaking ? (
        <InventoryStocktakeDialog
          group={stocktaking}
          isSaving={isOperationSaving}
          errorMessage={notice?.type === 'error' ? notice.message : ''}
          onClose={() => setStocktaking(null)}
          onSave={handleCreateStocktake}
        />
      ) : null}
      {isSupplierDialogOpen ? (
        <InventorySupplierDialog
          suppliers={managedSuppliers}
          isSaving={isOperationSaving}
          errorMessage={notice?.type === 'error' ? notice.message : ''}
          onClose={() => setIsSupplierDialogOpen(false)}
          onCreate={(input) => supplierMutation.mutateAsync({ type: 'create', input }).then(() => undefined)}
          onUpdate={(id, input) => supplierMutation.mutateAsync({ type: 'update', id, input }).then(() => undefined)}
          onDisable={(id) => supplierMutation.mutateAsync({ type: 'delete', id }).then(() => undefined)}
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
          suppliers={managedSuppliers}
          onSaved={async () => {
            await loadData()
            await loadMovementList()
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
