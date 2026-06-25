import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Empty, Spin, message } from 'antd'
import { MainLayout } from '../../../layouts/MainLayout'
import { requestCustomer } from '../../../services/customerHttp'
import { ProfileSidebar } from '../components/ProfileSidebar'
import { useAppSelector } from '../../../app/hooks'
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
  paymentStatus: string
  totalAmount: number
  createdAt: string
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

type OrderList = {
  items: Order[]
  pagination: { totalItems: number }
}

const money = (value: number) => `${new Intl.NumberFormat('vi-VN').format(value)}đ`

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

  return (
    <MainLayout showSlider={false}>
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

            <Spin spinning={loading}>
              {!orders.length && !loading ? (
                <Empty description="Chưa có đơn hàng" />
              ) : (
                <div className="account-order-list">
                  {orders.map((order) => (
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
                        </div>
                        <span className={`account-status-pill is-${order.status}`}>
                          {orderStatusLabels[order.status] ?? order.status}
                        </span>
                      </header>
                      {order.status === 'delivered' ? (
                        <Alert
                          type="success"
                          showIcon
                          message="Đơn đã giao tới bạn. Kiểm tra hàng và xác nhận đã nhận trong 7 ngày; sau đó hệ thống sẽ tự hoàn tất."
                        />
                      ) : null}
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
                        {order.status === 'delivered' ? (
                          <Button type="primary" onClick={() => void confirmReceived(order._id)}>
                            Đã nhận hàng
                          </Button>
                        ) : null}
                      </footer>
                    </article>
                  ))}
                </div>
              )}
            </Spin>
            <Alert type="info" message="Nút Viết đánh giá xuất hiện sau khi bạn xác nhận đã nhận hàng và đơn đã thanh toán." />
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
