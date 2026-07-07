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
import { OrderQueueTabs } from './OrderQueueTabs'
import { OrdersPageHeader } from './OrdersPageHeader'
import { OrderTable } from './OrderTable'

type OrderWorkspacePanelProps = {
  activePaymentSectionKey: PaymentSectionKey
  activeTab: OrderTab
  activeTabKey: string
  canExpirePayments: boolean
  dateFrom: string
  dateTo: string
  errorMessage: string
  initialTabKey?: string
  isActionLoading: boolean
  isLoading: boolean
  isLookupMode: boolean
  keywordInput: string
  notice: Notice | null
  operationalSummary: typeof emptyOperationalSummary
  orders: AdminOrder[]
  page: number
  pageHelper: string
  pageTitle: string
  paymentMethod: AdminOrderPaymentMethod | 'all'
  paymentStatus: AdminOrderPaymentStatus | 'all'
  realtimeOrderId: string | null
  sort: AdminOrderListSort
  statusSummary: Record<AdminOrderStatus | 'all', number>
  totalItems: number
  totalPages: number
  visibleColumns: OrderTableColumnKey[]
  onApplyDateRange: (daysAgo: number) => void
  onColumnToggle: (column: OrderTableColumnKey) => void
  onClearDateRange: () => void
  onCopyReference: (value: string, label: string) => void | Promise<void>
  onDateFromChange: Dispatch<SetStateAction<string>>
  onDateToChange: Dispatch<SetStateAction<string>>
  onExpireStalePayments: () => void | Promise<void>
  onKeywordInputChange: Dispatch<SetStateAction<string>>
  onOpenOrder: (order: AdminOrder) => void
  onPageChange: Dispatch<SetStateAction<number>>
  onPaymentMethodChange: Dispatch<SetStateAction<AdminOrderPaymentMethod | 'all'>>
  onPaymentStatusChange: Dispatch<SetStateAction<AdminOrderPaymentStatus | 'all'>>
  onRefresh: (options?: { quiet?: boolean }) => void | Promise<void>
  onResetLookupView: () => void
  onSaveLookupView: () => void
  onSelectTab: Dispatch<SetStateAction<string>>
  onSortChange: Dispatch<SetStateAction<AdminOrderListSort>>
}

export function OrderWorkspacePanel({
  activePaymentSectionKey,
  activeTab,
  activeTabKey,
  canExpirePayments,
  dateFrom,
  dateTo,
  errorMessage,
  initialTabKey,
  isActionLoading,
  isLoading,
  isLookupMode,
  keywordInput,
  notice,
  operationalSummary,
  orders,
  page,
  pageHelper,
  pageTitle,
  paymentMethod,
  paymentStatus,
  realtimeOrderId,
  sort,
  statusSummary,
  totalItems,
  totalPages,
  visibleColumns,
  onApplyDateRange,
  onColumnToggle,
  onClearDateRange,
  onCopyReference,
  onDateFromChange,
  onDateToChange,
  onExpireStalePayments,
  onKeywordInputChange,
  onOpenOrder,
  onPageChange,
  onPaymentMethodChange,
  onPaymentStatusChange,
  onRefresh,
  onResetLookupView,
  onSaveLookupView,
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
        onResetLookupView={onResetLookupView}
        onSaveLookupView={onSaveLookupView}
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
          visibleColumns={isLookupMode ? visibleColumns : undefined}
          onCopyReference={onCopyReference}
          onOpenOrder={onOpenOrder}
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
