import type { AdminOrderStatus } from '../orderAdminApi'
import {
  getOrderProgressPercent,
  orderFlowLabels,
  orderFlowSteps,
} from '../orderPresentation'

export function OrderProgressRail({
  compact = false,
  shippingStatus,
  status,
}: {
  compact?: boolean
  shippingStatus?: string | null
  status: AdminOrderStatus
}) {
  const isException = status === 'cancelled' || status === 'return_requested' || status === 'returned'
  const progressPercent = getOrderProgressPercent(status, shippingStatus)
  const currentIndex = isException && status !== 'cancelled'
    ? orderFlowSteps.length - 1
    : orderFlowSteps.indexOf(status as (typeof orderFlowSteps)[number])

  return (
    <div className={`admin-order-progress${compact ? ' is-compact' : ''}${isException ? ' is-exception' : ''}`}>
      <progress value={progressPercent} max={100} aria-label="Tiến độ xử lý đơn hàng" />
      {!compact ? (
        <ol>
          {orderFlowSteps.map((step) => (
            <li className={orderFlowSteps.indexOf(step) <= currentIndex ? 'is-done' : ''} key={step}>
              {orderFlowLabels[step]}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  )
}
