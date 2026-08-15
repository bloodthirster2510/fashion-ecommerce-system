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
  UpdateOrderGhnMappingPayload,
} from './orderAdminApi'
import type { ShippingSimulationStatus } from './orderTypes'
import { OrderActionsPanel } from './components/OrderActionsPanel'
import { OrderHistoryPanel } from './components/OrderHistoryPanel'
import { OrderInvoicePanel } from './components/OrderInvoicePanel'
import { OrderLineItemsPanel } from './components/OrderLineItemsPanel'
import { OrderOverviewPanel } from './components/OrderOverviewPanel'
import { OrderPaymentPanel } from './components/OrderPaymentPanel'
import { OrderRefundMethodsPanel } from './components/OrderRefundMethodsPanel'
import { OrderReturnPanel } from './components/OrderReturnPanel'
import { OrderShippingPanel } from './components/OrderShippingPanel'
import { OrderStatusPill } from './components/OrderStatusPill'
import {
  getPaymentPillClass,
  getReturnWindowStatus,
  hasRejectedReturnRequest,
  nextStatusOptions,
  paymentStatusLabels,
} from './orderPresentation'
import {
  getOrderAttention,
  getOrderRowClass,
  getPaymentDeadlineStatus,
  shouldWarnPaymentBeforeShipping,
} from './utils/orderQueue'
import { getLatestVNPayRefundTransaction } from './utils/vnpayReconcile'

const AUDIT_LOG_PAGE_SIZE = 3
type OrderDrawerTab = 'overview' | 'invoice' | 'items' | 'payment' | 'shipping' | 'return' | 'history'
type OrderDrawerTabTone = 'danger' | 'warning'

const orderDrawerTabs: Array<{ key: OrderDrawerTab; label: string }> = [
  { key: 'overview', label: 'Tổng quan' },
  { key: 'invoice', label: 'Hóa đơn' },
  { key: 'items', label: 'Sản phẩm' },
  { key: 'payment', label: 'Thanh toán & xử lý' },
  { key: 'shipping', label: 'Giao hàng' },
  { key: 'return', label: 'Trả/Hoàn' },
  { key: 'history', label: 'Nhật ký' },
]

const orderNeedsRefundHandling = (order: AdminOrder) =>
  order.paymentStatus === 'paid' && (order.status === 'cancelled' || order.status === 'returned')

const getDrawerTabTone = (order: AdminOrder, tab: OrderDrawerTab): OrderDrawerTabTone | null => {
  if (tab === 'payment' && (shouldWarnPaymentBeforeShipping(order) || order.paymentStatus === 'failed')) {
    return 'danger'
  }

  if (tab === 'payment' && (order.status === 'confirmed' || order.status === 'delivered')) {
    return 'warning'
  }

  if (tab === 'shipping') {
    if (order.shipping?.status === 'failed') return 'danger'
    if (order.status === 'packed' || order.status === 'shipping') return 'warning'
  }

  if (tab === 'return') {
    if (hasRejectedReturnRequest(order) || orderNeedsRefundHandling(order)) return 'danger'
    if (order.status === 'return_requested' || order.status === 'return_approved') return 'warning'
  }

  return null
}

const getDefaultDrawerTab = (order: AdminOrder): OrderDrawerTab => {
  if (getDrawerTabTone(order, 'payment') === 'danger') return 'payment'
  if (getDrawerTabTone(order, 'return')) return 'return'
  if (getDrawerTabTone(order, 'shipping')) return 'shipping'
  if (getDrawerTabTone(order, 'payment')) return 'payment'
  return 'overview'
}

