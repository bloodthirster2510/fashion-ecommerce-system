import { requestAdmin } from '../../services/adminHttp'

export type AdminOrderStatus =
  | 'confirmed'
  | 'packed'
  | 'shipping'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'return_requested'
  | 'return_approved'
  | 'returned'

export type AdminOrderPaymentMethod = 'COD' | 'VNPAY' | 'MOMO' | 'CARD' | 'BANK'
export type AdminOrderPaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded'
export type AdminPaymentMethodStatus = 'pending' | 'verified' | 'expired' | 'disabled'
export type AdminReturnRequestStatus = 'requested' | 'approved' | 'rejected'
export type AdminReturnReviewDecision = 'approved' | 'rejected'

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
  provinceCode?: string | null
  provinceId?: number | null
  district?: string | null
  districtId?: number | null
  ward: string
  wardCode: string
  streetName: string
  phoneNumber: string
  ghnProvinceId?: number | null
  ghnDistrictId?: number | null
  ghnWardCode?: string | null
  ghnMappingStatus?: 'mapped' | 'missing' | 'manual'
  ghnMappingConfidence?: 'exact' | 'manual' | 'legacy' | null
  ghnMappingVerifiedAt?: string | null
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

export type AdminOrderReturnRequest = {
  reason: string
  imageUrls?: string[]
  status: AdminReturnRequestStatus
  previousOrderStatus?: Extract<AdminOrderStatus, 'delivered' | 'completed'> | null
  requestedAt: string
  reviewedAt?: string | null
  reviewedBy?: string | null
  reviewReason?: string | null
}

export type AdminOrderCancellation = {
  kind?: 'customer' | 'admin' | 'shipping' | 'payment-timeout' | null
  reason?: string | null
  imageUrls?: string[]
  cancelledAt: string
  cancelledBy?: string | null
  actorRole?: 'user' | 'admin' | 'staff' | 'system' | string | null
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
  paymentDeadlineAt?: string | null
  paymentDeadlineWarningSentAt?: string | null
  deliveredAt?: string | null
  receivedAt?: string | null
  returnRequest?: AdminOrderReturnRequest | null
  cancellation?: AdminOrderCancellation | null
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
  hasStoredAccountNumber?: boolean
  status: AdminPaymentMethodStatus
  isDefault: boolean
  metadata?: Record<string, unknown>
  createdAt?: string
  updatedAt?: string
}

export type OrderListFilters = {
  status?: AdminOrderStatus | 'all'
  statuses?: AdminOrderStatus[]
  paymentMethod?: AdminOrderPaymentMethod | 'all'
  paymentMethods?: AdminOrderPaymentMethod[]
  paymentStatus?: AdminOrderPaymentStatus | 'all'
  keyword?: string
  dateFrom?: string
  dateTo?: string
  sort?: AdminOrderListSort
  page?: number
  limit?: number
  paymentDeadlineBefore?: string
  shippingFallback?: boolean
}

export type AdminOrderListSort =
  | 'created_desc'
  | 'created_asc'
  | 'total_desc'
  | 'total_asc'
  | 'payment_deadline_asc'

export type OrderListResponse = {
  items: AdminOrder[]
  statusSummary?: Record<AdminOrderStatus | 'all', number>
  operationalSummary?: {
    returnRequests: number
    refunds: number
    paidReady: number
    packingReady?: number
    handoffReady?: number
    readyToProcess?: number
    deliveryConfirmations?: number
    paymentRisk: number
    paymentOverdueRisk?: number
    paymentDeadlineSoon?: number
    shippingMappingRequired?: number
    totalPriority: number
  }
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
  cancelledOrderIds: string[]
  transactions: Array<{
    id: string
    orderId: string
    txnRef?: string | null
    attemptNo?: number | null
    expiredAt?: string | null
  }>
  policy: string
}

export type VNPayReconcileResponse = {
  gateway: Record<string, string | boolean>
  reconciliationStatus: 'paid' | 'refunded' | 'pending_refund' | 'unchanged'
  settlement?: {
    paymentStatus?: AdminOrderPaymentStatus
    transactionStatus?: AdminTransaction['status']
  } | null
  order?: AdminOrder | null
}

export type VNPayRefundResponse = {
  order: AdminOrder
  refundTransaction: AdminTransaction
  gateway: Record<string, string | boolean>
  refundStatus: 'pending' | 'completed' | 'failed'
}

