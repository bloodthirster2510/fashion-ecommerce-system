import { useCallback, useEffect, useState } from 'react'
import {
  listOrders,
  type AdminOrder,
  type AdminOrderListSort,
  type AdminOrderPaymentMethod,
  type AdminOrderPaymentStatus,
  type AdminOrderStatus,
} from '../orderAdminApi'
import type { PaymentSectionKey } from '../orderTypes'
import type { OrderTableColumnKey } from '../orderTypes'
import {
  emptyOperationalSummary,
  emptyStatusSummary,
  getErrorMessage,
  getPaymentSectionMethods,
  orderTabs,
  pageSize,
  paymentSections,
  resolveInitialTabKey,
} from '../orderPresentation'
import {
  getOrderAttentionRank,
  getOrderQueue,
} from '../utils/orderQueue'
import { defaultOrderTableColumns } from '../utils/orderTableColumns'

const orderLookupViewStorageKey = 'admin.orders.lookupView'

type OrderLookupSavedView = {
  dateFrom?: string
  dateTo?: string
  keywordInput?: string
  paymentMethod?: AdminOrderPaymentMethod | 'all'
  paymentStatus?: AdminOrderPaymentStatus | 'all'
  sort?: AdminOrderListSort
  visibleColumns?: OrderTableColumnKey[]
}

const getSavedLookupView = (): OrderLookupSavedView | null => {
  try {
    const rawView = window.localStorage.getItem(orderLookupViewStorageKey)
    if (!rawView) return null

    return JSON.parse(rawView) as OrderLookupSavedView
  } catch {
    return null
  }
}

const getDefaultLookupDateFrom = () => getRelativeDateInput(30)

const normalizeVisibleColumns = (columns?: OrderTableColumnKey[]) => {
  const allowedColumns = new Set(defaultOrderTableColumns)
  const normalizedColumns = (columns ?? defaultOrderTableColumns).filter((column) => allowedColumns.has(column))

  return normalizedColumns.length > 0 ? normalizedColumns : defaultOrderTableColumns
}

const formatDateInput = (date: Date) => {
  const timezoneOffsetMs = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 10)
}

const getRelativeDateInput = (daysAgo: number) => {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  return formatDateInput(date)
}

