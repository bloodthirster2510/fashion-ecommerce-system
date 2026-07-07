import type { AdminOrderStatus } from '../orderAdminApi'
import { getOrderPillClass, statusLabels } from '../orderPresentation'

export function OrderStatusPill({ status }: { status: AdminOrderStatus }) {
  return <span className={getOrderPillClass(status)}>{statusLabels[status]}</span>
}
