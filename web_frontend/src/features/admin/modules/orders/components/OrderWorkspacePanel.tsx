import type { Dispatch, SetStateAction } from 'react'
import { Pagination } from '../../../components/ui'
import type {
  AdminOrder,
  AdminOrderListSort,
  AdminOrderPaymentMethod,
  AdminOrderPaymentStatus,
  AdminOrderStatus,
} from '../orderAdminApi'
import type { Notice, OrderTab, PaymentSectionKey } from '../orderTypes'
import type { OrderTableColumnKey } from '../orderTypes'
import { emptyOperationalSummary } from '../orderPresentation'
import { OrderFilterBar } from './OrderFilterBar'
import { OrderBulkToolbar } from './OrderBulkToolbar'
import { OrderPaymentSectionTabs } from './OrderPaymentSectionTabs'
import { OrderQueueTabs } from './OrderQueueTabs'
import { OrdersPageHeader } from './OrdersPageHeader'
import { OrderTable } from './OrderTable'

type OrderWorkspacePanelProps = {
  activePaymentSectionKey: PaymentSectionKey
  activeTab: OrderTab
  activeTabKey: string
  availableBulkStatuses: AdminOrderStatus[]
  bulkReason: string
  bulkStatus: AdminOrderStatus
  canBulkCreateGhn: boolean
  canBulkSyncGhn: boolean
  canExpirePayments: boolean
  canUpdateOrders: boolean
  dateFrom: string
  dateTo: string
  errorMessage: string
  initialTabKey?: string
  isActionLoading: boolean
  isBulkLoading: boolean
  isExporting: boolean
  isLoading: boolean
  isLookupMode: boolean
  keywordInput: string
  labelCount: number
  notice: Notice | null
  operationalSummary: typeof emptyOperationalSummary
  orders: AdminOrder[]
  page: number
  pageHelper: string
  pageTitle: string
  paymentMethod: AdminOrderPaymentMethod | 'all'
  paymentStatus: AdminOrderPaymentStatus | 'all'
  realtimeOrderId: string | null
  selectedOrderIds: string[]
  sort: AdminOrderListSort
  statusSummary: Record<AdminOrderStatus | 'all', number>
  totalItems: number
  totalPages: number
  visibleColumns: OrderTableColumnKey[]
  onApplyDateRange: (daysAgo: number) => void
  onBulkGhn: (action: 'create' | 'sync') => void | Promise<void>
  onBulkReasonChange: (reason: string) => void
  onBulkStatusChange: (status: AdminOrderStatus) => void
  onBulkStatusUpdate: () => void | Promise<void>
  onClearSelection: () => void
  onColumnToggle: (column: OrderTableColumnKey) => void
  onClearDateRange: () => void
  onCopyReference: (value: string, label: string) => void | Promise<void>
  onDateFromChange: Dispatch<SetStateAction<string>>
  onDateToChange: Dispatch<SetStateAction<string>>
  onExpireStalePayments: () => void | Promise<void>
  onExportCsv: () => void | Promise<void>
  onKeywordInputChange: Dispatch<SetStateAction<string>>
  onOpenOrder: (order: AdminOrder) => void
  onOpenLabels: () => void
  onPageChange: Dispatch<SetStateAction<number>>
  onPaymentMethodChange: Dispatch<SetStateAction<AdminOrderPaymentMethod | 'all'>>
  onPaymentStatusChange: Dispatch<SetStateAction<AdminOrderPaymentStatus | 'all'>>
  onRefresh: (options?: { quiet?: boolean }) => void | Promise<void>
  onResetLookupView: () => void
  onSaveLookupView: () => void
  onPageSelectionChange: (selected: boolean) => void
  onSelectionChange: (orderId: string, selected: boolean) => void
  onSelectTab: Dispatch<SetStateAction<string>>
  onSortChange: Dispatch<SetStateAction<AdminOrderListSort>>
}