export function useOrderListData({
  initialTabKey,
  lockPaymentSection,
  paymentSection,
}: {
  initialTabKey?: string
  lockPaymentSection: boolean
  paymentSection: PaymentSectionKey
}) {
  const savedLookupView = !lockPaymentSection ? getSavedLookupView() : null
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [keywordInput, setKeywordInput] = useState(savedLookupView?.keywordInput ?? '')
  const [keyword, setKeyword] = useState(savedLookupView?.keywordInput?.trim() ?? '')
  const [activePaymentSectionKey, setActivePaymentSectionKey] = useState<PaymentSectionKey>(paymentSection)
  const [activeTabKey, setActiveTabKey] = useState(() => resolveInitialTabKey(initialTabKey, lockPaymentSection))
  const [paymentMethod, setPaymentMethod] = useState<AdminOrderPaymentMethod | 'all'>(savedLookupView?.paymentMethod ?? 'all')
  const [paymentStatus, setPaymentStatus] = useState<AdminOrderPaymentStatus | 'all'>(savedLookupView?.paymentStatus ?? 'all')
  const [dateFrom, setDateFrom] = useState(() => (lockPaymentSection ? '' : savedLookupView?.dateFrom ?? getDefaultLookupDateFrom()))
  const [dateTo, setDateTo] = useState(savedLookupView?.dateTo ?? '')
  const [sort, setSort] = useState<AdminOrderListSort>(savedLookupView?.sort ?? 'created_desc')
  const [visibleColumns, setVisibleColumns] = useState<OrderTableColumnKey[]>(() =>
    normalizeVisibleColumns(savedLookupView?.visibleColumns),
  )
  const [page, setPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [statusSummary, setStatusSummary] = useState<Record<AdminOrderStatus | 'all', number>>(emptyStatusSummary)
  const [operationalSummary, setOperationalSummary] = useState(emptyOperationalSummary)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const isLookupMode = !lockPaymentSection
  const activeTab = orderTabs.find((tab) => tab.key === activeTabKey) ?? orderTabs[0]
  const activePaymentSection =
    paymentSections.find((section) => section.key === activePaymentSectionKey) ?? paymentSections[0]
  const pageTitle = lockPaymentSection ? activePaymentSection.label : 'Tra cứu hóa đơn & đơn hàng'
  const pageHelper = lockPaymentSection ? activePaymentSection.helper : 'Tìm theo mã đơn, mã hóa đơn, khách hàng hoặc sản phẩm'

  useEffect(() => {
    const currentSavedLookupView = !lockPaymentSection ? getSavedLookupView() : null

    setActivePaymentSectionKey(paymentSection)
    setPaymentMethod(lockPaymentSection ? paymentSection === 'cod' ? 'COD' : 'all' : currentSavedLookupView?.paymentMethod ?? 'all')
    setPaymentStatus(lockPaymentSection ? 'all' : currentSavedLookupView?.paymentStatus ?? 'all')
    setKeywordInput(currentSavedLookupView?.keywordInput ?? '')
    setKeyword(currentSavedLookupView?.keywordInput?.trim() ?? '')
    setDateFrom(lockPaymentSection ? '' : currentSavedLookupView?.dateFrom ?? getDefaultLookupDateFrom())
    setDateTo(currentSavedLookupView?.dateTo ?? '')
    setSort(currentSavedLookupView?.sort ?? 'created_desc')
    setVisibleColumns(normalizeVisibleColumns(currentSavedLookupView?.visibleColumns))
    setActiveTabKey(resolveInitialTabKey(initialTabKey, lockPaymentSection))
    setPage(1)
  }, [initialTabKey, lockPaymentSection, paymentSection])

  const loadOrders = useCallback(async (options: { quiet?: boolean } = {}) => {
    const quiet = options.quiet ?? false
    if (!quiet) {
      setIsLoading(true)
      setErrorMessage('')
    }

    try {
      const effectivePaymentStatus = activeTab.paymentStatus ?? paymentStatus
      const effectiveLimit = activeTab.queue ? 100 : pageSize
      const sectionPaymentMethods = isLookupMode ? undefined : getPaymentSectionMethods(activePaymentSectionKey)
      const selectedPaymentMethod = !isLookupMode && activePaymentSectionKey === 'cod' ? 'COD' : paymentMethod
      const result = await listOrders({
        keyword,
        statuses: activeTab.statuses,
        paymentStatus: effectivePaymentStatus,
        paymentMethod: selectedPaymentMethod === 'all' ? undefined : selectedPaymentMethod,
        paymentMethods: selectedPaymentMethod === 'all' ? sectionPaymentMethods : undefined,
        paymentDeadlineBefore: activeTab.queue === 'payment-deadline'
          ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          : undefined,
        dateFrom: isLookupMode ? dateFrom || undefined : undefined,
        dateTo: isLookupMode ? dateTo || undefined : undefined,
        sort: isLookupMode ? sort : undefined,
        page: activeTab.queue ? 1 : page,
        limit: effectiveLimit,
      })

      const orderedItems = [...result.items]
        .filter((order) => !activeTab.queue || getOrderQueue(order) === activeTab.queue)
        .sort((left, right) => {
          const rankDelta = getOrderAttentionRank(left) - getOrderAttentionRank(right)
          if (rankDelta !== 0) return rankDelta
          return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
        })

      setOrders(orderedItems)
      setTotalItems(activeTab.queue ? orderedItems.length : Math.max(0, result.pagination?.totalItems ?? orderedItems.length))
      setTotalPages(activeTab.queue ? 1 : Math.max(1, result.pagination?.totalPages ?? 1))
      setStatusSummary({ ...emptyStatusSummary, ...result.statusSummary })
      setOperationalSummary({ ...emptyOperationalSummary, ...result.operationalSummary })
    } catch (error) {
      if (!quiet) {
        setErrorMessage(getErrorMessage(error))
      }
    } finally {
      if (!quiet) {
        setIsLoading(false)
      }
    }
  }, [activePaymentSectionKey, activeTab.paymentStatus, activeTab.queue, activeTab.statuses, dateFrom, dateTo, isLookupMode, keyword, page, paymentMethod, paymentStatus, setOrders, sort])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setPage(1)
      setKeyword(keywordInput.trim())
    }, 320)

    return () => window.clearTimeout(handle)
  }, [keywordInput])

  useEffect(() => {
    void loadOrders()
  }, [loadOrders])

  const applyLookupDateRange = (daysAgo: number) => {
    setDateFrom(getRelativeDateInput(daysAgo))
    setDateTo('')
    setPage(1)
  }

  const clearLookupDateRange = () => {
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  const toggleVisibleColumn = (column: OrderTableColumnKey) => {
    setVisibleColumns((currentColumns) => {
      if (currentColumns.includes(column)) {
        return currentColumns.length > 1
          ? currentColumns.filter((currentColumn) => currentColumn !== column)
          : currentColumns
      }

      return defaultOrderTableColumns.filter((defaultColumn) => (
        defaultColumn === column || currentColumns.includes(defaultColumn)
      ))
    })
  }

  const saveLookupView = () => {
    window.localStorage.setItem(
      orderLookupViewStorageKey,
      JSON.stringify({
        dateFrom,
        dateTo,
        keywordInput,
        paymentMethod,
        paymentStatus,
        sort,
        visibleColumns,
      } satisfies OrderLookupSavedView),
    )
  }

  const resetLookupView = () => {
    window.localStorage.removeItem(orderLookupViewStorageKey)
    setKeywordInput('')
    setKeyword('')
    setPaymentMethod('all')
    setPaymentStatus('all')
    setDateFrom(getDefaultLookupDateFrom())
    setDateTo('')
    setSort('created_desc')
    setVisibleColumns(defaultOrderTableColumns)
    setPage(1)
  }

  return {
    activePaymentSection,
    activePaymentSectionKey,
    activeTab,
    activeTabKey,
    applyLookupDateRange,
    clearLookupDateRange,
    dateFrom,
    dateTo,
    errorMessage,
    isLoading,
    isLookupMode,
    keywordInput,
    loadOrders,
    operationalSummary,
    orders,
    page,
    pageHelper,
    pageTitle,
    paymentMethod,
    paymentStatus,
    setActiveTabKey,
    setDateFrom,
    setDateTo,
    setKeywordInput,
    setOrders,
    setPage,
    setPaymentMethod,
    setPaymentStatus,
    setSort,
    sort,
    statusSummary,
    toggleVisibleColumn,
    totalItems,
    totalPages,
    resetLookupView,
    saveLookupView,
    visibleColumns,
  }
}
