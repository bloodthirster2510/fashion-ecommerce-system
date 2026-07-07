import { useCallback, useState } from 'react'
import './order.css'
import { OrderActionDialog } from './OrderActionDialog'
import { OrderDetailDrawer } from './OrderDetailDrawer'
import { OrderWorkspacePanel } from './components/OrderWorkspacePanel'
import { useOrderActions } from './hooks/useOrderActions'
import { useOrderDetailData } from './hooks/useOrderDetailData'
import { useOrderListData } from './hooks/useOrderListData'
import { useOrderRealtimeRefresh } from './hooks/useOrderRealtimeRefresh'
import type {
  Notice,
  OrdersPageProps,
} from './orderTypes'

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
  paymentSection = 'all',
  lockPaymentSection = false,
  initialTabKey,
}: OrdersPageProps) {
  const {
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
  } = useOrderListData({
    initialTabKey,
    lockPaymentSection,
    paymentSection,
  })
  const [notice, setNotice] = useState<Notice | null>(null)

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

  const {
    auditLogs,
    customerPaymentMethods,
    isDrawerLoading,
    openOrder,
    openOrderById,
    refreshSelectedOrder,
    resetOrderDetail,
    revealedRefundAccounts,
    selectedOrder,
    setRevealedRefundAccounts,
    setSelectedOrder,
    transactions,
  } = useOrderDetailData({
    canReadCustomerPaymentMethods,
    setNotice,
  })
  const realtimeOrderId = useOrderRealtimeRefresh({
    loadOrders,
    onOpenRealtimeOrder: openOrderById,
    refreshSelectedOrder,
    selectedOrderId: selectedOrder?._id,
    setNotice,
  })
  const {
    actionDialog,
    actionDialogError,
    actionLoading,
    closeActionDialog,
    handleAdjustPaymentStatus,
    handleCancelGhnShipment,
    handleCreateGhnShipment,
    handleExpireStalePayments,
    handleRevealRefundAccount,
    handleReviewReturnRequest,
    handleShippingUpdate,
    handleSimulateShippingStatus,
    handleStatusUpdate,
    handleSubmitActionDialog,
    handleSyncGhnShipment,
    handleUpdatePaymentMethodStatus,
  } = useOrderActions({
    canAdjustPayments,
    loadOrders,
    refreshSelectedOrder,
    selectedOrder,
    setNotice,
    setOrders,
    setRevealedRefundAccounts,
    setSelectedOrder,
  })

  const copyReference = useCallback(async (value: string, label: string) => {
    if (!value) return

    try {
      await writeClipboardText(value)
    } catch {
      setNotice({ type: 'error', message: `Không thể sao chép ${label}.` })
    }
  }, [])

  const closeDrawer = () => {
    if (!actionLoading) {
      resetOrderDetail()
      closeActionDialog()
    }
  }

  return (
    <section className="admin-orders-page" aria-busy={isLoading}>
      <OrderWorkspacePanel
        activePaymentSectionKey={activePaymentSectionKey}
        activeTab={activeTab}
        activeTabKey={activeTabKey}
        canExpirePayments={canUpdateOrders}
        dateFrom={dateFrom}
        dateTo={dateTo}
        errorMessage={errorMessage}
        initialTabKey={initialTabKey}
        isActionLoading={actionLoading}
        isLoading={isLoading}
        isLookupMode={isLookupMode}
        keywordInput={keywordInput}
        notice={notice}
        operationalSummary={operationalSummary}
        orders={orders}
        page={page}
        pageHelper={pageHelper}
        pageTitle={pageTitle}
        paymentMethod={paymentMethod}
        paymentStatus={paymentStatus}
        realtimeOrderId={realtimeOrderId}
        sort={sort}
        statusSummary={statusSummary}
        totalItems={totalItems}
        totalPages={totalPages}
        visibleColumns={visibleColumns}
        onApplyDateRange={applyLookupDateRange}
        onColumnToggle={toggleVisibleColumn}
        onClearDateRange={clearLookupDateRange}
        onCopyReference={copyReference}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onExpireStalePayments={handleExpireStalePayments}
        onKeywordInputChange={setKeywordInput}
        onOpenOrder={openOrder}
        onPageChange={setPage}
        onPaymentMethodChange={setPaymentMethod}
        onPaymentStatusChange={setPaymentStatus}
        onRefresh={loadOrders}
        onResetLookupView={resetLookupView}
        onSaveLookupView={saveLookupView}
        onSelectTab={setActiveTabKey}
        onSortChange={setSort}
      />

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
