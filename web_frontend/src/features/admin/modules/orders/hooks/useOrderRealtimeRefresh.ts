import { useEffect, useState } from 'react'
import { requestAdminNotificationRefresh } from '../../../notifications/notification-summary-events'
import { useOrderRealtime } from '../orderRealtime'
import type { Notice } from '../orderTypes'

export function useOrderRealtimeRefresh({
  loadOrders,
  onOpenRealtimeOrder,
  refreshSelectedOrder,
  selectedOrderId,
  setNotice,
}: {
  loadOrders: (options?: { quiet?: boolean }) => Promise<void>
  onOpenRealtimeOrder?: (orderId: string) => void
  refreshSelectedOrder: (orderId: string) => Promise<void>
  selectedOrderId?: string | null
  setNotice: (notice: Notice | null) => void
}) {
  const [realtimeOrderId, setRealtimeOrderId] = useState<string | null>(null)

  useOrderRealtime((event) => {
    setRealtimeOrderId(event.orderId)
    void loadOrders({ quiet: true })
    requestAdminNotificationRefresh()
    if (selectedOrderId === event.orderId) void refreshSelectedOrder(event.orderId)

    const nextStatus = event.after?.shippingStatus ?? event.after?.status
    setNotice({
      type: 'success',
      message: `Đơn ${event.orderCode} vừa cập nhật${nextStatus ? `: ${nextStatus}` : ''}`,
      action: onOpenRealtimeOrder
        ? {
            label: 'Xem đơn',
            onClick: () => onOpenRealtimeOrder(event.orderId),
          }
        : undefined,
    })
  })

  useEffect(() => {
    if (!realtimeOrderId) return
    const handle = window.setTimeout(() => setRealtimeOrderId(null), 5_000)
    return () => window.clearTimeout(handle)
  }, [realtimeOrderId])

  useEffect(() => {
    const refreshOnFocus = () => {
      if (document.visibilityState === 'visible') void loadOrders({ quiet: true })
    }

    window.addEventListener('focus', refreshOnFocus)
    return () => {
      window.removeEventListener('focus', refreshOnFocus)
    }
  }, [loadOrders])

  return realtimeOrderId
}
