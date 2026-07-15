export type OrderStatus =
  | 'confirmed'
  | 'packed'
  | 'shipping'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'return_requested'
  | 'return_approved'
  | 'returned'

export type OrderPaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded'
export type OrderPaymentMethod = 'COD' | 'VNPAY' | 'MOMO' | 'CARD' | 'BANK'

export type OrderItem = {
  _id: string
  productId: string
  variantId?: string
  size: string
  sku: string
  name: string
  fitType: string
  color: string
  image: string
  quantity: number
  priceAtPurchased: number
}

export type ShippingAddress = {
  customerName: string
  province: string
  district?: string | null
  ward: string
  streetName: string
  phoneNumber: string
}

export type CustomerOrder = {
  _id: string
  orderCode: string
  invoiceCode?: string | null
  order_list: OrderItem[]
  subTotal: number
  shippingFee: number
  couponCode?: string | null
  couponDiscountAmount: number
  shippingDiscountAmount: number
  appliedMembershipDiscountPercent?: number | null
  membershipDiscountAmount: number
  taxAmount: number
  totalAmount: number
  status: OrderStatus
  paymentMethod: OrderPaymentMethod
  paymentStatus: OrderPaymentStatus
  shipping: {
    provider?: string | null
    status?: string | null
    trackingCode?: string | null
    estimatedDeliveryDate?: string | null
  }
  shippingAddress: ShippingAddress
  orderNote?: string | null
  createdAt: string
  updatedAt: string
  deliveredAt?: string | null
  receivedAt?: string | null
  returnRequest?: {
    reason: string
    status: 'requested' | 'approved' | 'rejected'
    requestedAt: string
    reviewReason?: string | null
  } | null
}

export type CustomerOrderListResponse = {
  items: CustomerOrder[]
  pagination: {
    page: number
    limit: number
    totalItems: number
    totalPages: number
  }
}

export type PaymentStatusResult = {
  orderId: string
  orderCode: string
  paymentMethod: OrderPaymentMethod
  paymentStatus: OrderPaymentStatus
  canPayNow: boolean
  latestTransaction: null | {
    id: string
    status: 'pending' | 'success' | 'failed' | 'expired'
    expiredAt?: string | null
    failureReason?: string | null
  }
}
