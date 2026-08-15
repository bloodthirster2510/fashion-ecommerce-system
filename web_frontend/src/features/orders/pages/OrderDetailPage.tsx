import { useCallback, useEffect, useMemo, useState } from 'react'
import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query'
import { Alert, Button, Empty, Image, Input, Modal, Skeleton, message } from 'antd'
import {
  CheckOutlined,
  ClockCircleOutlined,
  CreditCardOutlined,
  EnvironmentOutlined,
  ShoppingOutlined,
  StopOutlined,
  UndoOutlined,
} from '@ant-design/icons'
import { MainLayout } from '../../../layouts/MainLayout'
import { formatPrice } from '../../../utils/formatPrice'
import { catalogService } from '../../catalog/catalog.service'
import { orderService } from '../order.service'
import { useOrderRealtime } from '../orderRealtime'
import type { CustomerOrder, OrderItem, OrderStatus, PaymentStatusResult } from '../order.types'
import '../order.css'

const statusLabels: Record<OrderStatus, string> = {
  confirmed: 'Đã xác nhận', packed: 'Đã đóng gói', shipping: 'Đang giao hàng', delivered: 'Đã giao',
  completed: 'Hoàn tất', cancelled: 'Đã hủy', return_requested: 'Đang yêu cầu trả hàng',
  return_approved: 'Yêu cầu trả đã duyệt', returned: 'Đã trả hàng',
}
const paymentLabels = { pending: 'Chờ thanh toán', paid: 'Đã thanh toán', failed: 'Thanh toán thất bại', refunded: 'Đã hoàn tiền' }
const paymentMethods = { COD: 'Thanh toán khi nhận hàng (COD)', VNPAY: 'VNPay', MOMO: 'MoMo', CARD: 'Thẻ', BANK: 'Chuyển khoản' }
const progressStatuses: OrderStatus[] = ['confirmed', 'packed', 'shipping', 'delivered', 'completed']

const formatDate = (value?: string | null, includeTime = false) => {
  if (!value) return 'Đang cập nhật'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Đang cập nhật'
  return new Intl.DateTimeFormat('vi-VN', includeTime
    ? { dateStyle: 'medium', timeStyle: 'short' }
    : { dateStyle: 'long' }).format(date)
}

const isObjectIdText = (value?: string) => Boolean(value && /^[a-f\d]{24}$/i.test(value))

export function OrderDetailPage({ orderId }: { orderId: string }) {
  return (
    <QueryClientProvider client={customerOrderDetailMutationClient}>
      <OrderDetailContent orderId={orderId} />
    </QueryClientProvider>
  )
}

const customerOrderDetailMutationClient = new QueryClient()
type CustomerOrderLoadMode = 'loading' | 'refresh' | 'silent'


const getErrorMessage = (error: unknown, fallback: string) => (
  error instanceof Error ? error.message : fallback
)

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

  const { isPending, mutateAsync } = useMutation({
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
        setDetailError(getErrorMessage(error, 'Không thể tải thông tin đơn hàng.'))
      }
    },
    onSettled: () => {
      setHasLoaded(true)
    },
  })

  const loadOrderDetailAsync = useCallback(async (
    orderId: string,
    nextMode: CustomerOrderLoadMode = 'loading',
  ) => {
    const { order, payment } = await mutateAsync({ orderId, mode: nextMode })
    return { order, payment }
  }, [mutateAsync])

  return {
    orderDetail,
    setOrderDetail,
    detailPayment,
    detailError,
    detailLoading: !hasLoaded || (isPending && mode === 'loading'),
    loadOrderDetailAsync,
  }
}

