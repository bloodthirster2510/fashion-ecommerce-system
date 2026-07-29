import { requestAdminNotificationRefresh } from '../../../notifications/notification-summary-events'
import {
  cancelGhnShipment,
  createGhnShipment,
  simulateShippingWebhook,
  syncGhnShipment,
  updateOrderGhnMapping,
  updateOrderShipping,
  type AdminOrder,
  type UpdateOrderGhnMappingPayload,
} from '../orderAdminApi'
import type {
  Notice,
  OrderActionDialogState,
  ShippingSimulationStatus,
  ShippingUpdateDialogValues,
} from '../orderTypes'
import {
  canSimulateShippingStatus,
  formatShippingStatus,
  getErrorMessage,
  getShippingSimulationActionLabel,
  getShippingUpdateDialogValues,
  shippingSimulationActions,
} from '../orderPresentation'

type UseOrderShippingActionsOptions = {
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

export function useOrderShippingActions({
  loadOrders,
  openActionDialog,
  refreshSelectedOrder,
  replaceOrderRow,
  selectedOrder,
  setActionDialog,
  setActionDialogError,
  setActionLoading,
  setNotice,
}: UseOrderShippingActionsOptions) {
  const executeShippingUpdate = async (order: AdminOrder, values: ShippingUpdateDialogValues) => {
    const actualCostText = values.actualProviderCost.trim()
    const reason = values.reason.trim()

    const actualProviderCost = actualCostText ? Number(actualCostText) : null
    if (actualProviderCost !== null && (!Number.isFinite(actualProviderCost) || actualProviderCost < 0)) {
      setActionDialogError('Chi phí vận chuyển không hợp lệ')
      return
    }

    if (!reason) {
      setActionDialogError('Cần nhập lý do cập nhật vận chuyển')
      return
    }

    setActionDialog(null)
    setActionDialogError('')
    setActionLoading(true)
    setNotice(null)

    try {
      const updatedOrder = await updateOrderShipping(order._id, {
        provider: values.provider.trim() || null,
        trackingCode: values.trackingCode.trim() || null,
        labelUrl: values.labelUrl.trim() || null,
        status: values.status.trim() || null,
        actualProviderCost,
        reason,
      })
      replaceOrderRow(updatedOrder)
      setNotice({ type: 'success', message: 'Đã cập nhật thông tin vận đơn' })
      await refreshSelectedOrder(updatedOrder._id)
      await loadOrders()
      requestAdminNotificationRefresh()
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setActionLoading(false)
    }
  }

  const handleShippingUpdate = async () => {
    if (!selectedOrder) return

    openActionDialog({
      type: 'shipping',
      order: selectedOrder,
      values: getShippingUpdateDialogValues(selectedOrder),
    })
  }

  const handleSimulateShippingStatus = async (nextShippingStatus: ShippingSimulationStatus) => {
    if (!selectedOrder) return

    if (!canSimulateShippingStatus(selectedOrder, nextShippingStatus)) {
      setNotice({ type: 'error', message: 'Trạng thái giao hàng chưa phù hợp với bước hiện tại của đơn.' })
      return
    }

    const simulationAction = shippingSimulationActions.find((action) => action.status === nextShippingStatus)
    const actionLabel = simulationAction
      ? getShippingSimulationActionLabel(selectedOrder, simulationAction)
      : formatShippingStatus(nextShippingStatus)
    const reason = `Mô phỏng đơn vị vận chuyển: ${actionLabel}`

    setActionLoading(true)
    setNotice(null)

    try {
      const updatedOrder = await simulateShippingWebhook(selectedOrder._id, {
        status: nextShippingStatus,
        reason,
        provider: selectedOrder.shipping?.provider ?? 'GHN',
        trackingCode: selectedOrder.shipping?.trackingCode ?? null,
      })

      replaceOrderRow(updatedOrder)
      setNotice({ type: 'success', message: `Đã nhận webhook vận chuyển: ${actionLabel}` })
      await refreshSelectedOrder(updatedOrder._id)
      await loadOrders()
      requestAdminNotificationRefresh()
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setActionLoading(false)
    }
  }

  const handleCreateGhnShipment = async () => {
    if (!selectedOrder) return

    setActionLoading(true)
    setNotice(null)

    try {
      const updatedOrder = await createGhnShipment(selectedOrder._id)
      replaceOrderRow(updatedOrder)
      setNotice({ type: 'success', message: 'Đã tạo vận đơn GHN và liên kết vào đơn hàng' })
      await refreshSelectedOrder(updatedOrder._id)
      await loadOrders()
      requestAdminNotificationRefresh()
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setActionLoading(false)
    }
  }

  const handleUpdateGhnMapping = async (payload: UpdateOrderGhnMappingPayload) => {
    if (!selectedOrder) return

    setActionLoading(true)
    setNotice(null)

    try {
      const updatedOrder = await updateOrderGhnMapping(selectedOrder._id, payload)
      replaceOrderRow(updatedOrder)
      setNotice({
        type: 'success',
        message: 'Đã xác minh mapping GHN và đưa địa chỉ ra khỏi hàng chờ thủ công',
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

  const executeCancelGhnShipment = async (order: AdminOrder) => {
    setActionDialog(null)
    setActionDialogError('')
    setActionLoading(true)
    setNotice(null)

    try {
      const updatedOrder = await cancelGhnShipment(order._id, 'Admin cancelled GHN shipment')
      replaceOrderRow(updatedOrder)
      setNotice({ type: 'success', message: 'Đã hủy vận đơn GHN' })
      await refreshSelectedOrder(updatedOrder._id)
      await loadOrders()
      requestAdminNotificationRefresh()
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancelGhnShipment = async () => {
    if (!selectedOrder) return
    openActionDialog({ type: 'cancel-ghn', order: selectedOrder })
  }

  const handleSyncGhnShipment = async () => {
    if (!selectedOrder) return

    setActionLoading(true)
    setNotice(null)

    try {
      const updatedOrder = await syncGhnShipment(selectedOrder._id)
      replaceOrderRow(updatedOrder)
      setNotice({ type: 'success', message: 'Đã đồng bộ trạng thái GHN' })
      await refreshSelectedOrder(updatedOrder._id)
      await loadOrders()
      requestAdminNotificationRefresh()
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setActionLoading(false)
    }
  }

  return {
    executeCancelGhnShipment,
    executeShippingUpdate,
    handleCancelGhnShipment,
    handleCreateGhnShipment,
    handleShippingUpdate,
    handleSimulateShippingStatus,
    handleSyncGhnShipment,
    handleUpdateGhnMapping,
  }
}
