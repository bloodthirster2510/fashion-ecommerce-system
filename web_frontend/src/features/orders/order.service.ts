import { requestCustomer } from '../../services/customerHttp'
import type { CustomerOrder, CustomerOrderListResponse, PaymentStatusResult } from './order.types'

export const orderService = {
  getMine: () => requestCustomer<CustomerOrderListResponse>('/orders/me?limit=20'),
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
