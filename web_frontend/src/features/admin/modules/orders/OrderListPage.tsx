import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AdminUser } from '../auth/adminSession'
import {
  adjustOrderPaymentStatus,
  expireStalePayments,
  getOrder,
  listAuditLogs,
  listCustomerPaymentMethods,
  listOrderTransactions,
  listOrders,
  updateCustomerPaymentMethodStatus,
  updateOrderShipping,
  updateOrderStatus,
  type AdminAuditLog,
  type AdminCustomerPaymentMethod,
  type AdminOrder,
  type AdminOrderPaymentMethod,
  type AdminOrderPaymentStatus,
  type AdminOrderStatus,
  type AdminPaymentMethodStatus,
  type AdminTransaction,
} from './orderAdminApi'
import './order.css'

type OrdersPageProps = {
  currentUser: AdminUser
}

type OrderTab = {
  key: string
  label: string
  status?: AdminOrderStatus | 'all'
  paymentStatus?: AdminOrderPaymentStatus | 'all'
}

type Notice = {
  type: 'success' | 'error'
  message: string
}

const pageSize = 10

const orderTabs: OrderTab[] = [
  { key: 'all', label: 'Tất cả', status: 'all', paymentStatus: 'all' },
  { key: 'payment', label: 'Chờ thanh toán', status: 'all', paymentStatus: 'pending' },
  { key: 'confirmed', label: 'Chờ xử lý', status: 'confirmed', paymentStatus: 'all' },
  { key: 'shipping', label: 'Đang giao', status: 'shipping', paymentStatus: 'all' },
  { key: 'done', label: 'Hoàn thành', status: 'delivered', paymentStatus: 'all' },
  { key: 'exceptions', label: 'Hủy / trả', status: 'cancelled', paymentStatus: 'all' },
]

const statusLabels: Record<AdminOrderStatus, string> = {
  confirmed: 'Chờ xử lý',
  packed: 'Đã đóng gói',
  shipping: 'Đang giao',
  delivered: 'Đã giao',
  cancelled: 'Đã hủy',
  return_requested: 'Yêu cầu trả',
  returned: 'Đã trả hàng',
}

const paymentStatusLabels: Record<AdminOrderPaymentStatus, string> = {
  pending: 'Chờ thanh toán',
  paid: 'Đã thanh toán',
  failed: 'Thất bại',
  refunded: 'Đã hoàn tiền',
}

const paymentMethodStatusLabels: Record<AdminPaymentMethodStatus, string> = {
  pending: 'Đang xác minh',
  verified: 'Sẵn sàng',
  expired: 'Hết hạn',
  disabled: 'Đã tắt',
}

const paymentMethodLabels: Record<AdminOrderPaymentMethod, string> = {
  COD: 'COD',
  VNPAY: 'VNPay',
  MOMO: 'MoMo',
  CARD: 'Thẻ',
  BANK: 'Chuyển khoản',
}

const transactionStatusLabels: Record<AdminTransaction['status'], string> = {
  pending: 'Đang chờ',
  success: 'Thành công',
  failed: 'Thất bại',
  expired: 'Đã hết hạn',
}

const auditActionLabels: Record<AdminAuditLog['action'], string> = {
  'order.status_update': 'Cập nhật trạng thái đơn',
  'order.shipping_update': 'Cập nhật vận chuyển',
  'payment.adjust': 'Điều chỉnh thanh toán',
  'payment.expire': 'Hết hạn thanh toán',
  'payment_method.status_update': 'Cập nhật phương thức thanh toán',
}

const actorRoleLabels: Record<AdminAuditLog['actorRole'], string> = {
  admin: 'Quản trị viên',
  staff: 'Nhân viên',
  system: 'Hệ thống',
}

const auditTargetTypeLabels: Record<string, string> = {
  Order: 'Đơn hàng',
  Payment: 'Thanh toán',
  PaymentMethod: 'Phương thức thanh toán',
}

const shippingProviderLabels: Record<string, string> = {
  GHN: 'GHN',
  GHTK: 'GHTK',
  FIXED: 'Cố định',
}

const shippingStatusLabels: Record<string, string> = {
  created: 'Đã tạo',
  quoted: 'Đã báo phí',
  fallback: 'Phí cố định',
  ready: 'Sẵn sàng giao',
  picking: 'Đang lấy hàng',
  picked: 'Đã lấy hàng',
  shipping: 'Đang giao',
  delivering: 'Đang giao',
  delivered: 'Đã giao',
  cancelled: 'Đã hủy',
  returned: 'Đã trả hàng',
  failed: 'Giao thất bại',
}

