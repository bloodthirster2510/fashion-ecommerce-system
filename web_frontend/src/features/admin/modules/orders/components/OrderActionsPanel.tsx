import type { AdminOrder, AdminOrderStatus } from '../orderAdminApi'
import {
  getPaymentPillClass,
  getNoNextOrderStepMessage,
  getStatusActionLabel,
  paymentStatusLabels,
} from '../orderPresentation'
import { isStatusBlockedByPayment } from '../utils/orderQueue'
import { OrderStatusPill } from './OrderStatusPill'

export function OrderActionsPanel({
  canUpdateOrders,
  isActionLoading,
  order,
  statusOptions,
  onStatusUpdate,
}: {
  canUpdateOrders: boolean
  isActionLoading: boolean
  order: AdminOrder
  statusOptions: AdminOrderStatus[]
  onStatusUpdate: (status: AdminOrderStatus) => void
}) {
  const processingGuidance = (() => {
    if (order.status === 'confirmed') {
      if (order.paymentMethod === 'COD') {
        return 'Đơn COD sẽ thu tiền khi giao. Kiểm tra sản phẩm rồi xác nhận đóng gói.'
      }

      if (order.paymentStatus !== 'paid') {
        return 'Chưa ghi nhận thanh toán online. Đối soát thanh toán trước khi xác nhận đóng gói.'
      }

      return 'Đã ghi nhận thanh toán. Kiểm tra sản phẩm rồi xác nhận đóng gói.'
    }

    if (order.status === 'packed') {
      return 'Đơn đã đóng gói. Chuyển sang tab Giao hàng để tạo hoặc bàn giao vận đơn.'
    }

    return getNoNextOrderStepMessage(order)
  })()

  return (
    <section className="admin-drawer-section admin-order-section-summary admin-order-section-actions">
      <div className="admin-section-inline-heading">
        <h3>Thanh toán & xử lý đơn</h3>
        <div className="admin-order-process-statuses">
          <span className={getPaymentPillClass(order.paymentStatus)}>{paymentStatusLabels[order.paymentStatus]}</span>
          <OrderStatusPill order={order} />
        </div>
      </div>
      <p className="admin-order-process-guidance">{processingGuidance}</p>
      {statusOptions.length ? (
        <div className="admin-drawer-actions">
          {statusOptions.map((status) => {
            const blockedByPayment = isStatusBlockedByPayment(order, status)

            return (
              <button
                className={status === 'cancelled' ? 'admin-danger-button' : 'admin-primary-button'}
                key={status}
                type="button"
                disabled={!canUpdateOrders || isActionLoading || blockedByPayment}
                title={blockedByPayment ? 'Đơn online cần thanh toán trước khi xử lý.' : undefined}
                onClick={() => onStatusUpdate(status)}
              >
                {isActionLoading ? 'Đang xử lý...' : getStatusActionLabel(status)}
              </button>
            )
          })}
        </div>
      ) : null}
      {!canUpdateOrders ? (
        <p className="admin-permission-note">Tài khoản này chỉ có quyền xem đơn hàng.</p>
      ) : null}
    </section>
  )
}
