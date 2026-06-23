import { useEffect, useState } from 'react'
import { Alert, Button, Empty, Spin, message } from 'antd'
import { MainLayout } from '../../../layouts/MainLayout'
import { requestCustomer } from '../../../services/customerHttp'
import { ProfileSidebar } from '../components/ProfileSidebar'
import { useAppSelector } from '../../../app/hooks'
import '../profile.css'

type OrderItem = { _id: string; productId: string; name: string; image: string; color: string; size: string; quantity: number }
type Order = { _id: string; orderCode: string; status: string; paymentStatus: string; totalAmount: number; createdAt: string; order_list: OrderItem[] }
type OrderList = { items: Order[]; pagination: { totalItems: number } }

const money = (value: number) => `${new Intl.NumberFormat('vi-VN').format(value)}đ`

export function AccountOrdersPage() {
  const user = useAppSelector((state) => state.auth.currentUser)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const load = () => requestCustomer<OrderList>('/orders/me?page=1&limit=100').then((result) => setOrders(result.items))
  useEffect(() => { void load().catch((error) => message.error(error instanceof Error ? error.message : 'Không thể tải đơn hàng')).finally(() => setLoading(false)) }, [])
  const confirmReceived = async (orderId: string) => {
    try {
      await requestCustomer(`/orders/${orderId}/confirm-received`, { method: 'PATCH' })
      message.success('Đã xác nhận nhận hàng. Bạn có thể đánh giá từng sản phẩm.')
      await load()
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không thể xác nhận nhận hàng.')
    }
  }
  return <MainLayout showSlider={false}><main className="account-page"><div className="account-shell"><ProfileSidebar name={user?.name} avatarImage={user?.avatarImage} selectedKey="orders" /><section className="account-content"><h1>Đơn hàng của tôi</h1><Spin spinning={loading}>{!orders.length && !loading ? <Empty description="Chưa có đơn hàng" /> : <div className="account-order-list">{orders.map((order) => <article className="account-order-card" key={order._id}><header><strong>{order.orderCode}</strong><span>{order.status}</span></header>{order.order_list.map((item) => <div className="account-order-item" key={item._id}><img src={item.image} alt="" /><div><strong>{item.name}</strong><span>{item.color} · Size {item.size} · SL {item.quantity}</span></div>{order.status === 'delivered' && order.paymentStatus === 'paid' ? <Button href={`/products/${item.productId}?compose=1&orderId=${order._id}&orderItemId=${item._id}`}>Viết đánh giá</Button> : null}</div>)}<footer><b>{money(order.totalAmount)}</b>{order.status === 'shipping' ? <Button type="primary" onClick={() => void confirmReceived(order._id)}>Đã nhận hàng</Button> : null}</footer></article>)}</div>}</Spin><Alert type="info" message="Nút Viết đánh giá xuất hiện sau khi đơn đã giao và thanh toán." /></section></div></main></MainLayout>
}
