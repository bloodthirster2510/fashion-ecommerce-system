import { requestCustomer } from '../../services/customerHttp'
import type { Cart, CheckoutPreview, CreateOrderResponse, PaymentMethod } from './cart.types'

export type CheckoutPayload = {
  cartItemIds: string[]
  addressId: string
  paymentMethod: PaymentMethod
  couponCode?: string
}

export const cartService = {
  getCart: () => requestCustomer<Cart>('/cart'),
  updateItem: (itemId: string, quantity: number) => requestCustomer<Cart>(`/cart/items/${itemId}`, {
    method: 'PUT', body: JSON.stringify({ quantity }),
  }),
  selectItem: (itemId: string, isSelected: boolean) => requestCustomer<Cart>(`/cart/items/${itemId}/selected`, {
    method: 'PATCH', body: JSON.stringify({ isSelected }),
  }),
  selectAll: (isSelected: boolean) => requestCustomer<Cart>('/cart/select-all', {
    method: 'PATCH', body: JSON.stringify({ isSelected }),
  }),
  removeItem: (itemId: string) => requestCustomer<Cart>(`/cart/items/${itemId}`, { method: 'DELETE' }),
  preview: (payload: CheckoutPayload) => requestCustomer<CheckoutPreview>('/orders/preview', {
    method: 'POST', body: JSON.stringify(payload),
  }),
  createOrder: (
    payload: CheckoutPayload & { quoteVersion: string; orderNote?: string },
    idempotencyKey: string,
  ) => requestCustomer<CreateOrderResponse>('/orders', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(payload),
  }),
  createVNPayUrl: (orderId: string) => requestCustomer<{ paymentUrl: string }>(
    `/payments/vnpay/orders/${orderId}/create-payment-url`,
    { method: 'POST', body: JSON.stringify({ locale: 'vn' }) },
  ),
}

