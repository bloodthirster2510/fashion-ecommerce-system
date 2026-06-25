import { useEffect, useState } from 'react'
import { Alert, Button, Empty, Image, Skeleton } from 'antd'
import { formatPrice } from '../../../utils/formatPrice'
import { orderService } from '../../orders/order.service'
import type { CustomerOrder, OrderStatus } from '../../orders/order.types'
import { formatDisplayDate, getOrderItemMeta } from '../profile.utils'

const statusLabels: Record<OrderStatus, string> = {
  confirmed: 'Đang xử lý',
  packed: 'Đã đóng gói',
  shipping: 'Đang giao',
  delivered: 'Đã giao',
  cancelled: 'Đã hủy',
  return_requested: 'Yêu cầu trả hàng',
  returned: 'Đã trả hàng',
}

const statusClasses: Record<OrderStatus, string> = {
  confirmed: 'processing',
  packed: 'processing',
  shipping: 'shipping',
  delivered: 'delivered',
  cancelled: 'cancelled',
  return_requested: 'returning',
  returned: 'returned',
}

export function OrdersSection() {
  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [isLoadingOrders, setIsLoadingOrders] = useState(false)
  const [ordersError, setOrdersError] = useState('')

  const loadOrders = () => {
    setIsLoadingOrders(true)
    setOrdersError('')
    orderService
      .getMine()
      .then((result) => setOrders(result.items))
      .catch((loadError: unknown) => {
        setOrdersError(loadError instanceof Error ? loadError.message : 'Không thể tải danh sách đơn hàng.')
      })
      .finally(() => setIsLoadingOrders(false))
  }

  useEffect(() => {
    loadOrders()
  }, [])

  return (
    <section className="account-orders" aria-labelledby="account-orders-title">
      <div className="account-section-heading">
        <h1 id="account-orders-title">Đơn hàng của bạn</h1>
        <Button onClick={loadOrders}>Cập nhật</Button>
      </div>

      {ordersError && <Alert type="error" message={ordersError} showIcon />}

      <Skeleton active loading={isLoadingOrders} paragraph={{ rows: 8 }}>
        {!orders.length && !ordersError ? (
          <Empty description="Bạn chưa có đơn hàng nào." />
        ) : (
          <div className="account-order-list">
            {orders.map((order) => (
              <article className="account-order-card" key={order._id}>
                <header>
                  <div>
                    <h2>Đơn hàng #{order.orderCode}</h2>
                    <span>Ngày đặt: {formatDisplayDate(order.createdAt)}</span>
                  </div>
                  <span className={`account-order-status ${statusClasses[order.status]}`}>{statusLabels[order.status]}</span>
                </header>

                <div className="account-order-items">
                  {order.order_list.map((item) => (
                    <div className="account-order-item" key={item._id}>
                      <Image
                        className="account-order-image"
                        src={item.image}
                        alt={item.name}
                        fallback="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='90' height='90'%3E%3Crect width='100%25' height='100%25' fill='%23e7ebef'/%3E%3C/svg%3E"
                        preview={false}
                      />
                      <div>
                        <strong>{item.name}</strong>
                        <span>{[getOrderItemMeta(item), `SL: ${item.quantity}`].filter(Boolean).join(' | ')}</span>
                      </div>
                      <b>{formatPrice(item.priceAtPurchased * item.quantity)}</b>
                    </div>
                  ))}
                </div>

                <footer>
                  <span>Tổng cộng:</span>
                  <strong>{formatPrice(order.totalAmount)}</strong>
                </footer>

                <Button block href={`/orders/${order._id}`}>
                  Xem chi tiết
                </Button>
              </article>
            ))}
          </div>
        )}
      </Skeleton>
    </section>
  )
}