// Hiển thị toàn bộ thông tin của một đơn hàng cụ thể.
function OrderDetailContent({ orderId }: { orderId: string }) {
  const {
    orderDetail: order,
    setOrderDetail: setOrder,
    detailPayment: payment,
    detailError: error,
    detailLoading: loading,
    loadOrderDetailAsync,
  } = useCustomerOrderDetailMutation()
  const [fitTypeLabelByItemId, setFitTypeLabelByItemId] = useState<Record<string, string>>({})
  const [paying, setPaying] = useState(false)
  const [orderAction, setOrderAction] = useState<'cancel' | 'return' | null>(null)
  const [actionReason, setActionReason] = useState('')
  const [actionSubmitting, setActionSubmitting] = useState(false)

  // Tải lại đơn hàng khi mở trang hoặc khi có cập nhật trạng thái.
  const loadOrder = useCallback(async (mode: CustomerOrderLoadMode = 'loading') => {
    try {
      await loadOrderDetailAsync(orderId, mode)
    } catch {
      // Lỗi đã được lưu để hiển thị ngay trên trang.
    }
  }, [loadOrderDetailAsync, orderId])

  useEffect(() => { void loadOrder() }, [loadOrder])

  const orderRealtime = useOrderRealtime((event) => {
    if (event.orderId === orderId) void loadOrder('silent')
  })

  useEffect(() => {
    orderRealtime.subscribeOrder(orderId)
    return () => orderRealtime.unsubscribeOrder(orderId)
  }, [orderId, orderRealtime])

  useEffect(() => {
    const handle = window.setInterval(() => {
      void loadOrder('silent')
    }, orderRealtime.connected ? 30_000 : 12_000)

    return () => window.clearInterval(handle)
  }, [loadOrder, orderRealtime.connected])

  useEffect(() => {
    const itemsNeedingLabels = order?.order_list.filter((item) => isObjectIdText(item.fitType)) ?? []

    if (!itemsNeedingLabels.length) {
      setFitTypeLabelByItemId({})
      return
    }

    let isMounted = true
    const productIds = Array.from(new Set(itemsNeedingLabels.map((item) => item.productId).filter(Boolean)))

    Promise.all(productIds.map((productId) => catalogService.getProductById(productId)))
      .then((products) => {
        if (!isMounted) return

        const labelByProductVariant = new Map<string, string>()
        const labelByProductFitType = new Map<string, string>()

        products.forEach((product) => {
          product.variants.forEach((variant) => {
            const label = variant.fitType?.label
            if (!label) return

            labelByProductVariant.set(`${product._id}:${variant._id}`, label)
            labelByProductFitType.set(`${product._id}:${variant.fitTypeId}`, label)
          })
        })

        const nextLabels = itemsNeedingLabels.reduce<Record<string, string>>((labels, item) => {
          const label = item.variantId
            ? labelByProductVariant.get(`${item.productId}:${item.variantId}`)
            : labelByProductFitType.get(`${item.productId}:${item.fitType}`)

          if (label) {
            labels[item._id] = label
          }

          return labels
        }, {})

        setFitTypeLabelByItemId(nextLabels)
      })
      .catch(() => {
        if (isMounted) {
          setFitTypeLabelByItemId({})
        }
      })

    return () => {
      isMounted = false
    }
  }, [order])

  const activeStep = useMemo(() => order ? progressStatuses.indexOf(order.status) : -1, [order])
  const totalDiscount = (order?.couponDiscountAmount || 0) + (order?.membershipDiscountAmount || 0)
  const netShipping = Math.max(0, (order?.shippingFee || 0) - (order?.shippingDiscountAmount || 0))
  const getOrderItemMeta = (item: OrderItem) => {
    const fitType = isObjectIdText(item.fitType) ? fitTypeLabelByItemId[item._id] : item.fitType

    return [item.color, item.size, fitType].filter((value): value is string => Boolean(value?.trim()))
  }

  const payAgain = async () => {
    if (!order || !payment?.canPayNow) return
    setPaying(true)
    try {
      const result = await orderService.createVNPayUrl(order._id)
      window.location.assign(result.paymentUrl)
    } catch (payError) {
      message.error(payError instanceof Error ? payError.message : 'Không thể mở cổng thanh toán.')
      setPaying(false)
    }
  }

  const submitOrderAction = async () => {
    if (!order || !orderAction || actionReason.trim().length < 5) return
    setActionSubmitting(true)
    try {
      const updatedOrder = orderAction === 'cancel'
        ? await orderService.cancel(order._id, actionReason.trim())
        : await orderService.requestReturn(order._id, actionReason.trim())
      setOrder(updatedOrder)
      setOrderAction(null)
      setActionReason('')
      message.success(orderAction === 'cancel' ? 'Đã hủy đơn hàng.' : 'Đã gửi yêu cầu trả hàng.')
      await loadOrder()
    } catch (actionError) {
      message.error(actionError instanceof Error ? actionError.message : 'Không thể cập nhật đơn hàng.')
    } finally {
      setActionSubmitting(false)
    }
  }

  return (
    <MainLayout>
      <main className="order-detail-page">
        <nav className="order-breadcrumb"><a href="/">Trang chủ</a><span>›</span><a href="/account?section=orders">Đơn hàng</a><span>›</span><span>{order?.orderCode || 'Chi tiết'}</span></nav>
        {error && <Alert type="error" showIcon message={error} action={<Button size="small" onClick={() => void loadOrder()}>Thử lại</Button>} />}
        <Skeleton active loading={loading} paragraph={{ rows: 12 }}>
          {!loading && !order ? <Empty description="Không tìm thấy đơn hàng" /> : order && (
            <>
              <header className="order-heading">
                <div>
                  <div className="order-title-row"><h1>Mã đơn hàng: {order.orderCode}</h1><span className={`order-payment-badge ${order.paymentStatus}`}>{paymentLabels[order.paymentStatus]}</span></div>
                  <p>Ngày đặt: <b>{formatDate(order.createdAt, true)}</b>{order.shipping.estimatedDeliveryDate && <><span className="order-dot">•</span><em>Dự kiến giao: {formatDate(order.shipping.estimatedDeliveryDate)}</em></>}</p>
                </div>
                <div className="order-customer-actions">
                  {['confirmed', 'packed'].includes(order.status) ? (
                    <Button danger icon={<StopOutlined />} onClick={() => setOrderAction('cancel')}>Hủy đơn</Button>
                  ) : null}
                  {['delivered', 'completed'].includes(order.status) ? (
                    <Button icon={<UndoOutlined />} onClick={() => setOrderAction('return')}>Yêu cầu trả hàng</Button>
                  ) : null}
                </div>
              </header>

              {payment?.canPayNow && (
                <Alert className="payment-action-alert" type={order.paymentStatus === 'failed' ? 'error' : 'warning'} showIcon
                  message={order.paymentStatus === 'failed' ? 'Giao dịch trước chưa thành công' : 'Đơn hàng đang chờ thanh toán'}
                  description="Bạn có thể tiếp tục thanh toán an toàn qua VNPay."
                  action={(
                    <Button type="primary" loading={paying} onClick={() => void payAgain()}>
                      {order.paymentStatus === 'failed' ? 'Thanh toán lại' : 'Thanh toán ngay'}
                    </Button>
                  )} />
              )}

              <section className={`order-progress-card ${['cancelled', 'return_requested', 'return_approved', 'returned'].includes(order.status) ? 'is-stopped' : ''}`}>
                {(['cancelled', 'return_requested', 'return_approved', 'returned'] as OrderStatus[]).includes(order.status) ? (
                  <div className="order-stopped"><ClockCircleOutlined /><div><b>{statusLabels[order.status]}</b><span>Cập nhật {formatDate(order.updatedAt, true)}</span></div></div>
                ) : progressStatuses.map((status, index) => {
                  const completed = index <= activeStep
                  return <div className={`order-progress-step ${completed ? 'completed' : ''}`} key={status}>
                    <span className="step-mark">{completed ? <CheckOutlined /> : index + 1}</span>
                    <b>{statusLabels[status]}</b>
                    <small>{completed ? formatDate(index === 0 ? order.createdAt : order.updatedAt, true) : 'Đang cập nhật'}</small>
                  </div>
                })}
              </section>

              <div className="order-detail-grid">
                <div className="order-main-column">
                  <section className="order-items-card">
                    {order.order_list.map((item) => <article className="order-product" key={item._id}>
                      <Image className="order-product-image" src={item.image} alt={item.name} fallback="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Crect width='100%25' height='100%25' fill='%23eef1f3'/%3E%3C/svg%3E" preview={false} />
                      <div>
                        <h2>{item.name}</h2>
                        <p>{getOrderItemMeta(item).map((value, index) => (
                          <span key={`${item._id}-${value}`}>
                            {index > 0 && '• '}
                            {value}
                          </span>
                        ))}</p>
                      </div>
                      <div className="order-product-price"><b>{formatPrice(item.priceAtPurchased)}</b><span>SL: {item.quantity}</span></div>
                    </article>)}
                  </section>

                  <div className="order-info-grid">
                    <section className="order-info-card"><h2><CreditCardOutlined /> Thanh toán</h2><strong>{paymentMethods[order.paymentMethod]}</strong><span>{paymentLabels[order.paymentStatus]}</span>{payment?.latestTransaction?.failureReason && <small>{payment.latestTransaction.failureReason}</small>}</section>
                    <section className="order-info-card"><h2><EnvironmentOutlined /> Giao hàng</h2><b>{order.shippingAddress.customerName}</b><p>{[order.shippingAddress.streetName, order.shippingAddress.ward, order.shippingAddress.district, order.shippingAddress.province].filter(Boolean).join(', ')}</p><p>{order.shippingAddress.phoneNumber}</p>{order.shipping.trackingCode && <small>Mã vận đơn: {order.shipping.trackingCode}</small>}</section>
                  </div>
                </div>

                <aside className="order-summary-card">
                  <h2>Tóm tắt đơn hàng</h2>
                  <p><span>Tạm tính</span><b>{formatPrice(order.subTotal)}</b></p>
                  {order.couponDiscountAmount > 0 && <p><span>Giảm giá {order.couponCode ? `(${order.couponCode})` : ''}</span><b>-{formatPrice(order.couponDiscountAmount)}</b></p>}
                  {order.membershipDiscountAmount > 0 && <p><span>Ưu đãi thành viên {order.appliedMembershipDiscountPercent ? `(${order.appliedMembershipDiscountPercent}%)` : ''}</span><b>-{formatPrice(order.membershipDiscountAmount)}</b></p>}
                  {totalDiscount === 0 && <p><span>Giảm giá</span><b>{formatPrice(0)}</b></p>}
                  <p><span>Phí giao hàng</span><b>{netShipping === 0 ? 'Miễn phí' : formatPrice(netShipping)}</b></p>
                  {order.taxAmount > 0 && <p><span>Thuế</span><b>+{formatPrice(order.taxAmount)}</b></p>}
                  <div className="order-summary-total"><span>Tổng cộng</span><strong>{formatPrice(order.totalAmount)}</strong></div>
                  <div className="order-summary-actions">
                    <Button block href="/" icon={<ShoppingOutlined />}>Tiếp tục mua sắm</Button>
                    <Button block type="primary" href="/account/orders" icon={<ClockCircleOutlined />}>Theo dõi đơn hàng</Button>
                  </div>
                </aside>
              </div>

              <section className="order-help-card"><h2><ShoppingOutlined /> Cần trợ giúp?</h2><a href={`/account/support/new?category=orders&orderId=${order._id}&source=order_detail`}>Vấn đề đơn hàng <span>›</span></a>{order.paymentStatus !== 'paid' && <a href={`/account/support/new?category=payments&orderId=${order._id}&source=payment_result&errorCode=${order.paymentStatus}`}>Vấn đề thanh toán <span>›</span></a>}<a href="/policies/shipping">Thông tin giao hàng <span>›</span></a><a href="/policies/returns">Trả hàng <span>›</span></a></section>

              <Modal
                title={orderAction === 'cancel' ? 'Hủy đơn hàng' : 'Yêu cầu trả hàng'}
                open={Boolean(orderAction)}
                okText={orderAction === 'cancel' ? 'Xác nhận hủy' : 'Gửi yêu cầu'}
                cancelText="Đóng"
                confirmLoading={actionSubmitting}
                okButtonProps={{ disabled: actionReason.trim().length < 5, danger: orderAction === 'cancel' }}
                onOk={() => void submitOrderAction()}
                onCancel={() => { if (!actionSubmitting) { setOrderAction(null); setActionReason('') } }}
              >
                <Input.TextArea
                  value={actionReason}
                  rows={4}
                  maxLength={500}
                  showCount
                  placeholder={orderAction === 'cancel' ? 'Lý do hủy đơn' : 'Mô tả lý do và tình trạng sản phẩm'}
                  onChange={(event) => setActionReason(event.target.value)}
                />
              </Modal>

            </>
          )}
        </Skeleton>
      </main>
    </MainLayout>
  )
}
