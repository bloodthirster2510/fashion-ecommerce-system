import { useCallback, useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query'
import { Alert, Button, Empty, Input, Modal, Pagination, Segmented, Skeleton, Tag, Tooltip, message } from 'antd'
import { DownloadOutlined, FileTextOutlined, PrinterOutlined, StopOutlined, UndoOutlined } from '@ant-design/icons'
import { MainLayout } from '../../../layouts/MainLayout'
import { requestCustomer } from '../../../services/customerHttp'
import { ProfileSidebar } from '../components/ProfileSidebar'
import { AccountSectionSkeleton } from '../components/AccountSectionSkeleton'
import { useAppSelector } from '../../../app/hooks'
import {
  fallbackStorefrontSettings,
  fetchStorefrontSettings,
  readCachedStorefrontSettings,
} from '../../storefront-settings/storefrontSettings.service'
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
import {
  downloadInvoicePdf,
  formatInvoiceDate,
  getInvoiceDeliveryAddress,
  getInvoiceDiscountTotal,
  getInvoiceIssuedAt,
  printInvoice,
} from '../../admin/modules/orders/utils/invoiceDocument'
import '../profile.css'

const ORDER_PAGE_SIZE = 10
type AccountOrderFilter = 'all' | 'needs-payment' | 'active' | 'shipping' | 'completed'

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
const accountOrderFilterQuery: Record<AccountOrderFilter, Parameters<typeof orderService.getMine>[0]> = {
  all: {},
  'needs-payment': {
    paymentMethod: 'VNPAY',
    paymentStatuses: ['pending', 'failed'],
    statuses: ['confirmed', 'packed', 'shipping', 'delivered', 'return_requested', 'return_approved'],
  },
  active: { statuses: ['confirmed', 'packed'] },
  shipping: { statuses: ['shipping', 'delivered'] },
  completed: { statuses: ['completed', 'cancelled', 'returned'] },
}

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

const canCancelOrder = (order: CustomerOrder) => ['confirmed', 'packed'].includes(order.status)
const canRequestReturnOrder = (order: CustomerOrder) => ['delivered', 'completed'].includes(order.status)

const getReviewableOrderItems = (order: CustomerOrder) => (
  order.status === 'completed' && order.paymentStatus === 'paid' ? order.order_list : []
)

const getOrderAlert = (order: CustomerOrder, shopPhone: string) => {
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
      message: `Đơn đã hủy sau khi thanh toán. Shop sẽ đối soát và xử lý hoàn tiền theo chính sách. Nếu quý khách không nhận được tiền hoàn trong vòng 3 ngày làm việc, vui lòng liên hệ số ${shopPhone}.`,
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

const emptyOrderPagination: CustomerOrderListResponse['pagination'] = {
  page: 1,
  limit: ORDER_PAGE_SIZE,
  totalItems: 0,
  totalPages: 0,
}

const getErrorMessage = (error: unknown, fallback: string) => (
  error instanceof Error ? error.message : fallback
)

type OrderListMutationInput = {
  page: number
  filter: AccountOrderFilter
  mode?: CustomerOrderLoadMode
}

// Quản lý việc tải danh sách đơn hàng của khách.
function useCustomerOrderListMutation() {
  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [pagination, setPagination] = useState<CustomerOrderListResponse['pagination']>(emptyOrderPagination)
  const [statusSummary, setStatusSummary] = useState<CustomerOrderListResponse['statusSummary']>()
  const [operationalSummary, setOperationalSummary] = useState<CustomerOrderListResponse['operationalSummary']>()
  const [mode, setMode] = useState<CustomerOrderLoadMode>('loading')
  const [hasLoaded, setHasLoaded] = useState(false)

  const { isPending, mutateAsync } = useMutation({
    mutationFn: async ({ page, filter, mode: nextMode = 'loading' }: OrderListMutationInput) => {
      const result = await orderService.getMine({
        ...accountOrderFilterQuery[filter],
        page,
        limit: ORDER_PAGE_SIZE,
      })
      return { result, filter, mode: nextMode }
    },
    onMutate: ({ mode: nextMode = 'loading' }) => {
      setMode(nextMode)
    },
    onSuccess: ({ result, filter }) => {
      setOrders(result.items)
      setPagination(result.pagination)
      if (filter === 'all' || !statusSummary) {
        setStatusSummary(result.statusSummary)
        setOperationalSummary(result.operationalSummary)
      }
    },
    onSettled: () => {
      setHasLoaded(true)
    },
  })

  const loadOrdersAsync = useCallback(async (input: OrderListMutationInput) => {
    const { result } = await mutateAsync(input)
    return result
  }, [mutateAsync])

  return {
    orders,
    pagination,
    statusSummary,
    operationalSummary,
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
  const [filter, setFilter] = useState<AccountOrderFilter>('all')
  const [page, setPage] = useState(1)
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [cancelOrderTarget, setCancelOrderTarget] = useState<CustomerOrder | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null)
  const [returnOrderTarget, setReturnOrderTarget] = useState<CustomerOrder | null>(null)
  const [returnReason, setReturnReason] = useState('')
  const [returningOrderId, setReturningOrderId] = useState<string | null>(null)
  const [invoiceTarget, setInvoiceTarget] = useState<CustomerOrder | null>(null)
  const [invoiceDownloading, setInvoiceDownloading] = useState(false)
  const [invoiceActionError, setInvoiceActionError] = useState('')
  const [settingsWarning, setSettingsWarning] = useState('')
  const [storefrontSettings, setStorefrontSettings] = useState(() =>
    readCachedStorefrontSettings() ?? fallbackStorefrontSettings)
  const {
    orders,
    pagination,
    statusSummary,
    operationalSummary,
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

  // Tải lại danh sách đơn hàng, hiển thị thông báo lỗi nếu có.
  const load = useCallback(async (mode: CustomerOrderLoadMode = 'refresh') => {
    try {
      const result = await loadOrdersAsync({ page, filter, mode })
      if (result.pagination.totalPages > 0 && page > result.pagination.totalPages) {
        setPage(result.pagination.totalPages)
      }
    } catch (error) {
      if (mode !== 'silent') {
        message.error(error instanceof Error ? error.message : 'Không thể tải đơn hàng')
      }
    }
  }, [filter, loadOrdersAsync, page])

  // Sao chép mã đơn, mã hóa đơn hoặc mã vận đơn.
  const copyReference = useCallback(async (value: string, label: string) => {
    if (!value) return

    try {
      await writeClipboardText(value)
    } catch {
      message.error(`Không thể sao chép ${label}.`)
    }
  }, [])


  const openOrderDetail = useCallback((orderId: string) => {
    setSelectedOrderId(orderId)
    loadOrderDetail(orderId)
  }, [loadOrderDetail])

  const closeOrderDetail = () => {
    setSelectedOrderId(null)
    clearOrderDetail()
  }

  const openCancelOrder = (order: CustomerOrder) => {
    setCancelOrderTarget(order)
    setCancelReason('')
  }

  const closeCancelOrder = () => {
    if (cancellingOrderId) return
    setCancelOrderTarget(null)
    setCancelReason('')
  }

  const openReturnOrder = (order: CustomerOrder) => {
    setReturnOrderTarget(order)
    setReturnReason('')
  }

  const closeReturnOrder = () => {
    if (returningOrderId) return
    setReturnOrderTarget(null)
    setReturnReason('')
  }

  const openInvoice = (order: CustomerOrder) => {
    setInvoiceTarget(order)
    setInvoiceActionError('')
  }

  const closeInvoice = () => {
    if (invoiceDownloading) return
    setInvoiceTarget(null)
    setInvoiceActionError('')
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

  useEffect(() => {
    let active = true
    void fetchStorefrontSettings()
      .then((settings) => {
        if (active) setStorefrontSettings(settings)
      })
      .catch(() => {
        if (active) setSettingsWarning('Không tải được thông tin cửa hàng mới nhất; hóa đơn đang dùng thông tin dự phòng.')
      })

    return () => { active = false }
  }, [])

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

  const statusCount = (status: OrderStatus) => statusSummary?.[status] ?? 0
  const tabCounts = {
    all: filter === 'all' ? pagination.totalItems : statusSummary?.all ?? 0,
    needsPayment: filter === 'needs-payment'
      ? pagination.totalItems
      : operationalSummary?.paymentRisk ?? orders.filter(orderNeedsPaymentAction).length,
    active: filter === 'active' ? pagination.totalItems : statusCount('confirmed') + statusCount('packed'),
    shipping: filter === 'shipping' ? pagination.totalItems : statusCount('shipping') + statusCount('delivered'),
    completed: filter === 'completed'
      ? pagination.totalItems
      : statusCount('completed') + statusCount('cancelled') + statusCount('returned'),
  }

  const submitCancelOrder = async () => {
    if (!cancelOrderTarget) return

    try {
      setCancellingOrderId(cancelOrderTarget._id)
      const reason = cancelReason.trim()
      const updatedOrder = await orderService.cancel(cancelOrderTarget._id, reason)
      if (selectedOrderId === updatedOrder._id) {
        setOrderDetail(updatedOrder)
        setDetailPayment(await orderService.getPaymentStatus(updatedOrder._id).catch(() => detailPayment))
      }
      message.success('Đã hủy đơn hàng.')
      setCancelOrderTarget(null)
      setCancelReason('')
      await load('refresh')
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không thể hủy đơn hàng.')
    } finally {
      setCancellingOrderId(null)
    }
  }

  const submitReturnOrder = async () => {
    if (!returnOrderTarget || returnReason.trim().length < 5) return

    try {
      setReturningOrderId(returnOrderTarget._id)
      const updatedOrder = await orderService.requestReturn(returnOrderTarget._id, returnReason.trim())
      if (selectedOrderId === updatedOrder._id) {
        setOrderDetail(updatedOrder)
        setDetailPayment(await orderService.getPaymentStatus(updatedOrder._id).catch(() => detailPayment))
      }
      message.success('Đã gửi yêu cầu trả hàng.')
      setReturnOrderTarget(null)
      setReturnReason('')
      await load('refresh')
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không thể gửi yêu cầu trả hàng.')
    } finally {
      setReturningOrderId(null)
    }
  }

  const handlePrintInvoice = () => {
    if (!invoiceTarget) return
    setInvoiceActionError('')
    try {
      printInvoice(invoiceTarget, storefrontSettings)
    } catch (error) {
      setInvoiceActionError(error instanceof Error ? error.message : 'Không thể mở bản in hóa đơn.')
    }
  }

  const handleDownloadInvoice = async () => {
    if (!invoiceTarget) return
    setInvoiceDownloading(true)
    setInvoiceActionError('')
    try {
      await downloadInvoicePdf(invoiceTarget, storefrontSettings)
    } catch (error) {
      setInvoiceActionError(error instanceof Error ? error.message : 'Không thể tải PDF hóa đơn.')
    } finally {
      setInvoiceDownloading(false)
    }
  }

  const detailActiveStep = orderDetail ? progressStatuses.indexOf(orderDetail.status) : -1
  const detailTotalDiscount = (orderDetail?.couponDiscountAmount || 0) + (orderDetail?.membershipDiscountAmount || 0)
  const detailNetShipping = orderDetail ? getNetShipping(orderDetail) : 0

  return (
    <MainLayout>
      <main className="account-page">
        <div className="account-shell">
          <ProfileSidebar name={user?.name} avatarImage={user?.avatarImage} role={user?.role} selectedKey="orders" />
          <section className="account-content">
            <div className="account-section-heading">
              <h1>Đơn hàng của tôi</h1>
              <div className="account-section-actions">
                <span className="account-policy-label">Chính sách</span>
                <Tooltip title="Quy định trả hàng">
                  <Button
                    className="account-policy-button"
                    href="/policies/returns"
                    icon={<FileTextOutlined />}
                    aria-label="Xem quy định trả hàng"
                  >
                    Đổi trả
                  </Button>
                </Tooltip>
                <Tooltip title="Quy định hủy đơn">
                  <Button
                    className="account-policy-button"
                    href="/policies/terms"
                    icon={<StopOutlined />}
                    aria-label="Xem quy định hủy đơn"
                  >
                    Hủy đơn
                  </Button>
                </Tooltip>
                <Button loading={refreshing && !loading} onClick={() => void load()}>
                  Tải lại
                </Button>
              </div>
            </div>

            <Segmented
              className="account-order-filters"
              value={filter}
              onChange={(value) => {
                setFilter(value as AccountOrderFilter)
                setPage(1)
              }}
              options={[
                { label: `Tất cả (${tabCounts.all})`, value: 'all' },
                { label: `Cần thanh toán (${tabCounts.needsPayment})`, value: 'needs-payment' },
                { label: `Đang xử lý (${tabCounts.active})`, value: 'active' },
                { label: `Đang giao (${tabCounts.shipping})`, value: 'shipping' },
                { label: `Lịch sử (${tabCounts.completed})`, value: 'completed' },
              ]}
            />

            {loading ? (
              <AccountSectionSkeleton variant="list" />
            ) : !orders.length ? (
                <Empty description="Chưa có đơn hàng" />
              ) : (
                <div className="account-order-list">
                  {orders.map((order) => {
                    const alert = getOrderAlert(order, storefrontSettings.contact.phone)
                    const reviewableItems = getReviewableOrderItems(order)

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
                        {canCancelOrder(order) ? (
                          <Button
                            danger
                            className="account-order-cancel-button"
                            loading={cancellingOrderId === order._id}
                            onClick={() => openCancelOrder(order)}
                          >
                            Hủy đơn
                          </Button>
                        ) : null}
                        {canRequestReturnOrder(order) ? (
                          <Button
                            icon={<UndoOutlined />}
                            loading={returningOrderId === order._id}
                            onClick={() => openReturnOrder(order)}
                          >
                            Yêu cầu trả hàng
                          </Button>
                        ) : null}
                        {reviewableItems.map((item, index) => (
                          <Button
                            className="account-order-review-button"
                            href={`/products/${item.productId}?compose=1&orderId=${order._id}&orderItemId=${item._id}`}
                            key={item._id}
                          >
                            {reviewableItems.length > 1 ? `Đánh giá ${index + 1}` : 'Viết đánh giá'}
                          </Button>
                        ))}
                        {order.invoiceCode ? (
                          <Button icon={<FileTextOutlined />} onClick={() => openInvoice(order)}>
                            Xem hóa đơn
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
            {pagination.totalItems > ORDER_PAGE_SIZE && (
              <Pagination
                className="account-order-pagination"
                current={pagination.page}
                pageSize={ORDER_PAGE_SIZE}
                total={pagination.totalItems}
                showSizeChanger={false}
                onChange={setPage}
              />
            )}
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
                orderDetail && canRequestReturnOrder(orderDetail) ? (
                  <Button key="return" icon={<UndoOutlined />} loading={returningOrderId === orderDetail._id} onClick={() => openReturnOrder(orderDetail)}>
                    Yêu cầu trả hàng
                  </Button>
                ) : null,
                orderDetail?.invoiceCode ? (
                  <Button key="invoice" icon={<FileTextOutlined />} onClick={() => openInvoice(orderDetail)}>
                    Xem hóa đơn
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
                              <span>{[item.color, `Size ${item.size}`, item.fitType].filter(Boolean).join(' · ')}</span>
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

            <Modal
              className="customer-invoice-modal"
              title={invoiceTarget?.invoiceCode ? `Hóa đơn ${invoiceTarget.invoiceCode}` : 'Hóa đơn'}
              open={Boolean(invoiceTarget)}
              width={920}
              footer={[
                <Button key="close" onClick={closeInvoice}>Đóng</Button>,
                <Button key="print" icon={<PrinterOutlined />} onClick={handlePrintInvoice}>In</Button>,
                <Button
                  key="download"
                  type="primary"
                  icon={<DownloadOutlined />}
                  loading={invoiceDownloading}
                  onClick={() => void handleDownloadInvoice()}
                >
                  Tải PDF
                </Button>,
              ]}
              onCancel={closeInvoice}
            >
              {settingsWarning ? <Alert className="customer-invoice-alert" type="warning" showIcon message={settingsWarning} /> : null}
              {invoiceActionError ? <Alert className="customer-invoice-alert" type="error" showIcon message={invoiceActionError} /> : null}

              {invoiceTarget ? (
                <article className="customer-invoice-sheet">
                  <header className="customer-invoice-header">
                    <div>
                      <h2>{storefrontSettings.identity.name}</h2>
                      <strong>{storefrontSettings.identity.legalName || storefrontSettings.identity.name}</strong>
                      {storefrontSettings.identity.taxCode ? <span>Mã số thuế: {storefrontSettings.identity.taxCode}</span> : null}
                      {storefrontSettings.contact.address ? <span>{storefrontSettings.contact.address}</span> : null}
                      <span>{[storefrontSettings.contact.phone, storefrontSettings.contact.email].filter(Boolean).join(' · ')}</span>
                    </div>
                    <div>
                      <span>HÓA ĐƠN BÁN HÀNG</span>
                      <strong>{invoiceTarget.invoiceCode}</strong>
                      <small>Phát hành {formatInvoiceDate(getInvoiceIssuedAt(invoiceTarget))}</small>
                    </div>
                  </header>

                  <section className="customer-invoice-parties">
                    <div>
                      <span>NGƯỜI MUA / NGƯỜI NHẬN</span>
                      <strong>{invoiceTarget.shippingAddress.customerName}</strong>
                      <p>{invoiceTarget.shippingAddress.phoneNumber}</p>
                      <p>{getInvoiceDeliveryAddress(invoiceTarget)}</p>
                    </div>
                    <dl>
                      <div><dt>Mã đơn</dt><dd>{invoiceTarget.orderCode}</dd></div>
                      <div><dt>Thanh toán</dt><dd>{paymentMethodLabels[invoiceTarget.paymentMethod]}</dd></div>
                      <div><dt>Trạng thái</dt><dd>{paymentStatusLabels[invoiceTarget.paymentStatus]}</dd></div>
                    </dl>
                  </section>

                  <div className="customer-invoice-table-wrap">
                    <table className="customer-invoice-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Sản phẩm</th>
                          <th>SL</th>
                          <th>Đơn giá</th>
                          <th>Thành tiền</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoiceTarget.order_list.map((item, index) => (
                          <tr key={item._id}>
                            <td>{index + 1}</td>
                            <td>
                              <strong>{item.name}</strong>
                              <span>{[item.color, `Size ${item.size}`, item.fitType].filter(Boolean).join(' / ')}</span>
                            </td>
                            <td>{item.quantity}</td>
                            <td>{money(item.priceAtPurchased)}</td>
                            <td><strong>{money(item.priceAtPurchased * item.quantity)}</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <section className="customer-invoice-summary">
                    <div>{invoiceTarget.orderNote ? <p><b>Ghi chú:</b> {invoiceTarget.orderNote}</p> : null}</div>
                    <dl>
                      <div><dt>Tiền hàng</dt><dd>{money(invoiceTarget.subTotal)}</dd></div>
                      {getInvoiceDiscountTotal(invoiceTarget) > 0 ? <div><dt>Tổng ưu đãi</dt><dd>-{money(getInvoiceDiscountTotal(invoiceTarget))}</dd></div> : null}
                      <div><dt>Phí vận chuyển</dt><dd>{money(invoiceTarget.shippingFee)}</dd></div>
                      {invoiceTarget.taxAmount > 0 ? <div><dt>Thuế</dt><dd>{money(invoiceTarget.taxAmount)}</dd></div> : null}
                      <div><dt>Tổng thanh toán</dt><dd>{money(invoiceTarget.totalAmount)}</dd></div>
                    </dl>
                  </section>

                  <footer>Chứng từ bán hàng nội bộ, không thay thế hóa đơn điện tử hoặc hóa đơn VAT theo quy định pháp luật.</footer>
                </article>
              ) : null}
            </Modal>

            <Modal
              title={cancelOrderTarget ? `Hủy đơn ${cancelOrderTarget.orderCode}` : 'Hủy đơn'}
              open={Boolean(cancelOrderTarget)}
              okText="Hủy đơn"
              cancelText="Đóng"
              okButtonProps={{ danger: true, loading: Boolean(cancellingOrderId) }}
              onCancel={closeCancelOrder}
              onOk={() => void submitCancelOrder()}
            >
              <div className="account-cancel-order-form">
                <p>Đơn chỉ có thể hủy khi shop chưa bàn giao vận chuyển. Bạn có thể nhập lý do để shop hỗ trợ nhanh hơn.</p>
                <Input.TextArea
                  value={cancelReason}
                  maxLength={500}
                  rows={4}
                  showCount
                  placeholder="Ví dụ: Tôi muốn đổi size hoặc thay đổi địa chỉ nhận hàng"
                  onChange={(event) => setCancelReason(event.target.value)}
                />
              </div>
            </Modal>

            <Modal
              title={returnOrderTarget ? `Yêu cầu trả hàng ${returnOrderTarget.orderCode}` : 'Yêu cầu trả hàng'}
              open={Boolean(returnOrderTarget)}
              okText="Gửi yêu cầu"
              cancelText="Đóng"
              okButtonProps={{ disabled: returnReason.trim().length < 5, loading: Boolean(returningOrderId) }}
              onCancel={closeReturnOrder}
              onOk={() => void submitReturnOrder()}
            >
              <div className="account-cancel-order-form">
                <p>Vui lòng mô tả lý do trả hàng và tình trạng sản phẩm để shop kiểm tra, duyệt yêu cầu và hướng dẫn bước hoàn tiền phù hợp.</p>
                <Input.TextArea
                  value={returnReason}
                  maxLength={500}
                  rows={4}
                  showCount
                  placeholder="Ví dụ: Sản phẩm bị lỗi đường may hoặc tôi nhận sai size"
                  onChange={(event) => setReturnReason(event.target.value)}
                />
              </div>
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
