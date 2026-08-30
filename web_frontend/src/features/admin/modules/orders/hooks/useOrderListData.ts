import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatAdminDateInput } from '../../../utils/dateTime'
import {
  listOrders,
  type AdminOrder,
  type AdminOrderListSort,
  type AdminOrderPaymentMethod,
  type AdminOrderPaymentStatus,
  type AdminOrderStatus,
  type OrderListFilters,
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
import { defaultOrderTableColumns } from '../utils/orderTableColumns'

const getUrlLookupKeyword = () =>
  new URLSearchParams(window.location.search).get('keyword')?.trim() ?? ''

const getDefaultLookupDateFrom = () => getRelativeDateInput(30)

const formatDateInput = (date: Date) => {
  return formatAdminDateInput(date)
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
  const initialKeyword = !lockPaymentSection ? getUrlLookupKeyword() : ''
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [keywordInput, setKeywordInput] = useState(initialKeyword)
  const [keyword, setKeyword] = useState(initialKeyword.trim())
  const [activePaymentSectionKey, setActivePaymentSectionKey] = useState<PaymentSectionKey>(paymentSection)
  const [activeTabKey, setActiveTabKey] = useState(() => (
    resolveInitialTabKey(initialTabKey, lockPaymentSection, paymentSection)
  ))
  const [paymentMethod, setPaymentMethod] = useState<AdminOrderPaymentMethod | 'all'>('all')
  const [paymentStatus, setPaymentStatus] = useState<AdminOrderPaymentStatus | 'all'>('all')
  const [dateFrom, setDateFrom] = useState(() => (lockPaymentSection ? '' : getDefaultLookupDateFrom()))
  const [dateTo, setDateTo] = useState('')
  const [sort, setSort] = useState<AdminOrderListSort>('created_desc')
  const [visibleColumns, setVisibleColumns] = useState<OrderTableColumnKey[]>(defaultOrderTableColumns)
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
  const pageTitle = lockPaymentSection ? activePaymentSection.label : 'Tra cứu đơn hàng & hóa đơn'
  const pageHelper = lockPaymentSection ? activePaymentSection.helper : 'Tìm theo mã đơn, mã hóa đơn, khách hàng hoặc sản phẩm'

  const activeFilters = useMemo<OrderListFilters>(() => {
    const sectionPaymentMethods = isLookupMode ? undefined : getPaymentSectionMethods(activePaymentSectionKey)
    const selectedPaymentMethod = !isLookupMode && activePaymentSectionKey === 'cod' ? 'COD' : paymentMethod

    return {
      keyword,
      queue: activeTab.queue,
      statuses: activeTab.queue ? undefined : activeTab.statuses,
      paymentStatus,
      paymentMethod: selectedPaymentMethod === 'all' ? undefined : selectedPaymentMethod,
      paymentMethods: selectedPaymentMethod === 'all' ? sectionPaymentMethods : undefined,
      dateFrom: isLookupMode ? dateFrom || undefined : undefined,
      dateTo: isLookupMode ? dateTo || undefined : undefined,
      sort: isLookupMode ? sort : undefined,
      page,
      limit: pageSize,
    }
  }, [
    activePaymentSectionKey,
    activeTab.queue,
    activeTab.statuses,
    dateFrom,
    dateTo,
    isLookupMode,
    keyword,
    page,
    paymentMethod,
    paymentStatus,
    sort,
  ])

  useEffect(() => {
    const currentKeyword = !lockPaymentSection ? getUrlLookupKeyword() : ''

    setActivePaymentSectionKey(paymentSection)
    setPaymentMethod(lockPaymentSection && paymentSection === 'cod' ? 'COD' : 'all')
    setPaymentStatus('all')
    setKeywordInput(currentKeyword)
    setKeyword(currentKeyword.trim())
    setDateFrom(lockPaymentSection ? '' : getDefaultLookupDateFrom())
    setDateTo('')
    setSort('created_desc')
    setVisibleColumns(defaultOrderTableColumns)
    setActiveTabKey(resolveInitialTabKey(initialTabKey, lockPaymentSection, paymentSection))
    setPage(1)
  }, [initialTabKey, lockPaymentSection, paymentSection])

  const loadOrders = useCallback(async (options: { quiet?: boolean } = {}) => {
    const quiet = options.quiet ?? false
    if (!quiet) {
      setIsLoading(true)
      setErrorMessage('')
    }

    try {
      const result = await listOrders(activeFilters)

      setOrders(result.items)
      setTotalItems(Math.max(0, result.pagination?.totalItems ?? result.items.length))
      setTotalPages(Math.max(1, result.pagination?.totalPages ?? 1))
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
  }, [activeFilters, setOrders])

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

  const resetLookupFilters = () => {
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
    activeFilters,
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
    resetLookupFilters,
    visibleColumns,
  }
}
