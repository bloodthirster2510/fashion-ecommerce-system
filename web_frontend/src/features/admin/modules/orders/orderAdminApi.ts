import { requestAdmin } from '../../services/adminHttp'

export type AdminOrderStatus =
  | 'confirmed'
  | 'packed'
  | 'shipping'
  | 'delivered'
  | 'cancelled'
  | 'return_requested'
  | 'returned'

export type AdminOrderPaymentMethod = 'COD' | 'VNPAY' | 'MOMO' | 'CARD' | 'BANK'
export type AdminOrderPaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded'
export type AdminPaymentMethodStatus = 'pending' | 'verified' | 'expired' | 'disabled'

export type AdminOrderItem = {
  _id?: string
  sku: string
  name: string
  fitType: string
  color: string
  size: string
  quantity: number
  priceAtPurchased: number
}

export type AdminOrderShippingAddress = {
  customerName: string
  province: string
  district?: string | null
  ward: string
  streetName: string
  phoneNumber: string
}

export type AdminOrderShipping = {
  provider?: string | null
  status?: string | null
  trackingCode?: string | null
  labelUrl?: string | null
  customerFee?: number | null
  quotedProviderCost?: number | null
  actualProviderCost?: number | null
  comparisonStatus?: string | null
  pricingMode?: string | null
  estimatedDeliveryDate?: string | null
}

export type AdminOrder = {
  _id: string
  orderCode: string
  invoiceCode?: string | null
  user_id: string
  order_list: AdminOrderItem[]
  subTotal: number
  shippingFee: number
  couponCode?: string | null
  couponDiscountAmount: number
  shippingDiscountAmount: number
  membershipDiscountAmount: number
  taxAmount: number
  totalAmount: number
  status: AdminOrderStatus
  paymentMethod: AdminOrderPaymentMethod
  paymentStatus: AdminOrderPaymentStatus
  shipping?: AdminOrderShipping | null
  shippingAddress: AdminOrderShippingAddress
  orderNote?: string | null
  createdAt: string
  updatedAt: string
}

export type AdminTransaction = {
  _id: string
  order_id: string
  user_id: string
  amount: number
  paymentMethod: AdminOrderPaymentMethod
  paymentMethodId?: string | null
  txnRef?: string | null
  attemptNo?: number | null
  expiredAt?: string | null
  resolvedAt?: string | null
  failureReason?: string | null
  gatewayTransactionId?: string | null
  gatewayProvider?: string | null
  paymentDetail?: Record<string, unknown>
  status: 'pending' | 'success' | 'failed' | 'expired'
  createdAt: string
  updatedAt: string
}

export type AdminCustomerPaymentMethod = {
  _id: string
  user_id: string
  type: AdminOrderPaymentMethod
  provider: string
  displayName: string
  maskedInfo?: string | null
  bankCode?: string | null
  bankName?: string | null
  status: AdminPaymentMethodStatus
  isDefault: boolean
  createdAt?: string
  updatedAt?: string
}

export type OrderListFilters = {
  status?: AdminOrderStatus | 'all'
  statuses?: AdminOrderStatus[]
  paymentMethod?: AdminOrderPaymentMethod | 'all'
  paymentStatus?: AdminOrderPaymentStatus | 'all'
  keyword?: string
  page?: number
  limit?: number
}

export type OrderListResponse = {
  items: AdminOrder[]
  statusSummary?: Record<AdminOrderStatus | 'all', number>
  pagination?: {
    page: number
    limit: number
    totalItems: number
    totalPages: number
  }
}

export type ExpireStalePaymentsResponse = {
  expiredCount: number
  orderIds: string[]
  transactions: Array<{
    id: string
    orderId: string
    txnRef?: string | null
    attemptNo?: number | null
    expiredAt?: string | null
  }>
  policy: string
}

export type AdminAuditLog = {
  _id: string
  actorId?: string | null
  actorRole: 'admin' | 'staff' | 'system' | 'user'
  action:
    | 'order.status_update'
    | 'order.shipping_update'
    | 'payment.adjust'
    | 'payment.expire'
    | 'payment_method.status_update'
  targetType: string
  targetId: string
  reason?: string | null
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type AuditLogListResponse = {
  items: AdminAuditLog[]
  pagination: {
    page: number
    limit: number
    totalItems: number
    totalPages: number
  }
}

export type UpdateOrderShippingPayload = {
  provider?: string | null
  status?: string | null
  trackingCode?: string | null
  labelUrl?: string | null
  actualProviderCost?: number | null
  reason?: string | null
}

const buildOrderListQuery = (filters: OrderListFilters) => {
  const params = new URLSearchParams()
  const keyword = filters.keyword?.trim()

  if (keyword) {
    params.set('keyword', keyword)
  }

  const statuses = filters.statuses?.filter(Boolean)

  if (statuses?.length) {
    params.set('statuses', statuses.join(','))
  } else if (filters.status && filters.status !== 'all') {
    params.set('status', filters.status)
  }

  if (filters.paymentMethod && filters.paymentMethod !== 'all') {
    params.set('paymentMethod', filters.paymentMethod)
  }

  if (filters.paymentStatus && filters.paymentStatus !== 'all') {
    params.set('paymentStatus', filters.paymentStatus)
  }

  params.set('page', String(filters.page ?? 1))
  params.set('limit', String(filters.limit ?? 10))

  return params.toString()
}

export const listOrders = (filters: OrderListFilters) =>
  requestAdmin<OrderListResponse>(`/admin/orders?${buildOrderListQuery(filters)}`)

export const getOrder = (id: string) =>
  requestAdmin<AdminOrder>(`/admin/orders/${id}`)

export const listOrderTransactions = (id: string) =>
  requestAdmin<AdminTransaction[]>(`/admin/orders/${id}/transactions`)

export const updateOrderStatus = (id: string, status: AdminOrderStatus) =>
  requestAdmin<AdminOrder>(`/admin/orders/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })

export const updateOrderShipping = (id: string, payload: UpdateOrderShippingPayload) =>
  requestAdmin<AdminOrder>(`/admin/orders/${id}/shipping`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })

export const expireStalePayments = () =>
  requestAdmin<ExpireStalePaymentsResponse>('/admin/payments/expire-stale', {
    method: 'POST',
  })

export const listCustomerPaymentMethods = (userId: string) =>
  requestAdmin<AdminCustomerPaymentMethod[]>(`/admin/users/${encodeURIComponent(userId)}/payment-methods`)

export const updateCustomerPaymentMethodStatus = (
  id: string,
  status: AdminPaymentMethodStatus,
  reason: string,
) =>
  requestAdmin<AdminCustomerPaymentMethod>(`/admin/payment-methods/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, reason }),
  })

export const adjustOrderPaymentStatus = (
  orderId: string,
  paymentStatus: AdminOrderPaymentStatus,
  reason: string,
) =>
  requestAdmin<AdminOrder>(`/admin/payments/orders/${encodeURIComponent(orderId)}/payment-status`, {
    method: 'PATCH',
    body: JSON.stringify({ paymentStatus, reason }),
  })

export const listAuditLogs = (filters: {
  targetType?: string
  targetId?: string
  action?: AdminAuditLog['action']
  page?: number
  limit?: number
}) => {
  const params = new URLSearchParams()
  if (filters.targetType) params.set('targetType', filters.targetType)
  if (filters.targetId) params.set('targetId', filters.targetId)
  if (filters.action) params.set('action', filters.action)
  params.set('page', String(filters.page ?? 1))
  params.set('limit', String(filters.limit ?? 20))

  return requestAdmin<AuditLogListResponse>(`/admin/audit-logs?${params.toString()}`)
}
