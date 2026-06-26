import { requestCustomer } from '../../services/customerHttp'

export type VNPayOrderPaymentUrlResponse = {
  paymentUrl: string
  transactionId: string
  txnRef?: string
  attemptNo?: number
  expiredAt?: string | null
  orderCode: string
  amount: number
}

export type OrderPaymentStatusResponse = {
  orderId: string
  orderCode: string
  paymentMethod: string
  paymentStatus: string
  paymentDeadlineAt?: string | null
  canPayNow: boolean
  latestTransaction: {
    id: string
    txnRef: string | null
    attemptNo: number | null
    status: string
    expiredAt: string | null
    resolvedAt: string | null
    failureReason: string | null
  } | null
}

export const paymentService = {
  createVNPayUrlFromOrder(orderId: string, options?: { bankCode?: string; locale?: 'vn' | 'en' }) {
    return requestCustomer<VNPayOrderPaymentUrlResponse>(
      `/payments/vnpay/orders/${encodeURIComponent(orderId)}/create-payment-url`,
      {
        method: 'POST',
        body: JSON.stringify({
          ...(options?.bankCode ? { bankCode: options.bankCode } : {}),
          locale: options?.locale ?? 'vn',
        }),
      },
    )
  },

  getOrderPaymentStatus(orderId: string) {
    return requestCustomer<OrderPaymentStatusResponse>(
      `/payments/orders/${encodeURIComponent(orderId)}/status`,
    )
  },
}
