import type { AdminUser } from '../auth/adminSession'
import type {
  AdminCustomerPaymentMethod,
  AdminOrder,
  AdminOrderPaymentStatus,
  AdminOrderStatus,
  AdminPaymentMethodStatus,
  AdminReturnReviewDecision,
} from './orderAdminApi'

export type OrdersPageProps = {
  currentUser: AdminUser
  paymentSection?: PaymentSectionKey
  lockPaymentSection?: boolean
  initialTabKey?: string
}

export type OrderTab = {
  key: string
  label: string
  helper?: string
  group: OrderTabGroupKey
  statuses?: AdminOrderStatus[]
  paymentStatus?: AdminOrderPaymentStatus
  queue?: OrderQueueKey
}

export type OrderTabGroupKey = 'flow' | 'exceptions' | 'lookup'
export type OrderQueueKey =
  | 'packing'
  | 'handoff'
  | 'delivery'
  | 'blocked'
  | 'review'
  | 'refund'
  | 'payment-deadline'
  | 'shipping-mapping'
export type PaymentSectionKey = 'all' | 'online' | 'cod'
export type ShippingSimulationStatus = 'picked' | 'shipping' | 'delivered' | 'failed'
export type OrderTableColumnKey = 'customer' | 'total' | 'status' | 'createdAt'

export type Notice = {
  type: 'success' | 'warning' | 'error'
  message: string
  action?: {
    label: string
    onClick: () => void
  }
}

export type ShippingUpdateDialogValues = {
  provider: string
  trackingCode: string
  labelUrl: string
  status: string
  actualProviderCost: string
  reason: string
}

export type OrderActionDialogState =
  | {
      type: 'status'
      order: AdminOrder
      nextStatus: AdminOrderStatus
    }
  | {
      type: 'return-review'
      order: AdminOrder
      decision: AdminReturnReviewDecision
    }
  | {
      type: 'shipping'
      order: AdminOrder
      values: ShippingUpdateDialogValues
    }
  | {
      type: 'cancel-ghn'
      order: AdminOrder
    }
  | {
      type: 'payment-status'
      order: AdminOrder
      nextStatus: AdminOrderPaymentStatus
    }
  | {
      type: 'payment-method-status'
      order: AdminOrder
      method: AdminCustomerPaymentMethod
      nextStatus: AdminPaymentMethodStatus
    }

export type OrderActionDialogInput = {
  reason?: string
  shipping?: ShippingUpdateDialogValues
}
