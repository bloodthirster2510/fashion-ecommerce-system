import type { AdminOrder } from '../orderAdminApi'
import type { ShippingSimulationStatus } from '../orderTypes'
import {
  canCancelGhnShipment,
  canCreateGhnShipment,
  canSimulateShippingStatus,
  canSyncGhnShipment,
  formatCurrency,
  formatShippingProvider,
  formatShippingStatus,
  getAddressLine,
  getShippingPillClass,
  getShippingSimulationActionLabel,
  shippingSimulationActions,
} from '../orderPresentation'
import { Copy } from 'lucide-react'

type OrderShippingPanelProps = {
  canUpdateOrders: boolean
  isActionLoading: boolean
  order: AdminOrder
  onCancelGhnShipment: () => void
  onCopyReference: (value: string, label: string) => void
  onCreateGhnShipment: () => void
  onShippingUpdate: () => void
  onSimulateShippingStatus: (status: ShippingSimulationStatus) => void
  onSyncGhnShipment: () => void
}

export function OrderShippingPanel({
  canUpdateOrders,
  isActionLoading,
  order,
  onCancelGhnShipment,
  onCopyReference,
  onCreateGhnShipment,
  onShippingUpdate,
  onSimulateShippingStatus,
  onSyncGhnShipment,
}: OrderShippingPanelProps) {
  return (
    <section className="admin-drawer-section admin-order-section-main admin-order-section-shipping">
      <div className="admin-section-inline-heading">
        <h3>Khách hàng & giao hàng</h3>
        <button
          className="admin-link-button"
          type="button"
          disabled={!canUpdateOrders || isActionLoading}
          onClick={onShippingUpdate}
        >
          Cập nhật vận đơn
        </button>
      </div>
      <div className="admin-address-block">
        <strong>{order.shippingAddress.customerName}</strong>
        <span>{order.shippingAddress.phoneNumber}</span>
        <p>{getAddressLine(order)}</p>
      </div>
      <div className="admin-detail-grid">
        <div>
          <span>Đơn vị</span>
          <strong>{formatShippingProvider(order.shipping?.provider)}</strong>
        </div>
        <div>
          <span>Mã vận đơn</span>
          <strong className="admin-code-with-copy">
            <span>{order.shipping?.trackingCode || 'Chưa có'}</span>
            {order.shipping?.trackingCode ? (
              <button
                className="admin-copy-button"
                type="button"
                onClick={() => onCopyReference(order.shipping?.trackingCode ?? '', 'mã vận đơn')}
                aria-label="Sao chép mã vận đơn"
              >
                <Copy size={14} strokeWidth={2.4} />
              </button>
            ) : null}
          </strong>
        </div>
        <div>
          <span>Phí khách trả</span>
          <strong>{formatCurrency(order.shippingFee)}</strong>
        </div>
        <div>
          <span>Chi phí thực tế</span>
          <strong>{formatCurrency(order.shipping?.actualProviderCost ?? 0)}</strong>
        </div>
      </div>
      <div className="admin-shipping-simulator">
        <div className="admin-shipping-simulator-header">
          <span>Đối tác vận chuyển</span>
          <strong className={getShippingPillClass(order.shipping?.status)}>
            {formatShippingStatus(order.shipping?.status)}
          </strong>
        </div>
        {order.shipping?.status === 'failed' ? (
          <p className="admin-shipping-failed-note">
            Đơn vị vận chuyển báo giao không thành công. Admin có thể bấm Giao lại sau khi liên hệ khách, hoặc xử lý hoàn tiền/hỗ trợ theo chính sách.
          </p>
        ) : null}
        <div className="admin-ghn-actions">
          <button
            className="admin-primary-button"
            type="button"
            disabled={!canUpdateOrders || isActionLoading || !canCreateGhnShipment(order)}
            onClick={onCreateGhnShipment}
          >
            Tạo vận đơn GHN
          </button>
          <button
            className="admin-secondary-button"
            type="button"
            disabled={!canUpdateOrders || isActionLoading || !canSyncGhnShipment(order)}
            onClick={onSyncGhnShipment}
          >
            Đồng bộ GHN
          </button>
          <button
            className="admin-danger-button"
            type="button"
            disabled={!canUpdateOrders || isActionLoading || !canCancelGhnShipment(order)}
            onClick={onCancelGhnShipment}
          >
            Hủy vận đơn GHN
          </button>
        </div>
        <div className="admin-shipping-simulator-actions">
          {shippingSimulationActions.map((action) => (
            <button
              className={action.className}
              type="button"
              key={action.status}
              disabled={!canUpdateOrders || isActionLoading || !canSimulateShippingStatus(order, action.status)}
              onClick={() => onSimulateShippingStatus(action.status)}
            >
              {getShippingSimulationActionLabel(order, action)}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