const nextStatusOptions: Partial<Record<AdminOrderStatus, AdminOrderStatus[]>> = {
  confirmed: ['packed', 'cancelled'],
  packed: ['shipping', 'cancelled'],
  shipping: ['delivered', 'return_requested'],
  delivered: ['return_requested'],
  return_requested: ['returned'],
}

const currencyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
})

const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'short',
})

const formatCurrency = (value: number) => currencyFormatter.format(value)

const formatDate = (value?: string | null) => {
  if (!value) return 'Chưa có'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Chưa có'

  return dateFormatter.format(date)
}

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Không thể xử lý yêu cầu'

const getPaymentPillClass = (status: AdminOrderPaymentStatus) => {
  if (status === 'paid') return 'admin-status-pill is-active'
  if (status === 'pending') return 'admin-status-pill is-warning'
  if (status === 'refunded') return 'admin-status-pill is-refund'
  return 'admin-status-pill is-blocked'
}

const getOrderPillClass = (status: AdminOrderStatus) => {
  if (status === 'delivered') return 'admin-status-pill is-active'
  if (status === 'shipping') return 'admin-status-pill is-info'
  if (status === 'packed') return 'admin-status-pill is-progress'
  if (status === 'return_requested') return 'admin-status-pill is-refund'
  if (status === 'cancelled' || status === 'returned') return 'admin-status-pill is-blocked'
  return 'admin-status-pill is-warning'
}

const getShippingPillClass = (status?: string | null) => {
  if (status === 'delivered') return 'admin-status-pill is-active'
  if (status === 'shipping' || status === 'delivering' || status === 'picking' || status === 'picked') {
    return 'admin-status-pill is-info'
  }
  if (status === 'failed' || status === 'cancelled' || status === 'returned') {
    return 'admin-status-pill is-blocked'
  }
  return 'admin-status-pill is-soft'
}

const getOrderRowClass = (order: AdminOrder) => {
  if (shouldWarnPaymentBeforeShipping(order) || order.paymentStatus === 'failed') {
    return 'admin-order-row is-payment-risk'
  }
  if (order.status === 'delivered') return 'admin-order-row is-complete'
  if (order.status === 'shipping') return 'admin-order-row is-shipping'
  if (order.status === 'packed') return 'admin-order-row is-packed'
  if (order.status === 'cancelled' || order.status === 'returned' || order.status === 'return_requested') {
    return 'admin-order-row is-exception'
  }
  return 'admin-order-row is-processing'
}

const getTabClass = (tab: OrderTab, activeTabKey: string) =>
  [
    'admin-order-tab',
    `is-${tab.key}`,
    tab.key === activeTabKey ? 'is-active' : '',
  ]
    .filter(Boolean)
    .join(' ')

const orderFlowSteps = ['confirmed', 'packed', 'shipping', 'delivered'] as const

const orderFlowLabels: Record<(typeof orderFlowSteps)[number], string> = {
  confirmed: 'Xử lý',
  packed: 'Đóng gói',
  shipping: 'Giao hàng',
  delivered: 'Hoàn tất',
}

const getOrderProgressPercent = (status: AdminOrderStatus) => {
  if (status === 'cancelled') return 0
  if (status === 'return_requested' || status === 'returned') return 100

  const index = orderFlowSteps.indexOf(status as (typeof orderFlowSteps)[number])
  if (index < 0) return 0

  return ((index + 1) / orderFlowSteps.length) * 100
}

