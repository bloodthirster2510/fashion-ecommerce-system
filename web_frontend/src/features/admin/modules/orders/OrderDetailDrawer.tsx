import { useEffect, useMemo, useState } from 'react'
import { Copy } from 'lucide-react'
import type {
  AdminAuditLog,
  AdminCustomerPaymentMethod,
  AdminOrder,
  AdminOrderPaymentStatus,
  AdminOrderStatus,
  AdminPaymentMethodStatus,
  AdminReturnReviewDecision,
  AdminTransaction,
} from './orderAdminApi'
import type { ShippingSimulationStatus } from './orderTypes'
import { OrderHistoryPanel } from './components/OrderHistoryPanel'
import { OrderLineItemsPanel } from './components/OrderLineItemsPanel'
import { OrderOverviewPanel } from './components/OrderOverviewPanel'
import { OrderPaymentPanel } from './components/OrderPaymentPanel'
import { OrderRefundMethodsPanel } from './components/OrderRefundMethodsPanel'
import { OrderReturnPanel } from './components/OrderReturnPanel'
import { OrderShippingPanel } from './components/OrderShippingPanel'
import {
  getOrderPillClass,
  getPaymentPillClass,
  getReturnWindowStatus,
  nextStatusOptions,
  paymentStatusLabels,
  statusLabels,
} from './orderPresentation'
import {
  getOrderAttention,
  getOrderRowClass,
  getPaymentDeadlineStatus,
  shouldWarnPaymentBeforeShipping,
} from './utils/orderQueue'

const AUDIT_LOG_PAGE_SIZE = 3
type OrderDrawerTab = 'overview' | 'items' | 'payment' | 'shipping' | 'return' | 'history'

const orderDrawerTabs: Array<{ key: OrderDrawerTab; label: string }> = [
  { key: 'overview', label: 'Tổng quan' },
  { key: 'items', label: 'Sản phẩm' },
  { key: 'payment', label: 'Thanh toán' },
  { key: 'shipping', label: 'Giao hàng' },
  { key: 'return', label: 'Trả/Hoàn' },
  { key: 'history', label: 'Nhật ký & xử lý' },
]

