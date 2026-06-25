import { useCallback, useEffect, useState } from 'react'
import {
  adjustOrderPaymentStatus,
  cancelGhnShipment,
  createGhnShipment,
  expireStalePayments,
  getOrder,
  listAuditLogs,
  listCustomerPaymentMethods,
  listOrderTransactions,
  listOrders,
  revealCustomerPaymentMethodAccount,
  reviewReturnRequest,
  simulateShippingWebhook,
  syncGhnShipment,
  updateCustomerPaymentMethodStatus,
  updateOrderShipping,
  updateOrderStatus,
  type AdminAuditLog,
  type AdminCustomerPaymentMethod,
  type AdminOrder,
  type AdminOrderPaymentMethod,
  type AdminOrderPaymentStatus,
  type AdminOrderStatus,
  type AdminPaymentMethodStatus,
  type AdminReturnReviewDecision,
  type AdminTransaction,
} from './orderAdminApi'
import './order.css'
import { requestAdminNotificationRefresh } from '../../notifications/notification-summary-events'
import { useOrderRealtime } from './orderRealtime'
import { OrderActionDialog } from './OrderActionDialog'
import { OrderDetailDrawer } from './OrderDetailDrawer'
import type {
  Notice,
  OrderActionDialogInput,
  OrderActionDialogState,
  OrdersPageProps,
  PaymentSectionKey,
  ShippingSimulationStatus,
  ShippingUpdateDialogValues,
} from './orderTypes'
import {
  allPaymentMethods,
  canSimulateShippingStatus,
  emptyOperationalSummary,
  emptyStatusSummary,
  formatCurrency,
  formatDate,
  formatShippingProvider,
  formatShippingStatus,
  getErrorMessage,
  getOrderAttention,
  getOrderAttentionClass,
  getOrderAttentionRank,
  getOrderPillClass,
  getOrderQueue,
  getOrderRowClass,
  getPaymentDeadlineStatus,
  getPaymentPillClass,
  getPaymentSectionMethods,
  getShippingPillClass,
  getShippingSimulationActionLabel,
  getShippingUpdateDialogValues,
  getTabClass,
  getTabCount,
  OrderProgressRail,
  orderTabGroups,
  orderTabs,
  pageSize,
  paymentMethodLabels,
  paymentSections,
  paymentStatusLabels,
  resolveInitialTabKey,
  shippingSimulationActions,
  statusLabels,
} from './orderPresentation'

const writeClipboardText = async (value: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  const textArea = document.createElement('textarea')
  textArea.value = value
  textArea.setAttribute('readonly', '')
  textArea.style.position = 'fixed'
  textArea.style.opacity = '0'
  document.body.appendChild(textArea)
  textArea.select()

  try {
    document.execCommand('copy')
  } finally {
    document.body.removeChild(textArea)
  }
}

