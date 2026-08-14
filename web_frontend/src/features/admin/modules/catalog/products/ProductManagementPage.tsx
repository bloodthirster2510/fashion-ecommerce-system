import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
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
  ProductDetailResponse,
  ProductImageFileInput,
} from './product.types'
import { ProductCreateDialog } from './components/ProductCreateDialog'
import { ProductDeleteConfirmationDialog } from './components/ProductDeleteConfirmationDialog'
import { ProductDetailsDialog } from './components/ProductDetailsDialog'
import { ProductFilters } from './components/ProductFilters'
import { ProductInventoryBySizeDialog } from './components/ProductInventoryBySizeDialog'
import { ProductPagination } from './components/ProductPagination'
import { ProductStats } from './components/ProductStats'
import { ProductTable } from './components/ProductTable'
import {
  type ProductActiveFilter,
  type ProductStockFilter,
  type QuantityDetail,
  getErrorMessage,
  getInventory,
  getStockMeta,
  lowStockThreshold,
  pageSize,
} from './productDisplay.helpers'
import { useToast } from '../../../notifications/notification-context'
import './product.css'

type ProductManagementPageProps = {
  currentUser: AdminUser
}

type Notice = {
  type: 'success' | 'error'
  message: string
} | null

export function ProductManagementPage({ currentUser }: ProductManagementPageProps) {
  const { showToast } = useToast()
  const tableShellRef = useRef<HTMLDivElement>(null)
  const stickyScrollbarRef = useRef<HTMLDivElement>(null)
  const stickyScrollbarContentRef = useRef<HTMLDivElement>(null)
  const editRequestIdRef = useRef(0)
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
  const [loadingEditorProductId, setLoadingEditorProductId] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (!notice) return
    showToast(notice.message, notice.type)
    if (notice.type === 'success') setNotice(null)
  }, [notice, showToast])
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
      const isLowStatus = !isOut && inventory.some(
        (item) => item.availableQuantity > 0 && item.availableQuantity <= lowStockThreshold,
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
    setter: Dispatch<SetStateAction<Set<string>>>,
  ) => {
    setter((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleOpenEditor = async (product: ManagedProduct) => {
    const requestId = editRequestIdRef.current + 1
    editRequestIdRef.current = requestId
    setLoadingEditorProductId(product._id)
    setNotice(null)
    try {
      const productDetail = await getManagedProductDetail(product._id)
      if (editRequestIdRef.current === requestId) {
        setEditingProduct(productDetail)
      }
    } catch (error) {
      if (editRequestIdRef.current === requestId) {
        setNotice({ type: 'error', message: getErrorMessage(error) })
      }
    } finally {
      if (editRequestIdRef.current === requestId) {
        setLoadingEditorProductId(null)
      }
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

      <ProductStats stats={stats} />

      <ProductFilters
        keyword={keyword}
        categoryFilter={categoryFilter}
        brandFilter={brandFilter}
        fitTypeFilter={fitTypeFilter}
        activeFilter={activeFilter}
        stockFilter={stockFilter}
        filterOptions={filterOptions}
        onKeywordChange={setKeyword}
        onCategoryFilterChange={setCategoryFilter}
        onBrandFilterChange={setBrandFilter}
        onFitTypeFilterChange={setFitTypeFilter}
        onActiveFilterChange={setActiveFilter}
        onStockFilterChange={setStockFilter}
      />

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
          <ProductTable
            products={pagination.items}
            isLoading={isLoading}
            canWrite={canWrite}
            expandedProducts={expandedProducts}
            expandedVariants={expandedVariants}
            loadingEditorProductId={loadingEditorProductId}
            tableShellRef={tableShellRef}
            onToggleProduct={(productId) => toggleExpanded(productId, setExpandedProducts)}
            onToggleVariant={(variantKey) => toggleExpanded(variantKey, setExpandedVariants)}
            onViewProduct={setViewingProduct}
            onEditProduct={(product) => void handleOpenEditor(product)}
            onDeleteProduct={setDeletingProduct}
            onViewQuantity={setQuantityDetail}
          />
      </>)}

      <div
        className="admin-product-sticky-scrollbar"
        ref={stickyScrollbarRef}
        hidden
        aria-hidden="true"
      >
        <div ref={stickyScrollbarContentRef} />
      </div>

      <ProductPagination
        start={pagination.start}
        end={pagination.end}
        totalItems={pagination.totalItems}
        totalPages={pagination.totalPages}
        safePage={pagination.safePage}
        isLoading={isLoading}
        onPageChange={setPage}
      />

      {quantityDetail ? (
        <ProductInventoryBySizeDialog
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
        <ProductDetailsDialog product={viewingProduct} onClose={() => setViewingProduct(null)} />
      ) : null}

      {deletingProduct ? (
        <ProductDeleteConfirmationDialog
          product={deletingProduct}
          isSaving={isSaving}
          onClose={() => setDeletingProduct(null)}
          onConfirm={(mode) => void handleDeleteProduct(mode)}
        />
      ) : null}
    </section>
  )
}
