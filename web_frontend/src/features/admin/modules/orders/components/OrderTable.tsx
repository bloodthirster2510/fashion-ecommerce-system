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
  visibleColumns?: OrderTableColumnKey[]
  onCopyReference: (value: string, label: string) => void | Promise<void>
  onOpenOrder: (order: AdminOrder) => void
}

export function OrderTable({
  orders,
  isLoading,
  realtimeOrderId,
  visibleColumns = defaultOrderTableColumns,
  onCopyReference,
  onOpenOrder,
}: OrderTableProps) {
  const visibleColumnSet = new Set(visibleColumns)
  const tableColumnCount = 2 + visibleColumns.length

  return (
    <div className="admin-table-shell">
      <table className="admin-table admin-orders-table">
        <thead>
          <tr>
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
