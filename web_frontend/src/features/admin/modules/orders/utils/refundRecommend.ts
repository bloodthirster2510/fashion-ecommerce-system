import type { AdminCustomerPaymentMethod, AdminOrder } from '../orderAdminApi'
import { getPaymentMethodMetadataText } from '../orderPresentation'

const normalizeTransferToken = (value?: string | null) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()

export const getRefundTransferContent = (order: AdminOrder) => {
  const orderCode = normalizeTransferToken(order.orderCode)
  const invoiceCode = normalizeTransferToken(order.invoiceCode)
  const suffix = invoiceCode && invoiceCode !== orderCode ? ` ${invoiceCode}` : ''

  return `HOAN TIEN DON ${orderCode}${suffix}`.trim().slice(0, 90)
}

const getRefundMethodRank = (method: AdminCustomerPaymentMethod) => {
  if (method.type !== 'BANK') return 100

  let rank = 20
  if (method.status === 'verified') rank -= 10
  if (method.isDefault) rank -= 5
  if (method.metadata?.refundDestination === true) rank -= 2
  return rank
}

export const getRecommendedRefundMethod = (methods: AdminCustomerPaymentMethod[]) =>
  [...methods]
    .filter((method) => method.type === 'BANK')
    .sort((left, right) => getRefundMethodRank(left) - getRefundMethodRank(right))[0] ?? null

export const getRefundAccountHolder = (method: AdminCustomerPaymentMethod) =>
  getPaymentMethodMetadataText(method, 'accountHolder') ?? 'Chưa có tên chủ tài khoản'

export const getRefundBankName = (method: AdminCustomerPaymentMethod) =>
  method.bankName || getPaymentMethodMetadataText(method, 'bankFullName') || method.provider || 'Chưa có ngân hàng'

export const getRefundAccountText = (method: AdminCustomerPaymentMethod) =>
  method.maskedInfo || (
    getPaymentMethodMetadataText(method, 'accountNumberLast4')
      ? `•••• ${getPaymentMethodMetadataText(method, 'accountNumberLast4')}`
      : 'Chưa có số tài khoản'
  )
