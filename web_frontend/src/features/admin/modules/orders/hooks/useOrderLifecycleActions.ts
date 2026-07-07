import { requestAdminNotificationRefresh } from '../../../notifications/notification-summary-events'
import {
  reviewReturnRequest,
  updateOrderStatus,
  type AdminOrder,
  type AdminOrderStatus,
  type AdminReturnReviewDecision,
} from '../orderAdminApi'
import type { Notice, OrderActionDialogState } from '../orderTypes'
import { getErrorMessage } from '../orderPresentation'

type UseOrderLifecycleActionsOptions = {
  loadOrders: () => Promise<void>
  openActionDialog: (dialog: OrderActionDialogState) => void
  refreshSelectedOrder: (orderId: string) => Promise<void>
  replaceOrderRow: (order: AdminOrder) => void
  selectedOrder: AdminOrder | null
  setActionDialog: (dialog: OrderActionDialogState | null) => void
  setActionDialogError: (message: string) => void
  setActionLoading: (isLoading: boolean) => void
  setNotice: (notice: Notice | null) => void
}

export function useOrderLifecycleActions({
  loadOrders,
  openActionDialog,
  refreshSelectedOrder,
  replaceOrderRow,
  selectedOrder,
  setActionDialog,
  setActionDialogError,
  setActionLoading,
  setNotice,
}: UseOrderLifecycleActionsOptions) {
  const executeStatusUpdate = async (
    order: AdminOrder,
    nextStatus: AdminOrderStatus,
    reason?: string,
  ) => {
    setActionDialog(null)
    setActionDialogError('')
    setActionLoading(true)
    setNotice(null)

    try {
      const updatedOrder = await updateOrderStatus(order._id, nextStatus, reason?.trim())
      replaceOrderRow(updatedOrder)
      setNotice({
        type: 'success',
        message: nextStatus === 'delivered'
          ? 'Đã đánh dấu đơn giao tới khách'
          : nextStatus === 'completed'
            ? 'Đã đánh dấu khách đã nhận hàng'
            : 'Đã cập nhật trạng thái đơn hàng',
      })
      await refreshSelectedOrder(updatedOrder._id)
      await loadOrders()
      requestAdminNotificationRefresh()
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setActionLoading(false)
    }
  }

  const handleStatusUpdate = async (nextStatus: AdminOrderStatus) => {
    if (!selectedOrder) return

    if (nextStatus === 'cancelled' || nextStatus === 'delivered') {
      openActionDialog({ type: 'status', order: selectedOrder, nextStatus })
      return
    }

    await executeStatusUpdate(selectedOrder, nextStatus)
  }

  const executeReviewReturnRequest = async (
    order: AdminOrder,
    decision: AdminReturnReviewDecision,
    reason?: string,
  ) => {
    const normalizedReason = (reason ?? '').trim()

    setActionDialog(null)
    setActionDialogError('')
    setActionLoading(true)
    setNotice(null)

    try {
      const updatedOrder = await reviewReturnRequest(
        order._id,
        decision,
        normalizedReason || undefined,
      )
      replaceOrderRow(updatedOrder)
      setNotice({
        type: 'success',
        message: decision === 'approved'
          ? 'Đã duyệt yêu cầu trả hàng'
          : 'Đã từ chối yêu cầu trả hàng',
      })
      await refreshSelectedOrder(updatedOrder._id)
      await loadOrders()
      requestAdminNotificationRefresh()
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setActionLoading(false)
    }
  }

  const handleReviewReturnRequest = async (decision: AdminReturnReviewDecision) => {
    if (!selectedOrder) return
    openActionDialog({ type: 'return-review', order: selectedOrder, decision })
  }

  return {
    executeReviewReturnRequest,
    executeStatusUpdate,
    handleReviewReturnRequest,
    handleStatusUpdate,
  }
}
