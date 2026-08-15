import { requestCustomer } from '../../services/customerHttp'

export type CustomerPaymentMethodStatus = 'pending' | 'verified' | 'expired' | 'disabled'

export type CustomerPaymentMethod = {
  _id: string
  type: 'BANK'
  provider: string
  displayName: string
  maskedInfo: string | null
  bankCode: string | null
  bankName: string | null
  status: CustomerPaymentMethodStatus
  isDefault: boolean
  metadata?: {
    accountHolder?: string
    accountNumberLast4?: string
    bankFullName?: string
    refundDestination?: boolean
  } | null
  createdAt: string
  updatedAt: string
}

export type SavePaymentMethodInput = {
  displayName?: string
  bankCode?: string
  bankName?: string
  accountNumber?: string
  accountHolder?: string
  isDefault?: boolean
}

const getLast4 = (value?: string) => value?.replace(/\s+/g, '').slice(-4) || ''

const toPayload = (input: SavePaymentMethodInput, mode: 'create' | 'update') => {
  const accountNumber = input.accountNumber?.replace(/\s+/g, '')
  const accountNumberLast4 = getLast4(accountNumber)
  const metadata = {
    ...(input.accountHolder?.trim() ? { accountHolder: input.accountHolder.trim() } : {}),
    ...(accountNumberLast4 ? { accountNumberLast4 } : {}),
    ...(input.bankName?.trim() ? { bankFullName: input.bankName.trim() } : {}),
    refundDestination: true,
  }
  const shouldSendMetadata = mode === 'create' || Object.keys(metadata).length > 1

  return {
    ...(mode === 'create' ? { type: 'BANK' } : {}),
    ...(input.displayName?.trim() ? { displayName: input.displayName.trim() } : {}),
    ...(input.bankCode?.trim() ? { bankCode: input.bankCode.trim().toUpperCase() } : {}),
    ...(input.bankName?.trim() ? { bankName: input.bankName.trim() } : {}),
    ...(accountNumber ? {
      accountNumber,
      maskedInfo: `****${accountNumberLast4}`,
    } : {}),
    ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
    ...(shouldSendMetadata ? { metadata } : {}),
  }
}

export const paymentMethodsService = {
  list() {
    return requestCustomer<CustomerPaymentMethod[]>('/payment-methods')
  },

  create(input: SavePaymentMethodInput) {
    return requestCustomer<CustomerPaymentMethod>('/payment-methods', {
      method: 'POST',
      body: JSON.stringify(toPayload(input, 'create')),
    })
  },

  update(id: string, input: SavePaymentMethodInput) {
    return requestCustomer<CustomerPaymentMethod>(`/payment-methods/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(toPayload(input, 'update')),
    })
  },

  setDefault(id: string) {
    return requestCustomer<CustomerPaymentMethod>(`/payment-methods/${encodeURIComponent(id)}/default`, {
      method: 'PATCH',
    })
  },

  disable(id: string) {
    return requestCustomer<CustomerPaymentMethod>(`/payment-methods/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
  },
}