export function OrderWorkspacePanel({
  activePaymentSectionKey,
  activeTab,
  activeTabKey,
  availableBulkStatuses,
  bulkReason,
  bulkStatus,
  canBulkCreateGhn,
  canBulkSyncGhn,
  canExpirePayments,
  canUpdateOrders,
  dateFrom,
  dateTo,
  errorMessage,
  initialTabKey,
  isActionLoading,
  isBulkLoading,
  isExporting,
  isLoading,
  isLookupMode,
  keywordInput,
  labelCount,
  notice,
  operationalSummary,
  orders,
  page,
  pageHelper,
  pageTitle,
  paymentMethod,
  paymentStatus,
  realtimeOrderId,
  selectedOrderIds,
  sort,
  statusSummary,
  totalItems,
  totalPages,
  visibleColumns,
  onApplyDateRange,
  onBulkGhn,
  onBulkReasonChange,
  onBulkStatusChange,
  onBulkStatusUpdate,
  onClearSelection,
  onColumnToggle,
  onClearDateRange,
  onCopyReference,
  onDateFromChange,
  onDateToChange,
  onExpireStalePayments,
  onExportCsv,
  onKeywordInputChange,
  onOpenOrder,
  onOpenLabels,
  onPageChange,
  onPaymentMethodChange,
  onPaymentStatusChange,
  onRefresh,
  onResetLookupView,
  onSaveLookupView,
  onPageSelectionChange,
  onSelectionChange,
  onSelectTab,
  onSortChange,
}: OrderWorkspacePanelProps) {
  const resetPage = () => onPageChange(1)

  return (
    <>
      <OrdersPageHeader
        title={pageTitle}
        description={pageHelper}
        isLookupMode={isLookupMode}
        canExpirePayments={canExpirePayments}
        isActionLoading={isActionLoading}
        onExpireStalePayments={onExpireStalePayments}
        onRefresh={onRefresh}
      />

      {!isLookupMode ? (
        <OrderPaymentSectionTabs activePaymentSectionKey={activePaymentSectionKey} activeTabKey={activeTabKey} />
      ) : null}

      {!isLookupMode || initialTabKey ? (
        <OrderQueueTabs
          activeTabKey={activeTabKey}
          statusSummary={statusSummary}
          operationalSummary={operationalSummary}
          onSelectTab={(tab) => {
            onSelectTab(tab.key)
            onPaymentStatusChange('all')
            resetPage()
          }}
        />
      ) : null}

      <OrderFilterBar
        activePaymentSectionKey={activePaymentSectionKey}
        activeTab={activeTab}
        dateFrom={dateFrom}
        dateTo={dateTo}
        isActionLoading={isActionLoading || isBulkLoading}
        isExporting={isExporting}
        isLookupMode={isLookupMode}
        keywordInput={keywordInput}
        paymentMethod={paymentMethod}
        paymentStatus={paymentStatus}
        sort={sort}
        visibleColumns={visibleColumns}
        onKeywordInputChange={onKeywordInputChange}
        onPaymentMethodChange={(value) => {
          onPaymentMethodChange(value)
          resetPage()
        }}
        onPaymentStatusChange={(value) => {
          onPaymentStatusChange(value)
          resetPage()
        }}
        onDateFromChange={(value) => {
          onDateFromChange(value)
          resetPage()
        }}
        onDateToChange={(value) => {
          onDateToChange(value)
          resetPage()
        }}
        onSortChange={(value) => {
          onSortChange(value)
          resetPage()
        }}
        onColumnToggle={onColumnToggle}
        onApplyDateRange={onApplyDateRange}
        onClearDateRange={onClearDateRange}
        onExportCsv={onExportCsv}
        onResetLookupView={onResetLookupView}
        onSaveLookupView={onSaveLookupView}
      />

      <OrderBulkToolbar
        availableBulkStatuses={availableBulkStatuses}
        bulkReason={bulkReason}
        bulkStatus={bulkStatus}
        canBulkCreateGhn={canBulkCreateGhn}
        canBulkSyncGhn={canBulkSyncGhn}
        canUpdateOrders={canUpdateOrders}
        isBulkLoading={isBulkLoading}
        labelCount={labelCount}
        selectedCount={selectedOrderIds.length}
        onBulkGhn={onBulkGhn}
        onBulkReasonChange={onBulkReasonChange}
        onBulkStatusChange={onBulkStatusChange}
        onBulkStatusUpdate={onBulkStatusUpdate}
        onClearSelection={onClearSelection}
        onOpenLabels={onOpenLabels}
      />

      {notice ? (
        <div className={`admin-notice admin-order-notice is-${notice.type}`} role="status">
          <span>{notice.message}</span>
          {notice.action ? (
            <button className="admin-link-button" type="button" onClick={notice.action.onClick}>
              {notice.action.label}
            </button>
          ) : null}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="admin-empty-state" role="alert">
          <strong>Không tải được đơn hàng</strong>
          <span>{errorMessage}</span>
          <button className="admin-secondary-button" type="button" onClick={() => void onRefresh()}>
            Thử lại
          </button>
        </div>
      ) : (
        <OrderTable
          orders={orders}
          isLoading={isLoading}
          realtimeOrderId={realtimeOrderId}
          selectedOrderIds={selectedOrderIds}
          visibleColumns={isLookupMode ? visibleColumns : undefined}
          onCopyReference={onCopyReference}
          onOpenOrder={onOpenOrder}
          onPageSelectionChange={onPageSelectionChange}
          onSelectionChange={onSelectionChange}
        />
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        totalItems={totalItems}
        isDisabled={isLoading}
        onPageChange={onPageChange}
      />
    </>
  )
}
