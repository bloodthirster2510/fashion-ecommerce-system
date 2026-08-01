import type {
  AdminOrderListSort,
  AdminOrderPaymentMethod,
  AdminOrderPaymentStatus,
} from '../orderAdminApi'
import type { OrderTab, PaymentSectionKey } from '../orderTypes'
import type { OrderTableColumnKey } from '../orderTypes'
import {
  allPaymentMethods,
  getPaymentSectionMethods,
  paymentMethodLabels,
  paymentStatusLabels,
} from '../orderPresentation'
import { orderTableColumnOptions } from '../utils/orderTableColumns'

type OrderFilterBarProps = {
  activePaymentSectionKey: PaymentSectionKey
  activeTab: OrderTab
  dateFrom: string
  dateTo: string
  isActionLoading: boolean
  isExporting: boolean
  isLookupMode: boolean
  keywordInput: string
  paymentMethod: AdminOrderPaymentMethod | 'all'
  paymentStatus: AdminOrderPaymentStatus | 'all'
  sort: AdminOrderListSort
  visibleColumns: OrderTableColumnKey[]
  onKeywordInputChange: (value: string) => void
  onPaymentMethodChange: (value: AdminOrderPaymentMethod | 'all') => void
  onPaymentStatusChange: (value: AdminOrderPaymentStatus | 'all') => void
  onDateFromChange: (value: string) => void
  onDateToChange: (value: string) => void
  onSortChange: (value: AdminOrderListSort) => void
  onColumnToggle: (column: OrderTableColumnKey) => void
  onApplyDateRange: (daysAgo: number) => void
  onClearDateRange: () => void
  onExportCsv: () => void | Promise<void>
  onResetLookupView: () => void
  onSaveLookupView: () => void
}

export function OrderFilterBar({
  activePaymentSectionKey,
  activeTab,
  dateFrom,
  dateTo,
  isActionLoading,
  isExporting,
  isLookupMode,
  keywordInput,
  paymentMethod,
  paymentStatus,
  sort,
  visibleColumns,
  onKeywordInputChange,
  onPaymentMethodChange,
  onPaymentStatusChange,
  onDateFromChange,
  onDateToChange,
  onSortChange,
  onColumnToggle,
  onApplyDateRange,
  onClearDateRange,
  onExportCsv,
  onResetLookupView,
  onSaveLookupView,
}: OrderFilterBarProps) {
  const visibleColumnSet = new Set(visibleColumns)

  if (!isLookupMode) {
    return (
      <div className="admin-table-toolbar admin-order-operational-filter">
        <label className="admin-user-search">
          <span>Tìm trong hàng đợi</span>
          <input
            type="search"
            value={keywordInput}
            onChange={(event) => onKeywordInputChange(event.target.value)}
            placeholder="Mã đơn, mã hóa đơn hoặc sản phẩm"
          />
        </label>
        <button
          className="admin-secondary-button"
          type="button"
          disabled={isExporting || isActionLoading}
          onClick={() => void onExportCsv()}
        >
          {isExporting ? 'Đang xuất CSV...' : 'Xuất danh sách hiện tại'}
        </button>
      </div>
    )
  }

  return (
    <div className={`admin-table-toolbar${isLookupMode ? ' is-lookup' : ''}`}>
      <label className="admin-user-search">
        <span>Tìm kiếm</span>
        <input
          type="search"
          value={keywordInput}
          onChange={(event) => onKeywordInputChange(event.target.value)}
          placeholder="Mã đơn, mã hóa đơn hoặc sản phẩm"
        />
      </label>

      <label>
        <span>Kênh thanh toán đơn</span>
        <select
          value={!isLookupMode && activePaymentSectionKey === 'cod' ? 'COD' : paymentMethod}
          disabled={!isLookupMode && activePaymentSectionKey === 'cod'}
          onChange={(event) => onPaymentMethodChange(event.target.value as AdminOrderPaymentMethod | 'all')}
        >
          <option value="all">Tất cả kênh</option>
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
          onChange={(event) => onPaymentStatusChange(event.target.value as AdminOrderPaymentStatus | 'all')}
        >
          <option value="all">Tất cả</option>
          {Object.entries(paymentStatusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      {isLookupMode ? (
        <>
          <label>
            <span>Từ ngày</span>
            <input type="date" value={dateFrom} onChange={(event) => onDateFromChange(event.target.value)} />
          </label>

          <label>
            <span>Đến ngày</span>
            <input type="date" value={dateTo} onChange={(event) => onDateToChange(event.target.value)} />
          </label>

          <label>
            <span>Sắp xếp</span>
            <select value={sort} onChange={(event) => onSortChange(event.target.value as AdminOrderListSort)}>
              <option value="created_desc">Mới nhất</option>
              <option value="created_asc">Cũ nhất</option>
              <option value="total_desc">Tổng tiền cao</option>
              <option value="total_asc">Tổng tiền thấp</option>
              <option value="payment_deadline_asc">Hạn thanh toán gần nhất</option>
            </select>
          </label>

          <div className="admin-order-date-presets" aria-label="Khoảng ngày nhanh">
            <button className="admin-secondary-button" type="button" onClick={() => onApplyDateRange(0)}>
              Hôm nay
            </button>
            <button className="admin-secondary-button" type="button" onClick={() => onApplyDateRange(7)}>
              7 ngày
            </button>
            <button className="admin-secondary-button" type="button" onClick={() => onApplyDateRange(30)}>
              30 ngày
            </button>
            <button className="admin-secondary-button" type="button" onClick={onClearDateRange}>
              Tất cả
            </button>
          </div>

          <fieldset className="admin-order-column-toggle">
            <legend>Cột hiển thị</legend>
            {orderTableColumnOptions.map((column) => (
              <label key={column.key}>
                <input
                  type="checkbox"
                  checked={visibleColumnSet.has(column.key)}
                  onChange={() => onColumnToggle(column.key)}
                />
                <span>{column.label}</span>
              </label>
            ))}
          </fieldset>

          <div className="admin-order-saved-view-actions" aria-label="View tra cứu">
            <button
              className="admin-secondary-button"
              type="button"
              disabled={isExporting || isActionLoading}
              onClick={() => void onExportCsv()}
            >
              {isExporting ? 'Đang xuất CSV...' : 'Xuất CSV'}
            </button>
            <button className="admin-secondary-button" type="button" onClick={onSaveLookupView}>
              Lưu view
            </button>
            <button className="admin-secondary-button" type="button" onClick={onResetLookupView}>
              Khôi phục
            </button>
          </div>
        </>
      ) : null}
    </div>
  )
}