function OrderProgressRail({
  compact = false,
  status,
}: {
  compact?: boolean
  status: AdminOrderStatus
}) {
  const isException = status === 'cancelled' || status === 'return_requested' || status === 'returned'
  const progressPercent = getOrderProgressPercent(status)
  const currentIndex = isException && status !== 'cancelled'
    ? orderFlowSteps.length - 1
    : orderFlowSteps.indexOf(status as (typeof orderFlowSteps)[number])

  return (
    <div className={`admin-order-progress${compact ? ' is-compact' : ''}${isException ? ' is-exception' : ''}`}>
      <span style={{ width: `${progressPercent}%` }} />
      {!compact ? (
        <ol>
          {orderFlowSteps.map((step) => (
            <li className={orderFlowSteps.indexOf(step) <= currentIndex ? 'is-done' : ''} key={step}>
              {orderFlowLabels[step]}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  )
}

const shouldWarnPaymentBeforeShipping = (order: AdminOrder) =>
  order.paymentMethod !== 'COD' &&
  order.paymentStatus !== 'paid' &&
  order.status !== 'cancelled' &&
  order.status !== 'returned'

const getAddressLine = (order: AdminOrder) =>
  [
    order.shippingAddress.streetName,
    order.shippingAddress.ward,
    order.shippingAddress.district,
    order.shippingAddress.province,
  ]
    .filter(Boolean)
    .join(', ')

const formatShippingProvider = (provider?: string | null) => {
  if (!provider) return 'Chưa tạo vận đơn'

  return shippingProviderLabels[provider] ?? provider
}

const formatShippingStatus = (status?: string | null) => {
  if (!status) return 'Đang chờ'

  return shippingStatusLabels[status] ?? status
}

export function OrderListPage({ currentUser }: OrdersPageProps) {
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null)
  const [transactions, setTransactions] = useState<AdminTransaction[]>([])
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([])
  const [customerPaymentMethods, setCustomerPaymentMethods] = useState<AdminCustomerPaymentMethod[]>([])
  const [keywordInput, setKeywordInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [activeTabKey, setActiveTabKey] = useState('all')
  const [paymentMethod, setPaymentMethod] = useState<AdminOrderPaymentMethod | 'all'>('all')
  const [page, setPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [isDrawerLoading, setIsDrawerLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [notice, setNotice] = useState<Notice | null>(null)

  const activeTab = orderTabs.find((tab) => tab.key === activeTabKey) ?? orderTabs[0]
  const canUpdateOrders =
    currentUser.role === 'admin' || Boolean(currentUser.permissions?.includes('orders.update'))
  const canAdjustPayments =
    currentUser.role === 'admin' || Boolean(currentUser.permissions?.includes('payments.adjust'))
  const canManageCustomerPaymentMethods =
    currentUser.role === 'admin' || Boolean(currentUser.permissions?.includes('customers.manage'))

  const orderStats = useMemo(() => {
    const pendingPayment = orders.filter(
      (order) => order.paymentMethod !== 'COD' && order.paymentStatus === 'pending',
    ).length
    const paid = orders.filter((order) => order.paymentStatus === 'paid').length
    const active = orders.filter(
      (order) => !['cancelled', 'returned'].includes(order.status),
    ).length
    const attention = orders.filter(
      (order) =>
        shouldWarnPaymentBeforeShipping(order) ||
        order.paymentStatus === 'failed' ||
        ['cancelled', 'return_requested', 'returned'].includes(order.status),
    ).length

    return { pendingPayment, paid, active, attention }
  }, [orders])

  const loadOrders = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage('')

    try {
      const result = await listOrders({
        keyword,
        status: activeTab.status ?? 'all',
        paymentStatus: activeTab.paymentStatus ?? 'all',
        paymentMethod,
        page,
        limit: pageSize,
      })

      setOrders(result.items)
      setTotalItems(result.pagination?.totalItems ?? result.items.length)
      setTotalPages(Math.max(1, result.pagination?.totalPages ?? 1))
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }, [activeTab.paymentStatus, activeTab.status, keyword, page, paymentMethod])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setPage(1)
      setKeyword(keywordInput.trim())
    }, 320)

    return () => window.clearTimeout(handle)
  }, [keywordInput])

  useEffect(() => {
    void loadOrders()
  }, [loadOrders])

  const refreshSelectedOrder = async (orderId: string) => {
    setIsDrawerLoading(true)

    try {
      const orderDetail = await getOrder(orderId)
      const [orderTransactions, paymentMethods, orderAuditLogs] = await Promise.all([
        listOrderTransactions(orderId),
        listCustomerPaymentMethods(orderDetail.user_id),
        listAuditLogs({ targetType: 'Order', targetId: orderId, limit: 20 }),
      ])
      setSelectedOrder(orderDetail)
      setTransactions(orderTransactions)
      setCustomerPaymentMethods(paymentMethods)
      setAuditLogs(orderAuditLogs.items)
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setIsDrawerLoading(false)
    }
  }

  const openOrder = (order: AdminOrder) => {
    setSelectedOrder(order)
    setTransactions([])
    setAuditLogs([])
    setCustomerPaymentMethods([])
    setNotice(null)
    void refreshSelectedOrder(order._id)
  }

  const closeDrawer = () => {
    if (!actionLoading) {
      setSelectedOrder(null)
      setTransactions([])
      setAuditLogs([])
      setCustomerPaymentMethods([])
    }
  }

  const handleStatusUpdate = async (nextStatus: AdminOrderStatus) => {
    if (!selectedOrder) return

    setActionLoading(true)
    setNotice(null)

    try {
      const updatedOrder = await updateOrderStatus(selectedOrder._id, nextStatus)
      setSelectedOrder(updatedOrder)
      setOrders((currentOrders) =>
        currentOrders.map((order) => (order._id === updatedOrder._id ? updatedOrder : order)),
      )
      setNotice({ type: 'success', message: 'Đã cập nhật trạng thái đơn hàng' })
      await refreshSelectedOrder(updatedOrder._id)
      await loadOrders()
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setActionLoading(false)
    }
  }

  const handleShippingUpdate = async () => {
    if (!selectedOrder) return

    const provider = window.prompt('Đơn vị vận chuyển', selectedOrder.shipping?.provider ?? 'GHN')
    if (provider === null) return

    const trackingCode = window.prompt('Mã vận đơn', selectedOrder.shipping?.trackingCode ?? '')
    if (trackingCode === null) return

    const labelUrl = window.prompt('URL nhãn vận chuyển (có thể bỏ trống)', selectedOrder.shipping?.labelUrl ?? '')
    if (labelUrl === null) return

    const status = window.prompt('Trạng thái vận chuyển', selectedOrder.shipping?.status ?? 'created')
    if (status === null) return

    const actualCostText = window.prompt(
      'Chi phí vận chuyển thực tế',
      selectedOrder.shipping?.actualProviderCost !== undefined && selectedOrder.shipping?.actualProviderCost !== null
        ? String(selectedOrder.shipping.actualProviderCost)
        : '',
    )
    if (actualCostText === null) return

    const reason = window.prompt('Lý do cập nhật vận chuyển')
    if (!reason?.trim()) return

    const actualProviderCost = actualCostText.trim() ? Number(actualCostText.trim()) : null
    if (actualProviderCost !== null && (!Number.isFinite(actualProviderCost) || actualProviderCost < 0)) {
      setNotice({ type: 'error', message: 'Chi phí vận chuyển không hợp lệ' })
      return
    }

    setActionLoading(true)
    setNotice(null)

    try {
      const updatedOrder = await updateOrderShipping(selectedOrder._id, {
        provider: provider.trim() || null,
        trackingCode: trackingCode.trim() || null,
        labelUrl: labelUrl.trim() || null,
        status: status.trim() || null,
        actualProviderCost,
        reason: reason.trim(),
      })
      setSelectedOrder(updatedOrder)
      setOrders((currentOrders) =>
        currentOrders.map((order) => (order._id === updatedOrder._id ? updatedOrder : order)),
      )
      setNotice({ type: 'success', message: 'Đã cập nhật thông tin vận đơn' })
      await refreshSelectedOrder(updatedOrder._id)
      await loadOrders()
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setActionLoading(false)
    }
  }

  const handleExpireStalePayments = async () => {
    setActionLoading(true)
    setNotice(null)

    try {
      const result = await expireStalePayments()
      setNotice({
        type: 'success',
        message: `Đã hết hạn ${result.expiredCount} lượt thanh toán quá hạn`,
      })
      await loadOrders()
      if (selectedOrder) {
        await refreshSelectedOrder(selectedOrder._id)
      }
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setActionLoading(false)
    }
  }

  const handleAdjustPaymentStatus = async (nextStatus: AdminOrderPaymentStatus) => {
    if (!selectedOrder) return

    const reason = window.prompt(`Nhập lý do điều chỉnh thanh toán sang "${paymentStatusLabels[nextStatus]}"`)
    if (!reason?.trim()) {
      return
    }

    setActionLoading(true)
    setNotice(null)

    try {
      const updatedOrder = await adjustOrderPaymentStatus(selectedOrder._id, nextStatus, reason.trim())
      setSelectedOrder(updatedOrder)
      setOrders((currentOrders) =>
        currentOrders.map((order) => (order._id === updatedOrder._id ? updatedOrder : order)),
      )
      setNotice({ type: 'success', message: 'Đã điều chỉnh trạng thái thanh toán' })
      await refreshSelectedOrder(updatedOrder._id)
      await loadOrders()
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setActionLoading(false)
    }
  }

  const handleDisablePaymentMethod = async (method: AdminCustomerPaymentMethod) => {
    if (!selectedOrder) return

    const reason = window.prompt(`Nhập lý do tắt phương thức "${method.displayName}"`)
    if (!reason?.trim()) {
      return
    }

    setActionLoading(true)
    setNotice(null)

    try {
      await updateCustomerPaymentMethodStatus(method._id, 'disabled', reason.trim())
      setNotice({ type: 'success', message: 'Đã tắt phương thức thanh toán của khách hàng' })
      await refreshSelectedOrder(selectedOrder._id)
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <section className="admin-orders-page" aria-busy={isLoading}>
      <header className="admin-page-heading">
        <div>
          <p>Vận hành đơn hàng</p>
          <h1>Đơn hàng & thanh toán</h1>
        </div>

        <div className="admin-page-actions">
          <button
            className="admin-secondary-button"
            type="button"
            disabled={!canUpdateOrders || actionLoading}
            onClick={() => void handleExpireStalePayments()}
          >
            Hết hạn thanh toán quá hạn
          </button>
          <button className="admin-secondary-button" type="button" onClick={() => void loadOrders()}>
            Tải lại
          </button>
        </div>
      </header>

      <div className="admin-user-stats admin-order-stats" aria-label="Thống kê đơn hàng">
        <div className="is-total">
          <span>Tổng theo bộ lọc</span>
          <strong>{totalItems}</strong>
        </div>
        <div className="is-attention">
          <span>Cần chú ý</span>
          <strong>{orderStats.attention}</strong>
        </div>
        <div className="is-warning">
          <span>Online chờ thanh toán</span>
          <strong>{orderStats.pendingPayment}</strong>
        </div>
        <div className="is-active">
          <span>Đang vận hành</span>
          <strong>{orderStats.active}</strong>
        </div>
        <div className="is-success">
          <span>Đã thanh toán</span>
          <strong>{orderStats.paid}</strong>
        </div>
      </div>

      <div className="admin-order-tabs" role="tablist" aria-label="Lọc nhanh đơn hàng">
        {orderTabs.map((tab) => (
          <button
            className={getTabClass(tab, activeTabKey)}
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={tab.key === activeTabKey}
            onClick={() => {
              setActiveTabKey(tab.key)
              setPage(1)
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="admin-order-legend" aria-label="Chú giải màu trạng thái">
        <span className="is-warning">Chờ xử lý</span>
        <span className="is-info">Đang giao</span>
        <span className="is-active">Hoàn tất</span>
        <span className="is-attention">Cần chú ý</span>
      </div>

      <div className="admin-table-toolbar">
        <label className="admin-user-search">
          <span>Tìm kiếm</span>
          <input
            type="search"
            value={keywordInput}
            onChange={(event) => setKeywordInput(event.target.value)}
            placeholder="Mã đơn, hóa đơn hoặc sản phẩm"
          />
        </label>

        <label>
          <span>Thanh toán</span>
          <select
            value={paymentMethod}
            onChange={(event) => {
              setPaymentMethod(event.target.value as AdminOrderPaymentMethod | 'all')
              setPage(1)
            }}
          >
            <option value="all">Tất cả</option>
            {Object.entries(paymentMethodLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {notice ? (
        <p className={`admin-notice is-${notice.type}`} role="status">
          {notice.message}
        </p>
      ) : null}

      {errorMessage ? (
        <div className="admin-empty-state" role="alert">
          <strong>Không tải được đơn hàng</strong>
          <span>{errorMessage}</span>
          <button className="admin-secondary-button" type="button" onClick={() => void loadOrders()}>
            Thử lại
          </button>
        </div>
      ) : (
        <div className="admin-table-shell">
          <table className="admin-table admin-orders-table">
            <thead>
              <tr>
                <th>Đơn hàng</th>
                <th>Khách hàng</th>
                <th>Tổng tiền</th>
                <th>Thanh toán</th>
                <th>Trạng thái</th>
                <th>Giao hàng</th>
                <th>Ngày tạo</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8}>
                    <div className="admin-table-loading">Đang tải đơn hàng...</div>
                  </td>
                </tr>
              ) : null}

              {!isLoading && orders.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="admin-table-loading">Không có đơn hàng phù hợp.</div>
                  </td>
                </tr>
              ) : null}

              {!isLoading
                ? orders.map((order) => (
                    <tr className={getOrderRowClass(order)} key={order._id}>
                      <td>
                        <div className="admin-order-code-cell">
                          <strong>{order.orderCode}</strong>
                          <span>{order.invoiceCode || 'Chưa có hóa đơn'}</span>
                        </div>
                      </td>
                      <td>
                        <div className="admin-contact-cell">
                          <span>{order.shippingAddress.customerName}</span>
                          <small>{order.shippingAddress.phoneNumber}</small>
                        </div>
                      </td>
                      <td>
                        <strong>{formatCurrency(order.totalAmount)}</strong>
                        <span>{order.order_list.length} sản phẩm</span>
                      </td>
                      <td>
                        <div className="admin-order-payment-cell">
                          <strong>{paymentMethodLabels[order.paymentMethod]}</strong>
                          <span className={getPaymentPillClass(order.paymentStatus)}>
                            {paymentStatusLabels[order.paymentStatus]}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="admin-order-status-cell">
                          <span className={getOrderPillClass(order.status)}>
                            {statusLabels[order.status]}
                          </span>
                          <OrderProgressRail compact status={order.status} />
                        </div>
                      </td>
                      <td>
                        <div className="admin-shipping-cell">
                          <strong>{formatShippingProvider(order.shipping?.provider)}</strong>
                          <span className={getShippingPillClass(order.shipping?.status)}>
                            {order.shipping?.trackingCode || formatShippingStatus(order.shipping?.status)}
                          </span>
                        </div>
                      </td>
                      <td>{formatDate(order.createdAt)}</td>
                      <td>
                        <button className="admin-link-button" type="button" onClick={() => openOrder(order)}>
                          Chi tiết
                        </button>
                      </td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>
      )}

      <footer className="admin-table-footer">
        <span>
          Trang {page} / {totalPages}
        </span>
        <div>
          <button
            className="admin-secondary-button"
            type="button"
            disabled={page <= 1 || isLoading}
            onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
          >
            Trước
          </button>
          <button
            className="admin-secondary-button"
            type="button"
            disabled={page >= totalPages || isLoading}
            onClick={() => setPage((currentPage) => Math.min(totalPages, currentPage + 1))}
          >
            Sau
          </button>
        </div>
      </footer>

      {selectedOrder ? (
        <OrderDetailDrawer
          canAdjustPayments={canAdjustPayments}
          canManageCustomerPaymentMethods={canManageCustomerPaymentMethods}
          canUpdateOrders={canUpdateOrders}
          isActionLoading={actionLoading}
          isLoading={isDrawerLoading}
          auditLogs={auditLogs}
          order={selectedOrder}
          paymentMethods={customerPaymentMethods}
          transactions={transactions}
          onClose={closeDrawer}
          onAdjustPaymentStatus={(status) => void handleAdjustPaymentStatus(status)}
          onDisablePaymentMethod={(method) => void handleDisablePaymentMethod(method)}
          onRefresh={() => void refreshSelectedOrder(selectedOrder._id)}
          onShippingUpdate={() => void handleShippingUpdate()}
          onStatusUpdate={(status) => void handleStatusUpdate(status)}
        />
      ) : null}
    </section>
  )
}

function OrderDetailDrawer({
  canAdjustPayments,
  canManageCustomerPaymentMethods,
  canUpdateOrders,
  isActionLoading,
  isLoading,
  auditLogs,
  order,
  paymentMethods,
  transactions,
  onClose,
  onAdjustPaymentStatus,
  onDisablePaymentMethod,
  onRefresh,
  onShippingUpdate,
  onStatusUpdate,
}: {
  canAdjustPayments: boolean
  canManageCustomerPaymentMethods: boolean
  canUpdateOrders: boolean
  isActionLoading: boolean
  isLoading: boolean
  auditLogs: AdminAuditLog[]
  order: AdminOrder
  paymentMethods: AdminCustomerPaymentMethod[]
  transactions: AdminTransaction[]
  onClose: () => void
  onAdjustPaymentStatus: (status: AdminOrderPaymentStatus) => void
  onDisablePaymentMethod: (method: AdminCustomerPaymentMethod) => void
  onRefresh: () => void
  onShippingUpdate: () => void
  onStatusUpdate: (status: AdminOrderStatus) => void
}) {
  const statusOptions = nextStatusOptions[order.status] ?? []

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
              <h2 id="admin-order-title">{order.orderCode}</h2>
              <p>{order.shippingAddress.customerName}</p>
            </div>
          </div>
          <div className="admin-order-drawer-status">
            <span className={getOrderPillClass(order.status)}>{statusLabels[order.status]}</span>
            <span className={getPaymentPillClass(order.paymentStatus)}>{paymentStatusLabels[order.paymentStatus]}</span>
          </div>
          <button className="admin-secondary-button" type="button" onClick={onClose}>
            Đóng
          </button>
        </header>

        {isLoading ? <div className="admin-drawer-loading">Đang tải chi tiết...</div> : null}

        {shouldWarnPaymentBeforeShipping(order) ? (
          <p className="admin-notice is-error admin-order-warning" role="alert">
            Đơn online chưa thanh toán. Không nên đóng gói hoặc tạo vận đơn khi chưa đối soát xong.
          </p>
        ) : null}

        <section className="admin-drawer-section">
          <h3>Tổng quan</h3>
          <OrderProgressRail status={order.status} />
          <div className="admin-detail-grid">
            <div className="admin-detail-card is-order">
              <span>Trạng thái đơn</span>
              <strong className={getOrderPillClass(order.status)}>{statusLabels[order.status]}</strong>
            </div>
            <div className="admin-detail-card is-payment">
              <span>Trạng thái thanh toán</span>
              <strong className={getPaymentPillClass(order.paymentStatus)}>{paymentStatusLabels[order.paymentStatus]}</strong>
            </div>
            <div className="admin-detail-card is-method">
              <span>Phương thức</span>
              <strong>{paymentMethodLabels[order.paymentMethod]}</strong>
            </div>
            <div className="admin-detail-card is-total">
              <span>Tổng tiền</span>
              <strong>{formatCurrency(order.totalAmount)}</strong>
            </div>
          </div>
        </section>

        <section className="admin-drawer-section">
          <h3>Phương thức thanh toán của khách hàng</h3>
          {paymentMethods.length === 0 ? (
            <p className="admin-muted-text">Khách hàng chưa lưu phương thức thanh toán nào.</p>
          ) : (
            <div className="admin-payment-method-list">
              {paymentMethods.map((method) => {
                const isActive = method.status === 'pending' || method.status === 'verified'

                return (
                  <article className="admin-payment-method-card" key={method._id}>
                    <div>
                      <strong>{method.displayName}</strong>
                      <span>{[method.maskedInfo, method.bankName, method.bankCode].filter(Boolean).join(' / ') || method.provider}</span>
                    </div>
                    <div className="admin-payment-method-actions">
                      <span className={isActive ? 'admin-status-pill is-active' : 'admin-status-pill is-blocked'}>
                        {paymentMethodStatusLabels[method.status]}
                      </span>
                      {method.isDefault ? <span className="admin-status-pill is-warning">Mặc định</span> : null}
                      {isActive ? (
                        <button
                          className="admin-danger-button"
                          type="button"
                          disabled={!canManageCustomerPaymentMethods || isActionLoading}
                          onClick={() => onDisablePaymentMethod(method)}
                        >
                          Tắt
                        </button>
                      ) : null}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
          {!canManageCustomerPaymentMethods ? (
            <p className="admin-permission-note">Cần quyền customers.manage để tắt phương thức thanh toán.</p>
          ) : null}
        </section>

        <section className="admin-drawer-section">
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
              <strong>{order.shipping?.trackingCode || 'Chưa có'}</strong>
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
        </section>

        <section className="admin-drawer-section">
          <h3>Sản phẩm</h3>
          <div className="admin-order-item-list">
            {order.order_list.map((item) => (
              <div className="admin-order-item" key={item._id ?? item.sku}>
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.color} / {item.size} / {item.fitType}</span>
                </div>
                <span>
                  {item.quantity} x {formatCurrency(item.priceAtPurchased)}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-drawer-section">
          <div className="admin-section-inline-heading">
            <h3>Lượt thanh toán</h3>
            <button className="admin-link-button" type="button" onClick={onRefresh}>
              Tải lại
            </button>
          </div>
          {transactions.length === 0 ? (
            <p className="admin-muted-text">Chưa có giao dịch cho đơn này.</p>
          ) : (
            <div className="admin-payment-timeline">
              {transactions.map((transaction) => (
                <article className="admin-payment-attempt" key={transaction._id}>
                  <header>
                    <strong>Lượt #{transaction.attemptNo ?? '?'}</strong>
                    <span className={transaction.status === 'success' ? 'is-success' : transaction.status === 'pending' ? 'is-pending' : 'is-failed'}>
                      {transactionStatusLabels[transaction.status]}
                    </span>
                  </header>
                  <dl>
                    <div>
                      <dt>Mã giao dịch</dt>
                      <dd>{transaction.txnRef || 'Chưa có'}</dd>
                    </div>
                    <div>
                      <dt>Cổng thanh toán</dt>
                      <dd>{transaction.gatewayProvider || transaction.paymentMethod}</dd>
                    </div>
                    <div>
                      <dt>Số tiền</dt>
                      <dd>{formatCurrency(transaction.amount)}</dd>
                    </div>
                    <div>
                      <dt>Tạo lúc</dt>
                      <dd>{formatDate(transaction.createdAt)}</dd>
                    </div>
                    <div>
                      <dt>Hết hạn lúc</dt>
                      <dd>{formatDate(transaction.expiredAt)}</dd>
                    </div>
                    <div>
                      <dt>Xử lý lúc</dt>
                      <dd>{formatDate(transaction.resolvedAt)}</dd>
                    </div>
                  </dl>
                  {transaction.failureReason ? (
                    <p>{transaction.failureReason}</p>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="admin-drawer-section">
          <h3>Điều chỉnh thanh toán thủ công</h3>
          <p className="admin-muted-text">Chỉ dùng khi đã đối soát ngoài cổng thanh toán. Lý do bắt buộc và sẽ ghi nhật ký thao tác.</p>
          <div className="admin-drawer-actions">
            {(['paid', 'failed', 'refunded', 'pending'] as AdminOrderPaymentStatus[]).map((status) => (
              <button
                className={status === 'paid' ? 'admin-primary-button' : 'admin-secondary-button'}
                key={status}
                type="button"
                disabled={!canAdjustPayments || isActionLoading || order.paymentStatus === status}
                onClick={() => onAdjustPaymentStatus(status)}
              >
                {paymentStatusLabels[status]}
              </button>
            ))}
          </div>
          {!canAdjustPayments ? (
            <p className="admin-permission-note">Cần quyền payments.adjust để điều chỉnh thanh toán.</p>
          ) : null}
        </section>

        <section className="admin-drawer-section">
          <div className="admin-section-inline-heading">
            <h3>Nhật ký thao tác</h3>
            <button className="admin-link-button" type="button" onClick={onRefresh}>
              Tải lại
            </button>
          </div>
          {auditLogs.length === 0 ? (
            <p className="admin-muted-text">Chưa có nhật ký thao tác cho đơn này.</p>
          ) : (
            <div className="admin-audit-log-list">
              {auditLogs.map((log) => (
                <article className="admin-audit-log-card" key={log._id}>
                  <header>
                    <strong>{auditActionLabels[log.action]}</strong>
                    <span>{formatDate(log.createdAt)}</span>
                  </header>
                  <p>{log.reason || 'Không có lý do'}</p>
                  <dl>
                    <div>
                      <dt>Người thực hiện</dt>
                      <dd>{actorRoleLabels[log.actorRole]}{log.actorId ? ` / ${log.actorId}` : ''}</dd>
                    </div>
                    <div>
                      <dt>Đối tượng</dt>
                      <dd>{auditTargetTypeLabels[log.targetType] ?? log.targetType}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="admin-drawer-section">
          <h3>Xử lý đơn</h3>
          {statusOptions.length === 0 ? (
            <p className="admin-muted-text">Đơn hàng không có bước xử lý tiếp theo.</p>
          ) : (
            <div className="admin-drawer-actions">
              {statusOptions.map((status) => (
                <button
                  className={status === 'cancelled' ? 'admin-danger-button' : 'admin-primary-button'}
                  key={status}
                  type="button"
                  disabled={!canUpdateOrders || isActionLoading}
                  onClick={() => onStatusUpdate(status)}
                >
                  {isActionLoading ? 'Đang xử lý...' : statusLabels[status]}
                </button>
              ))}
            </div>
          )}
          {!canUpdateOrders ? (
            <p className="admin-permission-note">Tài khoản này chỉ có quyền xem đơn hàng.</p>
          ) : null}
        </section>
      </aside>
    </div>
  )
}