export function OrderDetailDrawer({
  canAdjustPayments,
  canManageCustomerPaymentMethods,
  canReadAuditLogs,
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
  onReconcileVNPay,
  onRefundVNPay,
  onReviewReturnRequest,
  onShippingUpdate,
  onSimulateShippingStatus,
  onSyncGhnShipment,
  onUpdateGhnMapping,
  onStatusUpdate,
  onCopyReference,
  onRevealRefundAccount,
}: {
  canAdjustPayments: boolean
  canManageCustomerPaymentMethods: boolean
  canReadAuditLogs: boolean
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
  onReconcileVNPay: () => void
  onRefundVNPay: () => void
  onReviewReturnRequest: (decision: AdminReturnReviewDecision) => void
  onShippingUpdate: () => void
  onSimulateShippingStatus: (status: ShippingSimulationStatus) => void
  onSyncGhnShipment: () => void
  onUpdateGhnMapping: (payload: UpdateOrderGhnMappingPayload) => void
  onStatusUpdate: (status: AdminOrderStatus) => void
  onCopyReference: (value: string, label: string) => void
  onRevealRefundAccount: (method: AdminCustomerPaymentMethod) => void
}) {
  const [activeDrawerTab, setActiveDrawerTab] = useState<OrderDrawerTab>(() => getDefaultDrawerTab(order))
  const [visibleAuditLogCount, setVisibleAuditLogCount] = useState(AUDIT_LOG_PAGE_SIZE)
  const statusOptions = (nextStatusOptions[order.status] ?? []).filter((status) => status !== 'returned')
  const hasRejectedReturn = hasRejectedReturnRequest(order)
  const needsRefundHandling = orderNeedsRefundHandling(order)
  const attention = getOrderAttention(order)
  const returnWindowStatus = getReturnWindowStatus(order)
  const paymentDeadlineStatus = getPaymentDeadlineStatus(order)
  const latestVNPayRefundTransaction = getLatestVNPayRefundTransaction(transactions)
  const defaultDrawerTab = getDefaultDrawerTab(order)
  const visibleAuditLogs = useMemo(
    () => auditLogs.slice(0, visibleAuditLogCount),
    [auditLogs, visibleAuditLogCount],
  )
  const hasMoreAuditLogs = visibleAuditLogCount < auditLogs.length

  useEffect(() => {
    setVisibleAuditLogCount(AUDIT_LOG_PAGE_SIZE)
  }, [order._id, auditLogs.length])

  useEffect(() => {
    setActiveDrawerTab(defaultDrawerTab)
  }, [defaultDrawerTab, order._id])

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
            <OrderStatusPill order={order} />
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

        {hasRejectedReturn ? (
          <div className="admin-order-attention-callout is-danger" role="status">
            <strong>Yêu cầu trả hàng đã bị từ chối</strong>
            <span>
              Đơn vẫn giữ trạng thái vận chuyển hiện tại. Xem lý do xử lý trong mục Trả/Hoàn; không tạo hoàn tiền từ quyết định này.
            </span>
          </div>
        ) : attention ? (
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
          {orderDrawerTabs.filter((tab) => tab.key !== 'history' || canReadAuditLogs).map((tab) => {
            const tone = getDrawerTabTone(order, tab.key)

            return (
              <button
                className={activeDrawerTab === tab.key ? 'is-active' : ''}
                type="button"
                key={tab.key}
                aria-current={activeDrawerTab === tab.key ? 'page' : undefined}
                title={tone === 'danger' ? 'Có vấn đề cần xem' : tone === 'warning' ? 'Có bước cần xử lý' : undefined}
                onClick={() => setActiveDrawerTab(tab.key)}
              >
                <span className="admin-order-tab-content">
                  {tab.label}
                  {tone ? <span className={`admin-order-tab-dot is-${tone}`} aria-hidden="true" /> : null}
                </span>
              </button>
            )
          })}
        </nav>

        <div className="admin-order-drawer-body">
        {activeDrawerTab === 'overview' ? (
          <OrderOverviewPanel
            order={order}
            onCopyReference={onCopyReference}
            onViewInvoice={() => setActiveDrawerTab('invoice')}
          />
        ) : null}

        {activeDrawerTab === 'invoice' ? (
          <OrderInvoicePanel order={order} onCopyReference={onCopyReference} />
        ) : null}

        {activeDrawerTab === 'return' ? (
          <OrderReturnPanel
            canUpdateOrders={canUpdateOrders}
            isActionLoading={isActionLoading}
            needsRefundHandling={needsRefundHandling}
            order={order}
            onReviewReturnRequest={onReviewReturnRequest}
            onStatusUpdate={onStatusUpdate}
          />
        ) : null}

        {activeDrawerTab === 'return' && needsRefundHandling ? (
          <OrderRefundMethodsPanel
            canAdjustPayments={canAdjustPayments}
            canManageCustomerPaymentMethods={canManageCustomerPaymentMethods}
            canReadCustomerPaymentMethods={canReadCustomerPaymentMethods}
            isActionLoading={isActionLoading}
            isTransactionLoading={isLoading}
            needsRefundHandling={needsRefundHandling}
            order={order}
            paymentMethods={paymentMethods}
            refundTransaction={latestVNPayRefundTransaction}
            revealedRefundAccounts={revealedRefundAccounts}
            onCopyReference={onCopyReference}
            onRefundVNPay={onRefundVNPay}
            onReconcileVNPay={onReconcileVNPay}
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
            onUpdateGhnMapping={onUpdateGhnMapping}
          />
        ) : null}

        {activeDrawerTab === 'items' ? (
          <OrderLineItemsPanel order={order} />
        ) : null}

        {activeDrawerTab === 'payment' ? (
          <>
            <OrderActionsPanel
              canUpdateOrders={canUpdateOrders}
              isActionLoading={isActionLoading}
              order={order}
              statusOptions={statusOptions}
              onStatusUpdate={onStatusUpdate}
            />
            <OrderPaymentPanel
              canAdjustPayments={canAdjustPayments}
              isActionLoading={isActionLoading}
              order={order}
              transactions={transactions}
              onAdjustPaymentStatus={onAdjustPaymentStatus}
              onReconcileVNPay={onReconcileVNPay}
              onRefresh={onRefresh}
            />
          </>
        ) : null}

        {activeDrawerTab === 'history' ? (
          <OrderHistoryPanel
            auditLogPageSize={AUDIT_LOG_PAGE_SIZE}
            auditLogs={auditLogs}
            hasMoreAuditLogs={hasMoreAuditLogs}
            visibleAuditLogCount={visibleAuditLogCount}
            visibleAuditLogs={visibleAuditLogs}
            onLoadMoreAuditLogs={() => setVisibleAuditLogCount((current) => current + AUDIT_LOG_PAGE_SIZE)}
            onRefresh={onRefresh}
          />
        ) : null}
        </div>
      </aside>
    </div>
  )
}