export function OrderDetailDrawer({
  canAdjustPayments,
  canManageCustomerPaymentMethods,
  canReadCustomerPaymentMethods,
  canUpdateOrders,
  isActionLoading,
  isLoading,
  auditLogs,
  order,
  paymentMethods,
  revealedRefundAccounts,
  transactions,
  onClose,
  onAdjustPaymentStatus,
  onCancelGhnShipment,
  onCreateGhnShipment,
  onUpdatePaymentMethodStatus,
  onRefresh,
  onReviewReturnRequest,
  onShippingUpdate,
  onSimulateShippingStatus,
  onSyncGhnShipment,
  onStatusUpdate,
  onCopyReference,
  onRevealRefundAccount,
}: {
  canAdjustPayments: boolean
  canManageCustomerPaymentMethods: boolean
  canReadCustomerPaymentMethods: boolean
  canUpdateOrders: boolean
  isActionLoading: boolean
  isLoading: boolean
  auditLogs: AdminAuditLog[]
  order: AdminOrder
  paymentMethods: AdminCustomerPaymentMethod[]
  revealedRefundAccounts: Record<string, string>
  transactions: AdminTransaction[]
  onClose: () => void
  onAdjustPaymentStatus: (status: AdminOrderPaymentStatus) => void
  onCancelGhnShipment: () => void
  onCreateGhnShipment: () => void
  onUpdatePaymentMethodStatus: (method: AdminCustomerPaymentMethod, status: AdminPaymentMethodStatus) => void
  onRefresh: () => void
  onReviewReturnRequest: (decision: AdminReturnReviewDecision) => void
  onShippingUpdate: () => void
  onSimulateShippingStatus: (status: ShippingSimulationStatus) => void
  onSyncGhnShipment: () => void
  onStatusUpdate: (status: AdminOrderStatus) => void
  onCopyReference: (value: string, label: string) => void
  onRevealRefundAccount: (method: AdminCustomerPaymentMethod) => void
}) {
  const [activeDrawerTab, setActiveDrawerTab] = useState<OrderDrawerTab>('overview')
  const [visibleAuditLogCount, setVisibleAuditLogCount] = useState(AUDIT_LOG_PAGE_SIZE)
  const statusOptions = nextStatusOptions[order.status] ?? []
  const hasPendingReturnRequest = order.status === 'return_requested' && order.returnRequest?.status === 'requested'
  const needsRefundHandling =
    order.paymentStatus === 'paid' && (order.status === 'cancelled' || order.status === 'returned')
  const attention = getOrderAttention(order)
  const returnWindowStatus = getReturnWindowStatus(order)
  const paymentDeadlineStatus = getPaymentDeadlineStatus(order)
  const visibleAuditLogs = useMemo(
    () => auditLogs.slice(0, visibleAuditLogCount),
    [auditLogs, visibleAuditLogCount],
  )
  const hasMoreAuditLogs = visibleAuditLogCount < auditLogs.length

  useEffect(() => {
    setVisibleAuditLogCount(AUDIT_LOG_PAGE_SIZE)
  }, [order._id, auditLogs.length])

  useEffect(() => {
    setActiveDrawerTab('overview')
  }, [order._id])

  return (
    <div className="admin-drawer-layer" role="dialog" aria-modal="true" aria-labelledby="admin-order-title">
      <button className="admin-drawer-backdrop" type="button" aria-label="Đóng chi tiết" onClick={onClose} />
      <aside className={`admin-user-drawer admin-order-drawer ${getOrderRowClass(order)}`}>
        <header className="admin-drawer-header">
          <div className="admin-user-identity">
            <span className="admin-user-avatar" aria-hidden="true">
              {order.orderCode.slice(-2)}
            </span>
            <div>
              <h2 id="admin-order-title" className="admin-code-with-copy">
                <span>{order.orderCode}</span>
                <button
                  className="admin-copy-button"
                  type="button"
                  onClick={() => onCopyReference(order.orderCode, 'mã đơn')}
                  aria-label="Sao chép mã đơn"
                >
                  <Copy size={14} strokeWidth={2.4} />
                </button>
              </h2>
              <p>{order.shippingAddress.customerName}</p>
            </div>
          </div>
          <div className="admin-order-drawer-status">
            <span className={getOrderPillClass(order.status)}>{statusLabels[order.status]}</span>
            <span className={getPaymentPillClass(order.paymentStatus)}>{paymentStatusLabels[order.paymentStatus]}</span>
            {returnWindowStatus ? (
              <span className={returnWindowStatus.className}>{returnWindowStatus.label}</span>
            ) : null}
            {paymentDeadlineStatus ? (
              <span className={paymentDeadlineStatus.className}>{paymentDeadlineStatus.label}</span>
            ) : null}
          </div>
          <button className="admin-secondary-button" type="button" onClick={onClose}>
            Đóng
          </button>
        </header>

        {isLoading ? <div className="admin-drawer-loading">Đang tải chi tiết...</div> : null}

        {attention ? (
          <div className={`admin-order-attention-callout is-${attention.tone}`} role="status">
            <strong>{attention.label}</strong>
            <span>{attention.helper}</span>
          </div>
        ) : null}

        {shouldWarnPaymentBeforeShipping(order) ? (
          <p className="admin-notice is-error admin-order-warning" role="alert">
            Đơn online chưa thanh toán. Hệ thống chỉ cho hủy đơn hoặc điều chỉnh thanh toán sau khi đối soát.
          </p>
        ) : null}

        <nav className="admin-order-drawer-tabs" aria-label="Nhóm thông tin đơn hàng">
          {orderDrawerTabs.map((tab) => (
            <button
              className={activeDrawerTab === tab.key ? 'is-active' : ''}
              type="button"
              key={tab.key}
              aria-current={activeDrawerTab === tab.key ? 'page' : undefined}
              onClick={() => setActiveDrawerTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="admin-order-drawer-body">
        {activeDrawerTab === 'overview' ? (
          <OrderOverviewPanel order={order} onCopyReference={onCopyReference} />
        ) : null}

        {activeDrawerTab === 'return' ? (
          <OrderReturnPanel needsRefundHandling={needsRefundHandling} order={order} />
        ) : null}

        {activeDrawerTab === (needsRefundHandling ? 'return' : 'payment') ? (
          <OrderRefundMethodsPanel
            canAdjustPayments={canAdjustPayments}
            canManageCustomerPaymentMethods={canManageCustomerPaymentMethods}
            canReadCustomerPaymentMethods={canReadCustomerPaymentMethods}
            isActionLoading={isActionLoading}
            needsRefundHandling={needsRefundHandling}
            order={order}
            paymentMethods={paymentMethods}
            revealedRefundAccounts={revealedRefundAccounts}
            onCopyReference={onCopyReference}
            onRevealRefundAccount={onRevealRefundAccount}
            onUpdatePaymentMethodStatus={onUpdatePaymentMethodStatus}
          />
        ) : null}

        {activeDrawerTab === 'shipping' ? (
          <OrderShippingPanel
            canUpdateOrders={canUpdateOrders}
            isActionLoading={isActionLoading}
            order={order}
            onCancelGhnShipment={onCancelGhnShipment}
            onCopyReference={onCopyReference}
            onCreateGhnShipment={onCreateGhnShipment}
            onShippingUpdate={onShippingUpdate}
            onSimulateShippingStatus={onSimulateShippingStatus}
            onSyncGhnShipment={onSyncGhnShipment}
          />
        ) : null}

        {activeDrawerTab === 'items' ? (
          <OrderLineItemsPanel order={order} />
        ) : null}

        {activeDrawerTab === 'payment' ? (
          <OrderPaymentPanel
            canAdjustPayments={canAdjustPayments}
            isActionLoading={isActionLoading}
            order={order}
            transactions={transactions}
            onAdjustPaymentStatus={onAdjustPaymentStatus}
            onRefresh={onRefresh}
          />
        ) : null}

        {activeDrawerTab === 'history' ? (
          <OrderHistoryPanel
            auditLogPageSize={AUDIT_LOG_PAGE_SIZE}
            auditLogs={auditLogs}
            canUpdateOrders={canUpdateOrders}
            hasMoreAuditLogs={hasMoreAuditLogs}
            hasPendingReturnRequest={hasPendingReturnRequest}
            isActionLoading={isActionLoading}
            order={order}
            statusOptions={statusOptions}
            visibleAuditLogCount={visibleAuditLogCount}
            visibleAuditLogs={visibleAuditLogs}
            onLoadMoreAuditLogs={() => setVisibleAuditLogCount((current) => current + AUDIT_LOG_PAGE_SIZE)}
            onRefresh={onRefresh}
            onReviewReturnRequest={onReviewReturnRequest}
            onStatusUpdate={onStatusUpdate}
          />
        ) : null}
        </div>
      </aside>
    </div>
  )
}