export type AdminAuditLog = {
  _id: string
  actorId?: string | null
  actorRole: 'admin' | 'staff' | 'system' | 'user'
  action:
    | 'order.status_update'
    | 'order.shipping_update'
    | 'order.shipping_mapping_update'
    | 'order.shipping_webhook'
    | 'order.shipping_reconcile'
    | 'order.auto_complete_delivered'
    | 'payment.adjust'
    | 'payment.expire'
    | 'payment.vnpay_reconcile'
    | 'payment.vnpay_refund'
    | 'payment_method.status_update'
    | 'payment_method.account_reveal'
    | 'shipping_mapping.import'
    | 'shipping_mapping.review'
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

export type UpdateOrderGhnMappingPayload = {
  ghnProvinceId: number
  ghnDistrictId: number
  ghnWardCode: string
  confidence: 'exact' | 'manual' | 'legacy'
  note?: string
  applyToFutureAddresses?: boolean
}

export type SimulateShippingWebhookPayload = {
  status: 'picked' | 'shipping' | 'delivered' | 'failed'
  reason?: string | null
  trackingCode?: string | null
  provider?: string | null
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

  if (filters.paymentMethods?.length) {
    params.set('paymentMethods', filters.paymentMethods.join(','))
  }

  if (filters.paymentStatus && filters.paymentStatus !== 'all') {
    params.set('paymentStatus', filters.paymentStatus)
  }

  if (filters.paymentDeadlineBefore) {
    params.set('paymentDeadlineBefore', filters.paymentDeadlineBefore)
  }

  if (filters.shippingFallback) {
    params.set('shippingFallback', 'true')
  }

  if (filters.dateFrom) {
    params.set('dateFrom', filters.dateFrom)
  }

  if (filters.dateTo) {
    params.set('dateTo', filters.dateTo)
  }

  if (filters.sort) {
    params.set('sort', filters.sort)
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

export const updateOrderStatus = (id: string, status: AdminOrderStatus, reason?: string) =>
  requestAdmin<AdminOrder>(`/admin/orders/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, reason }),
  })

export const reviewReturnRequest = (
  id: string,
  decision: AdminReturnReviewDecision,
  reason?: string,
) =>
  requestAdmin<AdminOrder>(`/admin/orders/${id}/return-request`, {
    method: 'PATCH',
    body: JSON.stringify({ decision, reason }),
  })

export const updateOrderShipping = (id: string, payload: UpdateOrderShippingPayload) =>
  requestAdmin<AdminOrder>(`/admin/orders/${id}/shipping`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })

export const updateOrderGhnMapping = (id: string, payload: UpdateOrderGhnMappingPayload) =>
  requestAdmin<AdminOrder>(`/admin/orders/${id}/ghn-mapping`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })

export const simulateShippingWebhook = (id: string, payload: SimulateShippingWebhookPayload) =>
  requestAdmin<AdminOrder>(`/admin/orders/${id}/shipping-webhook-simulation`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const createGhnShipment = (id: string) =>
  requestAdmin<AdminOrder>(`/admin/orders/${id}/ghn-shipment`, {
    method: 'POST',
  })

export const cancelGhnShipment = (id: string, reason?: string) =>
  requestAdmin<AdminOrder>(`/admin/orders/${id}/ghn-shipment/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })

export const syncGhnShipment = (id: string) =>
  requestAdmin<AdminOrder>(`/admin/orders/${id}/ghn-shipment/sync`, {
    method: 'POST',
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

export const revealCustomerPaymentMethodAccount = (id: string) =>
  requestAdmin<{ paymentMethodId: string; accountNumber: string }>(
    `/admin/payment-methods/${encodeURIComponent(id)}/reveal-account`,
    {
      method: 'POST',
    },
  )

export const adjustOrderPaymentStatus = (
  orderId: string,
  paymentStatus: AdminOrderPaymentStatus,
  reason: string,
) =>
  requestAdmin<AdminOrder>(`/admin/payments/orders/${encodeURIComponent(orderId)}/payment-status`, {
    method: 'PATCH',
    body: JSON.stringify({ paymentStatus, reason }),
  })

export const reconcileVNPayOrder = (orderId: string) =>
  requestAdmin<VNPayReconcileResponse>(
    `/admin/payments/orders/${encodeURIComponent(orderId)}/vnpay/reconcile`,
    { method: 'POST' },
  )

export const refundVNPayOrder = (orderId: string, reason: string) =>
  requestAdmin<VNPayRefundResponse>(
    `/admin/payments/orders/${encodeURIComponent(orderId)}/vnpay/refund`,
    {
      method: 'POST',
      body: JSON.stringify({ reason }),
    },
  )

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
