import { requestCustomer } from '../../services/customerHttp'
import type {
  CustomerOrder,
  CustomerOrderListResponse,
  OrderPaymentMethod,
  OrderPaymentStatus,
  OrderStatus,
  PaymentStatusResult,
} from './order.types'

export type CustomerOrderListQuery = {
  page?: number
  limit?: number
  statuses?: OrderStatus[]
  paymentMethod?: OrderPaymentMethod
  paymentStatuses?: OrderPaymentStatus[]
}

const buildOrderListQuery = (query: CustomerOrderListQuery = {}) => {
  const params = new URLSearchParams()
  if (query.page) params.set('page', String(query.page))
  if (query.limit) params.set('limit', String(query.limit))
  if (query.statuses?.length) params.set('statuses', query.statuses.join(','))
  if (query.paymentMethod) params.set('paymentMethod', query.paymentMethod)
  if (query.paymentStatuses?.length) params.set('paymentStatuses', query.paymentStatuses.join(','))
  return params.toString()
}

export const orderService = {
  getMine: (query: CustomerOrderListQuery = {}) => {
    const queryString = buildOrderListQuery(query)
    return requestCustomer<CustomerOrderListResponse>(`/orders/me${queryString ? `?${queryString}` : ''}`)
  },
  getById: (orderId: string) => requestCustomer<CustomerOrder>(`/orders/${orderId}`),
  getPaymentStatus: (orderId: string) =>
    requestCustomer<PaymentStatusResult>(`/payments/orders/${orderId}/status`),
  createVNPayUrl: (orderId: string) =>
    requestCustomer<{ paymentUrl: string }>(`/payments/vnpay/orders/${orderId}/create-payment-url`, {
      method: 'POST',
      body: JSON.stringify({ locale: 'vn' }),
    }),
  cancel: (orderId: string, reason: string) =>
    requestCustomer<CustomerOrder>(`/orders/${orderId}/cancel`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    }),
  requestReturn: (orderId: string, reason: string) =>
    requestCustomer<CustomerOrder>(`/orders/${orderId}/request-return`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    }),
}
