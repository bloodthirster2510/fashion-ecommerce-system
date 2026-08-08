import { useCallback, useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query'
import { Alert, Button, Empty, Modal, Segmented, Skeleton, Spin, Tag, message } from 'antd'
import { MainLayout } from '../../../layouts/MainLayout'
import { requestCustomer } from '../../../services/customerHttp'
import { ProfileSidebar } from '../components/ProfileSidebar'
import { useAppSelector } from '../../../app/hooks'
import { orderService } from '../../orders/order.service'
import { useOrderRealtime } from '../../orders/orderRealtime'
import type {
  CustomerOrder,
  CustomerOrderListResponse,
  OrderPaymentMethod,
  OrderPaymentStatus,
  OrderStatus,
  PaymentStatusResult,
} from '../../orders/order.types'
import '../profile.css'

const orderStatusLabels: Record<OrderStatus, string> = {
  confirmed: 'Đã xác nhận',
  packed: 'Đã đóng gói',
  shipping: 'Đang giao hàng',
  delivered: 'Đã giao',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
  return_requested: 'Đang yêu cầu trả hàng',
  return_approved: 'Yêu cầu trả đã duyệt',
  returned: 'Đã trả hàng',
}

const paymentStatusLabels: Record<OrderPaymentStatus, string> = {
  pending: 'Chờ thanh toán',
  paid: 'Đã thanh toán',
  failed: 'Thanh toán thất bại',
  refunded: 'Đã hoàn tiền',
}

const paymentMethodLabels: Record<OrderPaymentMethod, string> = {
  COD: 'Thanh toán khi nhận hàng',
  VNPAY: 'VNPay',
  MOMO: 'MoMo',
  CARD: 'Thẻ thanh toán',
  BANK: 'Chuyển khoản',
}

const shippingStatusLabels: Record<string, string> = {
  quoted: 'Đang chuẩn bị giao hàng',
  fallback: 'Đang chuẩn bị giao hàng',
  ready: 'Sẵn sàng giao',
  picking: 'Đang lấy hàng',
  picked: 'Đã lấy hàng',
  shipping: 'Đang giao',
  delivering: 'Đang giao',
  delivered: 'Đã giao',
  failed: 'Giao thất bại',
  cancelled: 'Đã hủy vận chuyển',
}

const progressStatuses: OrderStatus[] = ['confirmed', 'packed', 'shipping', 'delivered', 'completed']
const money = (value: number) => `${new Intl.NumberFormat('vi-VN').format(value)}đ`
const closedPaymentActionStatuses = new Set(['completed', 'cancelled', 'returned'])
const paymentActionStatuses = new Set(['pending', 'failed'])

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

const formatDate = (value?: string | null) => {
  if (!value) return 'Đang cập nhật'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Đang cập nhật'

  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Đang cập nhật'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Đang cập nhật'

  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const getShippingStatusLabel = (status?: string | null) => {
  if (!status) return 'Chờ vận chuyển'
  return shippingStatusLabels[status] ?? status
}

const orderNeedsPaymentAction = (order: CustomerOrder) =>
  order.paymentMethod === 'VNPAY' &&
  paymentActionStatuses.has(order.paymentStatus) &&
  !closedPaymentActionStatuses.has(order.status)

const getOrderAlert = (order: CustomerOrder) => {
  if (orderNeedsPaymentAction(order)) {
    return {
      type: order.paymentStatus === 'failed' ? 'error' : 'warning',
      message: order.paymentStatus === 'failed'
        ? 'Thanh toán VNPay chưa thành công. Bạn có thể thử thanh toán lại trước khi hết hạn.'
        : 'Đơn VNPay đang chờ thanh toán. Shop chỉ xử lý giao hàng sau khi hệ thống ghi nhận đã thanh toán.',
    } as const
  }

  if (order.shipping?.status === 'failed') {
    return {
      type: 'error',
      message: 'Đơn vị vận chuyển báo giao không thành công. Shop sẽ liên hệ để xử lý giao lại hoặc hỗ trợ tiếp.',
    } as const
  }

  if (order.status === 'delivered') {
    return {
      type: 'success',
      message: 'Đơn đã giao tới bạn. Kiểm tra hàng và xác nhận đã nhận trong 7 ngày; sau đó hệ thống sẽ tự hoàn tất.',
    } as const
  }

  if (order.status === 'cancelled' && order.paymentStatus === 'paid') {
    return {
      type: 'warning',
      message: 'Đơn đã hủy sau khi thanh toán. Shop sẽ đối soát và xử lý hoàn tiền theo chính sách.',
    } as const
  }

  return null
}

const getNetShipping = (order: CustomerOrder) => Math.max(0, order.shippingFee - order.shippingDiscountAmount)

const getShippingAddressLine = (order: CustomerOrder) => (
  [order.shippingAddress.streetName, order.shippingAddress.ward, order.shippingAddress.district, order.shippingAddress.province]
    .filter(Boolean)
    .join(', ')
)

const isStoppedOrderStatus = (status: OrderStatus) => (
  ['cancelled', 'return_requested', 'return_approved', 'returned'].includes(status)
)

const writeClipboardText = async (value: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  const textArea = document.createElement('textarea')
  textArea.value = value
  textArea.setAttribute('readonly', '')
  textArea.style.position = 'fixed'
  textArea.style.opacity = '0'
  document.body.appendChild(textArea)
  textArea.select()

  try {
    document.execCommand('copy')
  } finally {
    document.body.removeChild(textArea)
  }
}

export function AccountOrdersPage() {
  return (
    <QueryClientProvider client={customerOrdersMutationClient}>
      <AccountOrdersContent />
    </QueryClientProvider>
  )
}

const customerOrdersMutationClient = new QueryClient()
type CustomerOrderLoadMode = 'loading' | 'refresh' | 'silent'

// Lấy câu báo lỗi dễ hiểu để hiển thị cho khách hàng.
const getErrorMessage = (error: unknown, fallback: string) => (
  error instanceof Error ? error.message : fallback
)

// Quản lý việc tải danh sách đơn hàng của khách.
function useCustomerOrderListMutation() {
  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [mode, setMode] = useState<CustomerOrderLoadMode>('loading')
  const [hasLoaded, setHasLoaded] = useState(false)

  const { isPending, mutateAsync } = useMutation({
    mutationFn: async (nextMode: CustomerOrderLoadMode = 'loading') => {
      const result = await requestCustomer<CustomerOrderListResponse>('/orders/me?page=1&limit=100')
      return { result, mode: nextMode }
    },
    onMutate: (nextMode = 'loading') => {
      setMode(nextMode)
    },
    onSuccess: ({ result }) => {
      setOrders(result.items)
    },
    onSettled: () => {
      setHasLoaded(true)
    },
  })

  const loadOrdersAsync = useCallback(async (nextMode: CustomerOrderLoadMode = 'loading') => {
    const { result } = await mutateAsync(nextMode)
    return result
  }, [mutateAsync])

  return {
    orders,
    isLoading: !hasLoaded || (isPending && mode === 'loading'),
    isRefreshing: isPending && mode === 'refresh',
    loadOrdersAsync,
  }
}

type DetailMutationInput = {
  orderId: string
  mode?: CustomerOrderLoadMode
}

// Quản lý việc tải chi tiết đơn và tình trạng thanh toán.
function useCustomerOrderDetailMutation() {
  const [orderDetail, setOrderDetail] = useState<CustomerOrder | null>(null)
  const [detailPayment, setDetailPayment] = useState<PaymentStatusResult | null>(null)
  const [detailError, setDetailError] = useState('')
  const [mode, setMode] = useState<CustomerOrderLoadMode>('loading')
  const [hasLoaded, setHasLoaded] = useState(false)

  const { isPending, mutate, mutateAsync } = useMutation({
    mutationFn: async ({ orderId, mode: nextMode = 'loading' }: DetailMutationInput) => {
      const [order, payment] = await Promise.all([
        orderService.getById(orderId),
        orderService.getPaymentStatus(orderId),
      ])

      return { order, payment, mode: nextMode }
    },
    onMutate: ({ mode: nextMode = 'loading' }) => {
      setMode(nextMode)
      if (nextMode !== 'silent') setDetailError('')
    },
    onSuccess: ({ order, payment }) => {
      setOrderDetail(order)
      setDetailPayment(payment)
      setDetailError('')
    },
    onError: (error, { mode: nextMode = 'loading' }) => {
      if (nextMode !== 'silent') {
        setDetailError(getErrorMessage(error, 'Không thể tải chi tiết đơn hàng.'))
        setOrderDetail(null)
        setDetailPayment(null)
      }
    },
    onSettled: () => {
      setHasLoaded(true)
    },
  })

  const loadOrderDetail = useCallback((orderId: string, nextMode: CustomerOrderLoadMode = 'loading') => {
    mutate({ orderId, mode: nextMode })
  }, [mutate])

  const loadOrderDetailAsync = useCallback(async (
    orderId: string,
    nextMode: CustomerOrderLoadMode = 'loading',
  ) => {
    const { order, payment } = await mutateAsync({ orderId, mode: nextMode })
    return { order, payment }
  }, [mutateAsync])

  const clearOrderDetail = useCallback(() => {
    setOrderDetail(null)
    setDetailPayment(null)
    setDetailError('')
    setHasLoaded(false)
  }, [])

  return {
    orderDetail,
    setOrderDetail,
    detailPayment,
    setDetailPayment,
    detailLoading: !hasLoaded || (isPending && mode === 'loading'),
    detailError,
    clearOrderDetail,
    loadOrderDetail,
    loadOrderDetailAsync,
  }
}

// Hiển thị trang quản lý đơn hàng trong tài khoản khách.
function AccountOrdersContent() {
  const user = useAppSelector((state) => state.auth.currentUser)
  const [filter, setFilter] = useState<'all' | 'needs-payment' | 'active' | 'shipping' | 'completed'>('all')
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const {
    orders,
    isLoading: loading,
    isRefreshing: refreshing,
    loadOrdersAsync,
  } = useCustomerOrderListMutation()
  const {
    orderDetail,
    setOrderDetail,
    detailPayment,
    setDetailPayment,
    detailLoading,
    detailError,
    clearOrderDetail,
    loadOrderDetail,
    loadOrderDetailAsync,
  } = useCustomerOrderDetailMutation()

  // Tải lại danh sách đơn theo kiểu phù hợp: lần đầu, bấm tải lại, hoặc cập nhật nền.
  const load = useCallback(async (mode: CustomerOrderLoadMode = 'refresh') => {
    try {
      await loadOrdersAsync(mode)
    } catch (error) {
      if (mode !== 'silent') {
        message.error(error instanceof Error ? error.message : 'Không thể tải đơn hàng')
      }
    }
  }, [loadOrdersAsync])

  // Sao chép mã đơn, mã hóa đơn hoặc mã vận đơn.
  const copyReference = useCallback(async (value: string, label: string) => {
    if (!value) return

    try {
      await writeClipboardText(value)
    } catch {
      message.error(`Không thể sao chép ${label}.`)
    }
  }, [])

  // Mở popup chi tiết và tải thông tin mới nhất của đơn.
  const openOrderDetail = useCallback((orderId: string) => {
    setSelectedOrderId(orderId)
    loadOrderDetail(orderId)
  }, [loadOrderDetail])

  // Đóng popup chi tiết và dọn dữ liệu đang xem.
  const closeOrderDetail = () => {
    setSelectedOrderId(null)
    clearOrderDetail()
  }

  const orderRealtime = useOrderRealtime((event) => {
    void load('silent')
    if (selectedOrderId && event.orderId === selectedOrderId) {
      loadOrderDetail(selectedOrderId, 'silent')
    }
  })

  useEffect(() => {
    void load('loading')
  }, [load])

  useEffect(() => {
    const refreshVisibleOrders = () => {
      if (document.visibilityState === 'visible') void load('silent')
    }

    const handle = window.setInterval(refreshVisibleOrders, orderRealtime.connected ? 30_000 : 12_000)
    window.addEventListener('focus', refreshVisibleOrders)
    document.addEventListener('visibilitychange', refreshVisibleOrders)

    return () => {
      window.clearInterval(handle)
      window.removeEventListener('focus', refreshVisibleOrders)
      document.removeEventListener('visibilitychange', refreshVisibleOrders)
    }
  }, [load, orderRealtime.connected])

  const confirmReceived = async (orderId: string) => {
    try {
      const updatedOrder = await requestCustomer<CustomerOrder>(`/orders/${orderId}/confirm-received`, { method: 'PATCH' })
      if (selectedOrderId === orderId) {
        setOrderDetail(updatedOrder)
        setDetailPayment(await orderService.getPaymentStatus(orderId).catch(() => detailPayment))
      }
      message.success('Đã xác nhận nhận hàng. Bạn có thể đánh giá từng sản phẩm.')
      await load('refresh')
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không thể xác nhận nhận hàng.')
    }
  }

  const refreshOrderPayment = async (orderId: string) => {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      if (attempt > 0) await wait(2500)
      const paymentStatus = await orderService.getPaymentStatus(orderId)
      if (paymentStatus.paymentStatus === 'paid') {
        await load('silent')
        if (selectedOrderId === orderId) {
          await loadOrderDetailAsync(orderId, 'silent')
        }
        return true
      }
    }

    await load('silent')
    if (selectedOrderId === orderId) {
      await loadOrderDetailAsync(orderId, 'silent')
    }
    return false
  }

  const retryVNPayPayment = async (order: CustomerOrder) => {
    try {
      setPayingOrderId(order._id)
      const paymentData = await orderService.createVNPayUrl(order._id)
      const popup = window.open(paymentData.paymentUrl, '_blank', 'noopener,noreferrer')

      if (!popup) {
        window.location.assign(paymentData.paymentUrl)
        return
      }

      message.info('Đã mở trang thanh toán VNPay. Quay lại tab này sau khi hoàn tất.')
      const paid = await refreshOrderPayment(order._id)
      if (paid) {
        message.success('Đã ghi nhận thanh toán. Shop có thể bắt đầu xử lý đơn.')
      } else {
        message.warning('Chưa ghi nhận thanh toán. Bạn có thể tải lại hoặc thử lại sau vài phút.')
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không thể mở thanh toán VNPay.')
      await load('silent')
    } finally {
      setPayingOrderId(null)
    }
  }

  const visibleOrders = orders.filter((order) => {
    if (filter === 'needs-payment') return orderNeedsPaymentAction(order)
    if (filter === 'active') return ['confirmed', 'packed'].includes(order.status)
    if (filter === 'shipping') return ['shipping', 'delivered'].includes(order.status)
    if (filter === 'completed') return ['completed', 'cancelled', 'returned'].includes(order.status)
    return true
  })
  const detailActiveStep = orderDetail ? progressStatuses.indexOf(orderDetail.status) : -1
  const detailTotalDiscount = (orderDetail?.couponDiscountAmount || 0) + (orderDetail?.membershipDiscountAmount || 0)
  const detailNetShipping = orderDetail ? getNetShipping(orderDetail) : 0

  return (
    <MainLayout>
      <main className="account-page">
        <div className="account-shell">
          <ProfileSidebar name={user?.name} avatarImage={user?.avatarImage} selectedKey="orders" />
          <section className="account-content">
            <div className="account-section-heading">
              <h1>Đơn hàng của tôi</h1>
              <Button loading={refreshing && !loading} onClick={() => void load()}>
                Tải lại
              </Button>
            </div>

            <Segmented
              className="account-order-filters"
              value={filter}
              onChange={(value) => setFilter(value as typeof filter)}
              options={[
                { label: 'Tất cả', value: 'all' },
                { label: `Cần thanh toán (${orders.filter(orderNeedsPaymentAction).length})`, value: 'needs-payment' },
                { label: 'Đang xử lý', value: 'active' },
                { label: 'Đang giao', value: 'shipping' },
                { label: 'Lịch sử', value: 'completed' },
              ]}
            />

            <Spin spinning={loading}>
              {!visibleOrders.length && !loading ? (
                <Empty description="Chưa có đơn hàng" />
              ) : (
                <div className="account-order-list">
                  {visibleOrders.map((order) => {
                    const alert = getOrderAlert(order)

                    return (
                    <article className="account-order-card" key={order._id}>
                      <header>
                        <div className="account-order-code-group">
                          <span className="account-code-with-copy">
                            <strong>{order.orderCode}</strong>
                            <button
                              className="account-copy-button"
                              type="button"
                              onClick={() => void copyReference(order.orderCode, 'mã đơn')}
                              aria-label="Sao chép mã đơn"
                            >
                              <CopyIcon />
                            </button>
                          </span>
                          {order.invoiceCode ? (
                            <span className="account-code-with-copy is-subtle">
                              <span>Hóa đơn: {order.invoiceCode}</span>
                              <button
                                className="account-copy-button"
                                type="button"
                                onClick={() => void copyReference(order.invoiceCode ?? '', 'mã hóa đơn')}
                                aria-label="Sao chép mã hóa đơn"
                              >
                                <CopyIcon />
                              </button>
                            </span>
                          ) : null}
                          <div className="account-order-meta">
                            <Tag>{paymentMethodLabels[order.paymentMethod] ?? order.paymentMethod}</Tag>
                            <Tag color={order.paymentStatus === 'paid' ? 'green' : order.paymentStatus === 'failed' ? 'red' : 'gold'}>
                              {paymentStatusLabels[order.paymentStatus] ?? order.paymentStatus}
                            </Tag>
                            {order.paymentDeadlineAt && orderNeedsPaymentAction(order) ? (
                              <Tag color="orange">Hạn: {formatDateTime(order.paymentDeadlineAt)}</Tag>
                            ) : null}
                          </div>
                        </div>
                        <span className={`account-status-pill is-${order.status}`}>
                          {orderStatusLabels[order.status] ?? order.status}
                        </span>
                      </header>
                      {alert ? <Alert type={alert.type} showIcon message={alert.message} /> : null}
                      <div className="account-order-logistics">
                        <span>Ngày đặt: {formatDate(order.createdAt)}</span>
                        <span>Vận chuyển: {order.shipping?.provider || 'Đang cập nhật'} · {getShippingStatusLabel(order.shipping?.status)}</span>
                        {order.shipping?.trackingCode ? (
                          <span className="account-code-with-copy is-subtle">
                            <span>Mã vận đơn: {order.shipping.trackingCode}</span>
                            <button
                              className="account-copy-button"
                              type="button"
                              onClick={() => void copyReference(order.shipping?.trackingCode ?? '', 'mã vận đơn')}
                              aria-label="Sao chép mã vận đơn"
                            >
                              <CopyIcon />
                            </button>
                          </span>
                        ) : null}
                        {order.shipping?.estimatedDeliveryDate ? (
                          <span>Dự kiến giao: {formatDate(order.shipping.estimatedDeliveryDate)}</span>
                        ) : null}
                      </div>
                      {order.order_list.map((item) => (
                        <div className="account-order-item" key={item._id}>
                          <img src={item.image} alt="" />
                          <div>
                            <strong>{item.name}</strong>
                            <span>{item.color} · Size {item.size} · SL {item.quantity}</span>
                          </div>
                          {order.status === 'completed' && order.paymentStatus === 'paid' ? (
                            <Button href={`/products/${item.productId}?compose=1&orderId=${order._id}&orderItemId=${item._id}`}>
                              Viết đánh giá
                            </Button>
                          ) : null}
                        </div>
                      ))}
                      <footer>
                        <b>{money(order.totalAmount)}</b>
                        <div className="account-order-actions">
                        {orderNeedsPaymentAction(order) ? (
                          <Button
                            type="primary"
                            loading={payingOrderId === order._id}
                            onClick={() => void retryVNPayPayment(order)}
                          >
                            {order.paymentStatus === 'failed' ? 'Thanh toán lại' : 'Thanh toán VNPay'}
                          </Button>
                        ) : null}
                        {order.status === 'delivered' ? (
                          <Button type="primary" onClick={() => void confirmReceived(order._id)}>
                            Đã nhận hàng
                          </Button>
                        ) : null}
                        <Button onClick={() => openOrderDetail(order._id)}>
                          Xem chi tiết
                        </Button>
                        </div>
                      </footer>
                    </article>
                    )
                  })}
                </div>
              )}
            </Spin>
            <Alert
              type="info"
              message="VNPay cần được thanh toán trước khi shop đóng gói/giao hàng. COD được ghi nhận đã thanh toán khi đơn vị vận chuyển báo giao thành công."
            />

            <Modal
              className="account-order-detail-modal"
              title={orderDetail ? `Chi tiết đơn ${orderDetail.orderCode}` : 'Chi tiết đơn hàng'}
              open={Boolean(selectedOrderId)}
              width={960}
              footer={[
                <Button key="close" onClick={closeOrderDetail}>Đóng</Button>,
                orderDetail ? <Button key="open-page" href={`/orders/${orderDetail._id}`}>Mở trang chi tiết</Button> : null,
                orderDetail && detailPayment?.canPayNow ? (
                  <Button key="pay" type="primary" loading={payingOrderId === orderDetail._id} onClick={() => void retryVNPayPayment(orderDetail)}>
                    {orderDetail.paymentStatus === 'failed' ? 'Thanh toán lại' : 'Thanh toán VNPay'}
                  </Button>
                ) : null,
                orderDetail?.status === 'delivered' ? (
                  <Button key="received" type="primary" onClick={() => void confirmReceived(orderDetail._id)}>
                    Đã nhận hàng
                  </Button>
                ) : null,
              ].filter(Boolean)}
              onCancel={closeOrderDetail}
            >
              {detailError ? (
                <Alert
                  type="error"
                  showIcon
                  message={detailError}
                  action={selectedOrderId ? <Button size="small" onClick={() => loadOrderDetail(selectedOrderId)}>Thử lại</Button> : undefined}
                />
              ) : null}

              <Skeleton active loading={detailLoading} paragraph={{ rows: 10 }}>
                {orderDetail ? (
                  <div className="account-order-detail">
                    <header className="account-order-detail-header">
                      <div>
                        <strong>{orderStatusLabels[orderDetail.status]}</strong>
                        <span>Ngày đặt: {formatDateTime(orderDetail.createdAt)}</span>
                        {orderDetail.shipping.estimatedDeliveryDate ? (
                          <span>Dự kiến giao: {formatDate(orderDetail.shipping.estimatedDeliveryDate)}</span>
                        ) : null}
                      </div>
                      <span className={`order-payment-badge ${orderDetail.paymentStatus}`}>
                        {paymentStatusLabels[orderDetail.paymentStatus]}
                      </span>
                    </header>

                    <section className={`account-order-progress ${isStoppedOrderStatus(orderDetail.status) ? 'is-stopped' : ''}`}>
                      {isStoppedOrderStatus(orderDetail.status) ? (
                        <div className="account-order-stopped">
                          <b>{orderStatusLabels[orderDetail.status]}</b>
                          <span>Cập nhật {formatDateTime(orderDetail.updatedAt)}</span>
                        </div>
                      ) : progressStatuses.map((status, index) => {
                        const completed = index <= detailActiveStep
                        return (
                          <div className={`account-order-progress-step ${completed ? 'completed' : ''}`} key={status}>
                            <span>{completed ? '✓' : index + 1}</span>
                            <b>{orderStatusLabels[status]}</b>
                            <small>{completed ? formatDateTime(index === 0 ? orderDetail.createdAt : orderDetail.updatedAt) : 'Đang cập nhật'}</small>
                          </div>
                        )
                      })}
                    </section>

                    <div className="account-order-detail-grid">
                      <section className="account-order-detail-products">
                        {orderDetail.order_list.map((item) => (
                          <article className="account-order-detail-product" key={item._id}>
                            <img src={item.image} alt="" />
                            <div>
                              <strong>{item.name}</strong>
                              <span>{[item.color, `Size ${item.size}`, item.fitType, item.sku].filter(Boolean).join(' · ')}</span>
                            </div>
                            <b>{money(item.priceAtPurchased)} × {item.quantity}</b>
                          </article>
                        ))}
                      </section>

                      <aside className="account-order-detail-summary">
                        <h2>Tóm tắt đơn hàng</h2>
                        <p><span>Tạm tính</span><b>{money(orderDetail.subTotal)}</b></p>
                        {orderDetail.couponDiscountAmount > 0 ? <p><span>Giảm giá {orderDetail.couponCode ? `(${orderDetail.couponCode})` : ''}</span><b>-{money(orderDetail.couponDiscountAmount)}</b></p> : null}
                        {orderDetail.membershipDiscountAmount > 0 ? <p><span>Ưu đãi thành viên {orderDetail.appliedMembershipDiscountPercent ? `(${orderDetail.appliedMembershipDiscountPercent}%)` : ''}</span><b>-{money(orderDetail.membershipDiscountAmount)}</b></p> : null}
                        {detailTotalDiscount === 0 ? <p><span>Giảm giá</span><b>{money(0)}</b></p> : null}
                        <p><span>Phí giao hàng</span><b>{detailNetShipping === 0 ? 'Miễn phí' : money(detailNetShipping)}</b></p>
                        {orderDetail.taxAmount > 0 ? <p><span>Thuế</span><b>+{money(orderDetail.taxAmount)}</b></p> : null}
                        <div><span>Tổng cộng</span><strong>{money(orderDetail.totalAmount)}</strong></div>
                      </aside>
                    </div>

                    <div className="account-order-detail-info">
                      <section>
                        <h2>Thanh toán</h2>
                        <strong>{paymentMethodLabels[orderDetail.paymentMethod]}</strong>
                        <span>{paymentStatusLabels[orderDetail.paymentStatus]}</span>
                        {orderDetail.paymentDeadlineAt && orderNeedsPaymentAction(orderDetail) ? <small>Hạn thanh toán: {formatDateTime(orderDetail.paymentDeadlineAt)}</small> : null}
                        {detailPayment?.latestTransaction?.failureReason ? <small>{detailPayment.latestTransaction.failureReason}</small> : null}
                      </section>
                      <section>
                        <h2>Giao hàng</h2>
                        <strong>{orderDetail.shippingAddress.customerName}</strong>
                        <span>{orderDetail.shippingAddress.phoneNumber}</span>
                        <p>{getShippingAddressLine(orderDetail)}</p>
                        <small>{getShippingStatusLabel(orderDetail.shipping.status)}</small>
                        {orderDetail.shipping.trackingCode ? <small>Mã vận đơn: {orderDetail.shipping.trackingCode}</small> : null}
                      </section>
                    </div>

                    {(orderDetail.orderNote || orderDetail.cancellation || orderDetail.returnRequest) ? (
                      <section className="account-order-detail-note">
                        {orderDetail.orderNote ? <p><b>Ghi chú:</b> {orderDetail.orderNote}</p> : null}
                        {orderDetail.cancellation ? <p><b>Lý do hủy:</b> {orderDetail.cancellation.reason || 'Đang cập nhật'} · {formatDateTime(orderDetail.cancellation.cancelledAt)}</p> : null}
                        {orderDetail.returnRequest ? <p><b>Yêu cầu trả hàng:</b> {orderDetail.returnRequest.reason} · {orderDetail.returnRequest.reviewReason || orderDetail.returnRequest.status}</p> : null}
                      </section>
                    ) : null}
                  </div>
                ) : null}
              </Skeleton>
            </Modal>
          </section>
        </div>
      </main>
    </MainLayout>
  )
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 7V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2Zm2 0h4a2 2 0 0 1 2 2v6h2V5h-8v2Zm-4 2v10h8V9H6Z" />
    </svg>
  )
}
