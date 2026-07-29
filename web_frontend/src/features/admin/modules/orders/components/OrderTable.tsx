import type { AdminOrder } from '../orderAdminApi'
import type { OrderTableColumnKey } from '../orderTypes'
import { formatDate } from '../orderPresentation'
import { getOrderRowClass } from '../utils/orderQueue'
import { defaultOrderTableColumns } from '../utils/orderTableColumns'
import {
  OrderFulfillmentCell,
  OrderReferenceCell,
  OrderTotalCell,
} from './OrderStatusCells'

type OrderTableProps = {
  orders: AdminOrder[]
  isLoading: boolean
  realtimeOrderId: string | null
  selectedOrderIds: string[]
  visibleColumns?: OrderTableColumnKey[]
  onCopyReference: (value: string, label: string) => void | Promise<void>
  onOpenOrder: (order: AdminOrder) => void
  onPageSelectionChange: (selected: boolean) => void
  onSelectionChange: (orderId: string, selected: boolean) => void
}

export function OrderTable({
  orders,
  isLoading,
  realtimeOrderId,
  selectedOrderIds,
  visibleColumns = defaultOrderTableColumns,
  onCopyReference,
  onOpenOrder,
  onPageSelectionChange,
  onSelectionChange,
}: OrderTableProps) {
  const visibleColumnSet = new Set(visibleColumns)
  const selectedOrderIdSet = new Set(selectedOrderIds)
  const allPageOrdersSelected = orders.length > 0 && orders.every((order) => selectedOrderIdSet.has(order._id))
  const tableColumnCount = 3 + visibleColumns.length

  return (
    <div className="admin-table-shell">
      <table className="admin-table admin-orders-table">
        <thead>
          <tr>
            <th className="admin-order-check-cell">
              <input
                type="checkbox"
                aria-label="Chọn tất cả đơn hàng trên trang"
                checked={allPageOrdersSelected}
                disabled={isLoading || orders.length === 0}
                onChange={(event) => onPageSelectionChange(event.target.checked)}
              />
            </th>
            <th>Đơn hàng</th>
            {visibleColumnSet.has('customer') ? <th>Khách hàng</th> : null}
            {visibleColumnSet.has('total') ? <th>Tổng tiền</th> : null}
            {visibleColumnSet.has('status') ? <th>Trạng thái</th> : null}
            {visibleColumnSet.has('createdAt') ? <th>Ngày tạo</th> : null}
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={tableColumnCount}>
                <div className="admin-table-loading">Đang tải đơn hàng...</div>
              </td>
            </tr>
          ) : null}

          {!isLoading && orders.length === 0 ? (
            <tr>
              <td colSpan={tableColumnCount}>
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
                  <td className="admin-order-check-cell">
                    <input
                      type="checkbox"
                      aria-label={`Chọn đơn ${order.orderCode}`}
                      checked={selectedOrderIdSet.has(order._id)}
                      onChange={(event) => onSelectionChange(order._id, event.target.checked)}
                    />
                  </td>
                  <td>
                    <OrderReferenceCell order={order} onCopyReference={onCopyReference} />
                  </td>
                  {visibleColumnSet.has('customer') ? (
                    <td>
                    <div className="admin-contact-cell">
                      <span>{order.shippingAddress.customerName}</span>
                      <small>{order.shippingAddress.phoneNumber}</small>
                    </div>
                    </td>
                  ) : null}
                  {visibleColumnSet.has('total') ? (
                    <td>
                      <OrderTotalCell order={order} />
                    </td>
                  ) : null}
                  {visibleColumnSet.has('status') ? (
                    <td>
                      <OrderFulfillmentCell order={order} />
                    </td>
                  ) : null}
                  {visibleColumnSet.has('createdAt') ? <td>{formatDate(order.createdAt)}</td> : null}
                  <td>
                    <button className="admin-link-button" type="button" onClick={() => onOpenOrder(order)}>
                      Chi tiết
                    </button>
                  </td>
                </tr>
              ))
            : null}
        </tbody>
      </table>
    </div>
  )
}