export function OrderListPage({
  currentUser,
  paymentSection = 'online',
  lockPaymentSection = false,
  initialTabKey,
}: OrdersPageProps) {
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null)
  const [transactions, setTransactions] = useState<AdminTransaction[]>([])
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([])
  const [customerPaymentMethods, setCustomerPaymentMethods] = useState<AdminCustomerPaymentMethod[]>([])
  const [revealedRefundAccounts, setRevealedRefundAccounts] = useState<Record<string, string>>({})
  const [keywordInput, setKeywordInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [activePaymentSectionKey, setActivePaymentSectionKey] = useState<PaymentSectionKey>(paymentSection)
  const [activeTabKey, setActiveTabKey] = useState(() => resolveInitialTabKey(initialTabKey, lockPaymentSection))
  const [paymentMethod, setPaymentMethod] = useState<AdminOrderPaymentMethod | 'all'>('all')
  const [paymentStatus, setPaymentStatus] = useState<AdminOrderPaymentStatus | 'all'>('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [statusSummary, setStatusSummary] = useState<Record<AdminOrderStatus | 'all', number>>(emptyStatusSummary)
  const [operationalSummary, setOperationalSummary] = useState(emptyOperationalSummary)
  const [isLoading, setIsLoading] = useState(false)
  const [isDrawerLoading, setIsDrawerLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [notice, setNotice] = useState<Notice | null>(null)
  const [realtimeOrderId, setRealtimeOrderId] = useState<string | null>(null)
  const [actionDialog, setActionDialog] = useState<OrderActionDialogState | null>(null)
  const [actionDialogError, setActionDialogError] = useState('')

  const isLookupMode = !lockPaymentSection
  const activeTab = orderTabs.find((tab) => tab.key === activeTabKey) ?? orderTabs[0]
  const activePaymentSection =
    paymentSections.find((section) => section.key === activePaymentSectionKey) ?? paymentSections[0]
  const pageTitle = lockPaymentSection ? activePaymentSection.label : 'Tra cứu hóa đơn & đơn hàng'
  const pageHelper = lockPaymentSection ? activePaymentSection.helper : 'Tìm theo mã đơn, mã hóa đơn, khách hàng hoặc sản phẩm'
  const canUpdateOrders =
    currentUser.role === 'admin' || Boolean(currentUser.permissions?.includes('orders.update'))
  const canAdjustPayments =
    currentUser.role === 'admin' || Boolean(currentUser.permissions?.includes('payments.adjust'))
  const canReadCustomerPaymentMethods =
    currentUser.role === 'admin' ||
    Boolean(
      currentUser.permissions?.includes('customers.read') ||
      currentUser.permissions?.includes('customers.manage'),
    )
  const canManageCustomerPaymentMethods =
    currentUser.role === 'admin' || Boolean(currentUser.permissions?.includes('customers.manage'))

  const copyReference = useCallback(async (value: string, label: string) => {
    if (!value) return

    try {
      await writeClipboardText(value)
    } catch {
      setNotice({ type: 'error', message: `Không thể sao chép ${label}.` })
    }
  }, [])

  const handleRevealRefundAccount = useCallback(async (method: AdminCustomerPaymentMethod) => {
    if (!canAdjustPayments) {
      setNotice({ type: 'error', message: 'Cần quyền payments.adjust để xem số tài khoản hoàn tiền.' })
      return
    }

    if (!method.hasStoredAccountNumber) {
      setNotice({ type: 'error', message: 'Tài khoản này chưa lưu số đầy đủ. Khách cần cập nhật lại tài khoản nhận hoàn tiền.' })
      return
    }

    setActionLoading(true)
    setNotice(null)

    try {
      const result = await revealCustomerPaymentMethodAccount(method._id)
      setRevealedRefundAccounts((current) => ({
        ...current,
        [method._id]: result.accountNumber,
      }))
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setActionLoading(false)
    }
  }, [canAdjustPayments])

  useEffect(() => {
    setActivePaymentSectionKey(paymentSection)
    setPaymentMethod(paymentSection === 'cod' ? 'COD' : 'all')
    setPaymentStatus('all')
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
  }, [activePaymentSectionKey, activeTab.paymentStatus, activeTab.queue, activeTab.statuses, isLookupMode, keyword, page, paymentMethod, paymentStatus])

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

  const refreshSelectedOrder = async (orderId: string) => {
    setIsDrawerLoading(true)

    try {
      const orderDetail = await getOrder(orderId)
      const [orderTransactions, paymentMethods, orderAuditLogs] = await Promise.all([
        listOrderTransactions(orderId),
        canReadCustomerPaymentMethods
          ? listCustomerPaymentMethods(orderDetail.user_id).catch(() => [])
          : Promise.resolve([]),
        listAuditLogs({ targetType: 'Order', targetId: orderId, limit: 20 }),
      ])
      setSelectedOrder(orderDetail)
      setTransactions(orderTransactions)
      setCustomerPaymentMethods(paymentMethods)
      setAuditLogs(orderAuditLogs.items)
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setIsDrawerLoading(false)
    }
  }

  useOrderRealtime((event) => {
    setRealtimeOrderId(event.orderId)
    void loadOrders({ quiet: true })
    requestAdminNotificationRefresh()
    if (selectedOrder?._id === event.orderId) void refreshSelectedOrder(event.orderId)

    const nextStatus = event.after?.shippingStatus ?? event.after?.status
    setNotice({
      type: 'success',
      message: `Đơn ${event.orderCode} vừa cập nhật${nextStatus ? `: ${nextStatus}` : ''}`,
    })
  })

  useEffect(() => {
    if (!realtimeOrderId) return
    const handle = window.setTimeout(() => setRealtimeOrderId(null), 5_000)
    return () => window.clearTimeout(handle)
  }, [realtimeOrderId])

  useEffect(() => {
    const poll = () => {
      if (document.visibilityState === 'visible') void loadOrders({ quiet: true })
    }
    const handle = window.setInterval(poll, 15_000)
    window.addEventListener('focus', poll)
    return () => {
      window.clearInterval(handle)
      window.removeEventListener('focus', poll)
    }
  }, [loadOrders])

  const openOrder = (order: AdminOrder) => {
    setSelectedOrder(order)
    setTransactions([])
    setAuditLogs([])
    setCustomerPaymentMethods([])
    setRevealedRefundAccounts({})
    setNotice(null)
    void refreshSelectedOrder(order._id)
  }

  const openActionDialog = (dialog: OrderActionDialogState) => {
    setActionDialogError('')
    setActionDialog(dialog)
  }

  const closeActionDialog = () => {
    if (!actionLoading) {
      setActionDialog(null)
      setActionDialogError('')
    }
  }

  const closeDrawer = () => {
    if (!actionLoading) {
      setSelectedOrder(null)
      setTransactions([])
      setAuditLogs([])
      setCustomerPaymentMethods([])
      setRevealedRefundAccounts({})
      setActionDialog(null)
      setActionDialogError('')
    }
  }

  const handleStatusUpdate = async (nextStatus: AdminOrderStatus) => {
    if (!selectedOrder) return

    if (nextStatus === 'cancelled' || nextStatus === 'delivered') {
      openActionDialog({ type: 'status', order: selectedOrder, nextStatus })
      return
    }

    await executeStatusUpdate(selectedOrder, nextStatus)
  }

  const executeStatusUpdate = async (
    order: AdminOrder,
    nextStatus: AdminOrderStatus,
    reason?: string,
  ) => {
    setActionDialog(null)
    setActionDialogError('')

    setActionLoading(true)
    setNotice(null)

    try {
      const updatedOrder = await updateOrderStatus(order._id, nextStatus, reason?.trim())
      setSelectedOrder(updatedOrder)
      setOrders((currentOrders) =>
        currentOrders.map((order) => (order._id === updatedOrder._id ? updatedOrder : order)),
      )
      setNotice({
        type: 'success',
        message: nextStatus === 'delivered'
          ? 'Đã đánh dấu đơn giao tới khách'
          : nextStatus === 'completed'
            ? 'Đã đánh dấu khách đã nhận hàng'
          : 'Đã cập nhật trạng thái đơn hàng',
      })
      await refreshSelectedOrder(updatedOrder._id)
      await loadOrders()
      requestAdminNotificationRefresh()
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setActionLoading(false)
    }
  }

  const handleReviewReturnRequest = async (decision: AdminReturnReviewDecision) => {
    if (!selectedOrder) return

    openActionDialog({ type: 'return-review', order: selectedOrder, decision })
  }

  const executeReviewReturnRequest = async (
    order: AdminOrder,
    decision: AdminReturnReviewDecision,
    reason?: string,
  ) => {
    const normalizedReason = (reason ?? '').trim()

    setActionDialog(null)
    setActionDialogError('')

    setActionLoading(true)
    setNotice(null)

    try {
      const updatedOrder = await reviewReturnRequest(
        order._id,
        decision,
        normalizedReason || undefined,
      )
      setSelectedOrder(updatedOrder)
      setOrders((currentOrders) =>
        currentOrders.map((order) => (order._id === updatedOrder._id ? updatedOrder : order)),
      )
      setNotice({
        type: 'success',
        message: decision === 'approved'
          ? 'Đã duyệt yêu cầu trả hàng'
          : 'Đã từ chối yêu cầu trả hàng',
      })
      await refreshSelectedOrder(updatedOrder._id)
      await loadOrders()
      requestAdminNotificationRefresh()
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setActionLoading(false)
    }
  }

  const handleShippingUpdate = async () => {
    if (!selectedOrder) return

    openActionDialog({
      type: 'shipping',
      order: selectedOrder,
      values: getShippingUpdateDialogValues(selectedOrder),
    })
  }

  const executeShippingUpdate = async (order: AdminOrder, values: ShippingUpdateDialogValues) => {
    const actualCostText = values.actualProviderCost.trim()
    const reason = values.reason.trim()

    const actualProviderCost = actualCostText ? Number(actualCostText) : null
    if (actualProviderCost !== null && (!Number.isFinite(actualProviderCost) || actualProviderCost < 0)) {
      setActionDialogError('Chi phí vận chuyển không hợp lệ')
      return
    }

    if (!reason) {
      setActionDialogError('Cần nhập lý do cập nhật vận chuyển')
      return
    }

    setActionDialog(null)
    setActionDialogError('')
    setActionLoading(true)
    setNotice(null)

    try {
      const updatedOrder = await updateOrderShipping(order._id, {
        provider: values.provider.trim() || null,
        trackingCode: values.trackingCode.trim() || null,
        labelUrl: values.labelUrl.trim() || null,
        status: values.status.trim() || null,
        actualProviderCost,
        reason,
      })
      setSelectedOrder(updatedOrder)
      setOrders((currentOrders) =>
        currentOrders.map((order) => (order._id === updatedOrder._id ? updatedOrder : order)),
      )
      setNotice({ type: 'success', message: 'Đã cập nhật thông tin vận đơn' })
      await refreshSelectedOrder(updatedOrder._id)
      await loadOrders()
      requestAdminNotificationRefresh()
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setActionLoading(false)
    }
  }

  const handleSimulateShippingStatus = async (nextShippingStatus: ShippingSimulationStatus) => {
    if (!selectedOrder) return

    if (!canSimulateShippingStatus(selectedOrder, nextShippingStatus)) {
      setNotice({ type: 'error', message: 'Trạng thái giao hàng chưa phù hợp với bước hiện tại của đơn.' })
      return
    }

    const simulationAction = shippingSimulationActions.find((action) => action.status === nextShippingStatus)
    const actionLabel = simulationAction
      ? getShippingSimulationActionLabel(selectedOrder, simulationAction)
      : formatShippingStatus(nextShippingStatus)
    const reason = `Mô phỏng đơn vị vận chuyển: ${actionLabel}`

    setActionLoading(true)
    setNotice(null)

    try {
      const updatedOrder = await simulateShippingWebhook(selectedOrder._id, {
        status: nextShippingStatus,
        reason,
        provider: selectedOrder.shipping?.provider ?? 'GHN',
        trackingCode: selectedOrder.shipping?.trackingCode ?? null,
      })

      setSelectedOrder(updatedOrder)
      setOrders((currentOrders) =>
        currentOrders.map((order) => (order._id === updatedOrder._id ? updatedOrder : order)),
      )
      setNotice({ type: 'success', message: `Đã nhận webhook vận chuyển: ${actionLabel}` })
      await refreshSelectedOrder(updatedOrder._id)
      await loadOrders()
      requestAdminNotificationRefresh()
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setActionLoading(false)
    }
  }

  const handleCreateGhnShipment = async () => {
    if (!selectedOrder) return

    setActionLoading(true)
    setNotice(null)

    try {
      const updatedOrder = await createGhnShipment(selectedOrder._id)
      setSelectedOrder(updatedOrder)
      setOrders((currentOrders) =>
        currentOrders.map((order) => (order._id === updatedOrder._id ? updatedOrder : order)),
      )
      setNotice({ type: 'success', message: 'Đã tạo vận đơn GHN và liên kết vào đơn hàng' })
      await refreshSelectedOrder(updatedOrder._id)
      await loadOrders()
      requestAdminNotificationRefresh()
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancelGhnShipment = async () => {
    if (!selectedOrder) return

    openActionDialog({ type: 'cancel-ghn', order: selectedOrder })
  }

  const executeCancelGhnShipment = async (order: AdminOrder) => {
    setActionDialog(null)
    setActionDialogError('')
    setActionLoading(true)
    setNotice(null)

    try {
      const updatedOrder = await cancelGhnShipment(order._id, 'Admin cancelled GHN shipment')
      setSelectedOrder(updatedOrder)
      setOrders((currentOrders) =>
        currentOrders.map((order) => (order._id === updatedOrder._id ? updatedOrder : order)),
      )
      setNotice({ type: 'success', message: 'Đã hủy vận đơn GHN' })
      await refreshSelectedOrder(updatedOrder._id)
      await loadOrders()
      requestAdminNotificationRefresh()
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setActionLoading(false)
    }
  }

  const handleSyncGhnShipment = async () => {
    if (!selectedOrder) return

    setActionLoading(true)
    setNotice(null)

    try {
      const updatedOrder = await syncGhnShipment(selectedOrder._id)
      setSelectedOrder(updatedOrder)
      setOrders((currentOrders) =>
        currentOrders.map((order) => (order._id === updatedOrder._id ? updatedOrder : order)),
      )
      setNotice({ type: 'success', message: 'Đã đồng bộ trạng thái GHN' })
      await refreshSelectedOrder(updatedOrder._id)
      await loadOrders()
      requestAdminNotificationRefresh()
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setActionLoading(false)
    }
  }

  const handleExpireStalePayments = async () => {
    setActionLoading(true)
    setNotice(null)

    try {
      const result = await expireStalePayments()
      setNotice({
        type: 'success',
        message: `Đã hết hạn ${result.expiredCount} lượt thanh toán quá hạn. Đơn sẽ tự hủy khi quá 3 ngày.`,
      })
      await loadOrders()
      requestAdminNotificationRefresh()
      if (selectedOrder) {
        await refreshSelectedOrder(selectedOrder._id)
      }
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setActionLoading(false)
    }
  }

  const handleAdjustPaymentStatus = async (nextStatus: AdminOrderPaymentStatus) => {
    if (!selectedOrder) return

    openActionDialog({ type: 'payment-status', order: selectedOrder, nextStatus })
  }

  const executeAdjustPaymentStatus = async (
    order: AdminOrder,
    nextStatus: AdminOrderPaymentStatus,
    reason: string,
  ) => {
    setActionDialog(null)
    setActionDialogError('')
    setActionLoading(true)
    setNotice(null)

    try {
      const updatedOrder = await adjustOrderPaymentStatus(order._id, nextStatus, reason.trim())
      setSelectedOrder(updatedOrder)
      setOrders((currentOrders) =>
        currentOrders.map((order) => (order._id === updatedOrder._id ? updatedOrder : order)),
      )
      setNotice({ type: 'success', message: 'Đã điều chỉnh trạng thái thanh toán' })
      await refreshSelectedOrder(updatedOrder._id)
      await loadOrders()
      requestAdminNotificationRefresh()
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setActionLoading(false)
    }
  }

  const handleUpdatePaymentMethodStatus = async (
    method: AdminCustomerPaymentMethod,
    nextStatus: AdminPaymentMethodStatus,
  ) => {
    if (!selectedOrder) return

    openActionDialog({ type: 'payment-method-status', order: selectedOrder, method, nextStatus })
  }

  const executeUpdatePaymentMethodStatus = async (
    order: AdminOrder,
    method: AdminCustomerPaymentMethod,
    nextStatus: AdminPaymentMethodStatus,
    reason: string,
  ) => {
    setActionDialog(null)
    setActionDialogError('')
    setActionLoading(true)
    setNotice(null)

    try {
      await updateCustomerPaymentMethodStatus(method._id, nextStatus, reason.trim())
      setNotice({ type: 'success', message: 'Đã cập nhật phương thức thanh toán của khách hàng' })
      await refreshSelectedOrder(order._id)
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setActionLoading(false)
    }
  }

  const handleSubmitActionDialog = (input: OrderActionDialogInput) => {
    if (!actionDialog) return

    if (actionDialog.type === 'status') {
      const reason = (input.reason ?? '').trim()
      if (actionDialog.nextStatus === 'cancelled' && !reason) {
        setActionDialogError('Cần nhập lý do hủy đơn')
        return
      }

      void executeStatusUpdate(actionDialog.order, actionDialog.nextStatus, reason || undefined)
      return
    }

    if (actionDialog.type === 'return-review') {
      const reason = (input.reason ?? '').trim()
      if (actionDialog.decision === 'rejected' && !reason) {
        setActionDialogError('Cần nhập lý do từ chối trả hàng')
        return
      }

      void executeReviewReturnRequest(actionDialog.order, actionDialog.decision, reason || undefined)
      return
    }

    if (actionDialog.type === 'shipping') {
      if (!input.shipping) return

      void executeShippingUpdate(actionDialog.order, input.shipping)
      return
    }

    if (actionDialog.type === 'cancel-ghn') {
      void executeCancelGhnShipment(actionDialog.order)
      return
    }

    const reason = (input.reason ?? '').trim()
    if (!reason) {
      setActionDialogError('Cần nhập lý do thao tác')
      return
    }

    if (reason.length < 5) {
      setActionDialogError('Lý do cần ít nhất 5 ký tự')
      return
    }

    if (actionDialog.type === 'payment-status') {
      void executeAdjustPaymentStatus(actionDialog.order, actionDialog.nextStatus, reason)
      return
    }

    void executeUpdatePaymentMethodStatus(
      actionDialog.order,
      actionDialog.method,
      actionDialog.nextStatus,
      reason,
    )
  }

  const renderOrderTabs = () => (
    <div className="admin-order-tab-groups" role="tablist" aria-label="Phân loại đơn hàng">
      {orderTabGroups.map((group) => {
        const tabs = orderTabs.filter((tab) => tab.group === group.key)

        return (
          <section className={`admin-order-tab-group is-${group.key}`} key={group.key}>
            <span className="admin-order-tab-group-label">{group.label}</span>
            <div className="admin-order-tabs">
              {tabs.map((tab) => {
                const tabCount = getTabCount(tab, statusSummary, operationalSummary)

                return (
                  <button
                    className={getTabClass(tab, activeTabKey)}
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={tab.key === activeTabKey}
                    onClick={() => {
                      setActiveTabKey(tab.key)
                      setPaymentStatus('all')
                      setPage(1)
                    }}
                  >
                    <span className="admin-order-tab-label">
                      <span>{tab.label}</span>
                      <span className="admin-order-tab-count" aria-label={`${tabCount} đơn`}>
                        {tabCount}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )

  return (
    <section className="admin-orders-page" aria-busy={isLoading}>
      <header className="admin-page-heading">
        <div>
          <p>{isLookupMode ? 'Tra cứu bán hàng' : 'Vận hành đơn hàng'}</p>
          <h1>{pageTitle}</h1>
          <span>{pageHelper}</span>
        </div>

        <div className="admin-page-actions">
          {!isLookupMode ? (
            <button
              className="admin-secondary-button"
              type="button"
              disabled={!canUpdateOrders || actionLoading}
              onClick={() => void handleExpireStalePayments()}
            >
              Hết hạn thanh toán quá hạn
            </button>
          ) : null}
          <button className="admin-secondary-button" type="button" onClick={() => void loadOrders()}>
            Tải lại
          </button>
        </div>
      </header>

      {!isLookupMode || initialTabKey ? (
        renderOrderTabs()
      ) : null}

      <div className="admin-table-toolbar">
        <label className="admin-user-search">
          <span>Tìm kiếm</span>
          <input
            type="search"
            value={keywordInput}
            onChange={(event) => setKeywordInput(event.target.value)}
            placeholder="Mã đơn, hóa đơn hoặc sản phẩm"
          />
        </label>

        <label>
          <span>Phương thức</span>
          <select
            value={!isLookupMode && activePaymentSectionKey === 'cod' ? 'COD' : paymentMethod}
            disabled={!isLookupMode && activePaymentSectionKey === 'cod'}
            onChange={(event) => {
              setPaymentMethod(event.target.value as AdminOrderPaymentMethod | 'all')
              setPage(1)
            }}
          >
            <option value="all">{isLookupMode ? 'Tất cả phương thức' : 'Tất cả online'}</option>
            {(isLookupMode ? allPaymentMethods : getPaymentSectionMethods(activePaymentSectionKey)).map((value) => (
              <option key={value} value={value}>
                {paymentMethodLabels[value]}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Trạng thái thanh toán</span>
          <select
            value={activeTab.paymentStatus ?? paymentStatus}
            disabled={Boolean(activeTab.paymentStatus)}
            onChange={(event) => {
              setPaymentStatus(event.target.value as AdminOrderPaymentStatus | 'all')
              setPage(1)
            }}
          >
            <option value="all">Tất cả</option>
            {Object.entries(paymentStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {notice ? (
        <p className={`admin-notice is-${notice.type}`} role="status">
          {notice.message}
        </p>
      ) : null}

      {errorMessage ? (
        <div className="admin-empty-state" role="alert">
          <strong>Không tải được đơn hàng</strong>
          <span>{errorMessage}</span>
          <button className="admin-secondary-button" type="button" onClick={() => void loadOrders()}>
            Thử lại
          </button>
        </div>
      ) : (
        <div className="admin-table-shell">
          <table className="admin-table admin-orders-table">
            <thead>
              <tr>
                <th>Đơn hàng</th>
                <th>Khách hàng</th>
                <th>Tổng tiền</th>
                <th>Thanh toán</th>
                <th>Trạng thái</th>
                <th>Giao hàng</th>
                <th>Ngày tạo</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8}>
                    <div className="admin-table-loading">Đang tải đơn hàng...</div>
                  </td>
                </tr>
              ) : null}

              {!isLoading && orders.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="admin-table-loading">Không có đơn hàng phù hợp.</div>
                  </td>
                </tr>
              ) : null}

              {!isLoading
                ? orders.map((order) => (
                    <tr
                      className={`${getOrderRowClass(order)}${realtimeOrderId === order._id ? ' is-realtime-updated' : ''}`}
                      key={order._id}
                    >
                      <td>
                        <div className="admin-order-code-cell">
                          <div className="admin-code-with-copy">
                            <strong>{order.orderCode}</strong>
                            <button
                              className="admin-copy-button"
                              type="button"
                              onClick={() => void copyReference(order.orderCode, 'mã đơn')}
                              aria-label="Sao chép mã đơn"
                            >
                              <CopyIcon />
                            </button>
                          </div>
                          {order.invoiceCode ? (
                            <div className="admin-code-with-copy is-subtle">
                              <span>{order.invoiceCode}</span>
                              <button
                                className="admin-copy-button"
                                type="button"
                                onClick={() => void copyReference(order.invoiceCode ?? '', 'mã hóa đơn')}
                                aria-label="Sao chép mã hóa đơn"
                              >
                                <CopyIcon />
                              </button>
                            </div>
                          ) : (
                            <span>Chưa có hóa đơn</span>
                          )}
                          {getOrderAttention(order) ? (
                            <em className={getOrderAttentionClass(order)}>
                              {getOrderAttention(order)?.label}
                            </em>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <div className="admin-contact-cell">
                          <span>{order.shippingAddress.customerName}</span>
                          <small>{order.shippingAddress.phoneNumber}</small>
                        </div>
                      </td>
                      <td>
                        <strong>{formatCurrency(order.totalAmount)}</strong>
                        <span>{order.order_list.length} sản phẩm</span>
                      </td>
                      <td>
                        <div className="admin-order-payment-cell">
                          <strong>{paymentMethodLabels[order.paymentMethod]}</strong>
                          <span className={getPaymentPillClass(order.paymentStatus)}>
                            {paymentStatusLabels[order.paymentStatus]}
                          </span>
                          {getPaymentDeadlineStatus(order) ? (
                            <small className={getPaymentDeadlineStatus(order)?.className}>
                              {getPaymentDeadlineStatus(order)?.label}
                            </small>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <div className="admin-order-status-cell">
                          <span className={getOrderPillClass(order.status)}>
                            {statusLabels[order.status]}
                          </span>
                          <OrderProgressRail
                            compact
                            shippingStatus={order.shipping?.status}
                            status={order.status}
                          />
                        </div>
                      </td>
                      <td>
                        <div className="admin-shipping-cell">
                          <strong>{formatShippingProvider(order.shipping?.provider)}</strong>
                          <span className={getShippingPillClass(order.shipping?.status)}>
                            {order.shipping?.trackingCode || formatShippingStatus(order.shipping?.status)}
                          </span>
                        </div>
                      </td>
                      <td>{formatDate(order.createdAt)}</td>
                      <td>
                        <button className="admin-link-button" type="button" onClick={() => openOrder(order)}>
                          Chi tiết
                        </button>
                      </td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>
      )}

      <footer className="admin-table-footer">
        <span>
          Trang {page} / {totalPages}
        </span>
        <div>
          <button
            className="admin-secondary-button"
            type="button"
            disabled={page <= 1 || isLoading}
            onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
          >
            Trước
          </button>
          <button
            className="admin-secondary-button"
            type="button"
            disabled={page >= totalPages || isLoading}
            onClick={() => setPage((currentPage) => Math.min(totalPages, currentPage + 1))}
          >
            Sau
          </button>
        </div>
      </footer>

      {selectedOrder ? (
        <OrderDetailDrawer
          canAdjustPayments={canAdjustPayments}
          canManageCustomerPaymentMethods={canManageCustomerPaymentMethods}
          canReadCustomerPaymentMethods={canReadCustomerPaymentMethods}
          canUpdateOrders={canUpdateOrders}
          revealedRefundAccounts={revealedRefundAccounts}
          isActionLoading={actionLoading}
          isLoading={isDrawerLoading}
          auditLogs={auditLogs}
          order={selectedOrder}
          paymentMethods={customerPaymentMethods}
          transactions={transactions}
          onClose={closeDrawer}
          onAdjustPaymentStatus={(status) => void handleAdjustPaymentStatus(status)}
          onCancelGhnShipment={() => void handleCancelGhnShipment()}
          onCreateGhnShipment={() => void handleCreateGhnShipment()}
          onUpdatePaymentMethodStatus={(method, status) => void handleUpdatePaymentMethodStatus(method, status)}
          onRefresh={() => void refreshSelectedOrder(selectedOrder._id)}
          onReviewReturnRequest={(decision) => void handleReviewReturnRequest(decision)}
          onShippingUpdate={() => void handleShippingUpdate()}
          onSimulateShippingStatus={(status) => void handleSimulateShippingStatus(status)}
          onSyncGhnShipment={() => void handleSyncGhnShipment()}
          onStatusUpdate={(status) => void handleStatusUpdate(status)}
          onCopyReference={copyReference}
          onRevealRefundAccount={(method) => void handleRevealRefundAccount(method)}
        />
      ) : null}

      {actionDialog ? (
        <OrderActionDialog
          action={actionDialog}
          errorMessage={actionDialogError}
          isLoading={actionLoading}
          onClose={closeActionDialog}
          onSubmit={handleSubmitActionDialog}
        />
      ) : null}
    </section>
  )
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 7V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2Zm2 0h4a2 2 0 0 1 2 2v6h2V5h-8v2Zm-4 2v10h8V9H6Z" />
    </svg>
  )
}
