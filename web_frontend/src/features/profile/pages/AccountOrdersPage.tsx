import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Empty, Segmented, Spin, Tag, message } from 'antd'
import { MainLayout } from '../../../layouts/MainLayout'
import { requestCustomer } from '../../../services/customerHttp'
import { ProfileSidebar } from '../components/ProfileSidebar'
import { useAppSelector } from '../../../app/hooks'
import { paymentService } from '../payment.service'
import '../profile.css'

type OrderItem = {
  _id: string
  productId: string
  name: string
  image: string
  color: string
  size: string
  quantity: number
}

type Order = {
  _id: string
  orderCode: string
  invoiceCode?: string | null
  status: string
  paymentMethod: string
  paymentStatus: string
  paymentDeadlineAt?: string | null
  deliveredAt?: string | null
  receivedAt?: string | null
  shipping?: {
    provider?: string | null
    status?: string | null
    trackingCode?: string | null
    estimatedDeliveryDate?: string | null
  } | null
  totalAmount: number
  createdAt: string
  updatedAt?: string
  order_list: OrderItem[]
}

const orderStatusLabels: Record<string, string> = {
  confirmed: 'Chờ xử lý',
  packed: 'Đang chuẩn bị',
  shipping: 'Đang giao',
  delivered: 'Đã giao tới bạn',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
  return_requested: 'Đang duyệt trả hàng',
  returned: 'Đã trả hàng',
}

const paymentStatusLabels: Record<string, string> = {
  pending: 'Chờ thanh toán',
  paid: 'Đã thanh toán',
  failed: 'Thanh toán thất bại',
  refunded: 'Đã hoàn tiền',
}

const paymentMethodLabels: Record<string, string> = {
  COD: 'Thanh toán khi nhận hàng',
  VNPAY: 'VNPay',
  MOMO: 'MoMo',
  CARD: 'Thẻ thanh toán',
  BANK: 'Chuyển khoản',
}

const shippingStatusLabels: Record<string, string> = {
  quoted: 'Đã báo phí',
  fallback: 'Phí cố định',
  ready: 'Sẵn sàng giao',
  picking: 'Đang lấy hàng',
  picked: 'Đã lấy hàng',
  shipping: 'Đang giao',
  delivering: 'Đang giao',
  delivered: 'Đã giao',
  failed: 'Giao thất bại',
  cancelled: 'Đã hủy vận chuyển',
}

type OrderList = {
  items: Order[]
  pagination: { totalItems: number }
}

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

const orderNeedsPaymentAction = (order: Order) =>
  order.paymentMethod === 'VNPAY' &&
  paymentActionStatuses.has(order.paymentStatus) &&
  !closedPaymentActionStatuses.has(order.status)

const getOrderAlert = (order: Order) => {
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
  const user = useAppSelector((state) => state.auth.currentUser)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<'all' | 'needs-payment' | 'active' | 'shipping' | 'completed'>('all')
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null)

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true)

    try {
      const result = await requestCustomer<OrderList>('/orders/me?page=1&limit=100')
      setOrders(result.items)
    } catch (error) {
      if (!quiet) {
        message.error(error instanceof Error ? error.message : 'Không thể tải đơn hàng')
      }
    } finally {
      setLoading(false)
      if (!quiet) setRefreshing(false)
    }
  }, [])

  const copyReference = useCallback(async (value: string, label: string) => {
    if (!value) return

    try {
      await writeClipboardText(value)
    } catch {
      message.error(`Không thể sao chép ${label}.`)
    }
  }, [])

  useEffect(() => {
    void load(true)
  }, [load])

  useEffect(() => {
    const refreshVisibleOrders = () => {
      if (document.visibilityState === 'visible') void load(true)
    }

    const handle = window.setInterval(refreshVisibleOrders, 20_000)
    window.addEventListener('focus', refreshVisibleOrders)
    document.addEventListener('visibilitychange', refreshVisibleOrders)

    return () => {
      window.clearInterval(handle)
      window.removeEventListener('focus', refreshVisibleOrders)
      document.removeEventListener('visibilitychange', refreshVisibleOrders)
    }
  }, [load])

  const confirmReceived = async (orderId: string) => {
    try {
      await requestCustomer(`/orders/${orderId}/confirm-received`, { method: 'PATCH' })
      message.success('Đã xác nhận nhận hàng. Bạn có thể đánh giá từng sản phẩm.')
      await load()
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không thể xác nhận nhận hàng.')
    }
  }

  const refreshOrderPayment = async (orderId: string) => {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      if (attempt > 0) await wait(2500)
      const paymentStatus = await paymentService.getOrderPaymentStatus(orderId)
      if (paymentStatus.paymentStatus === 'paid') {
        await load(true)
        return true
      }
    }

    await load(true)
    return false
  }

  const retryVNPayPayment = async (order: Order) => {
    try {
      setPayingOrderId(order._id)
      const paymentData = await paymentService.createVNPayUrlFromOrder(order._id)
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
      await load(true)
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
