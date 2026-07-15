import type { AdminOrder } from '../orderAdminApi'
import { getOrderDisplayStatus } from '../orderPresentation'

export function OrderStatusPill({ order }: { order: AdminOrder }) {
  const displayStatus = getOrderDisplayStatus(order)

  return <span className={displayStatus.className}>{displayStatus.label}</span>
}
