import { useState, type Dispatch, type SetStateAction } from 'react'
import { type AdminOrder } from '../orderAdminApi'
import type {
  Notice,
  OrderActionDialogInput,
  OrderActionDialogState,
} from '../orderTypes'
import { useOrderLifecycleActions } from './useOrderLifecycleActions'
import { useOrderPaymentActions } from './useOrderPaymentActions'
import { useOrderShippingActions } from './useOrderShippingActions'

type UseOrderActionsOptions = {
  canAdjustPayments: boolean
  loadOrders: () => Promise<void>
  refreshSelectedOrder: (orderId: string) => Promise<void>
  selectedOrder: AdminOrder | null
  setNotice: (notice: Notice | null) => void
  setOrders: Dispatch<SetStateAction<AdminOrder[]>>
  setRevealedRefundAccounts: Dispatch<SetStateAction<Record<string, string>>>
  setSelectedOrder: Dispatch<SetStateAction<AdminOrder | null>>
}

export function useOrderActions({
  canAdjustPayments,
  loadOrders,
  refreshSelectedOrder,
  selectedOrder,
  setNotice,
  setOrders,
  setRevealedRefundAccounts,
  setSelectedOrder,
}: UseOrderActionsOptions) {
  const [actionLoading, setActionLoading] = useState(false)
  const [actionDialog, setActionDialog] = useState<OrderActionDialogState | null>(null)
  const [actionDialogError, setActionDialogError] = useState('')

  const replaceOrderRow = (updatedOrder: AdminOrder) => {
    setSelectedOrder(updatedOrder)
    setOrders((currentOrders) =>
      currentOrders.map((order) => (order._id === updatedOrder._id ? updatedOrder : order)),
    )
  }

  const closeActionDialog = () => {
    if (!actionLoading) {
      setActionDialog(null)
      setActionDialogError('')
    }
  }

  const openActionDialog = (dialog: OrderActionDialogState) => {
    setActionDialogError('')
    setActionDialog(dialog)
  }

  const {
    executeReviewReturnRequest,
    executeStatusUpdate,
    handleReviewReturnRequest,
    handleStatusUpdate,
  } = useOrderLifecycleActions({
    loadOrders,
    openActionDialog,
    refreshSelectedOrder,
    replaceOrderRow,
    selectedOrder,
    setActionDialog,
    setActionDialogError,
    setActionLoading,
    setNotice,
  })

  const {
    executeCancelGhnShipment,
    executeShippingUpdate,
    handleCancelGhnShipment,
    handleCreateGhnShipment,
    handleShippingUpdate,
    handleSimulateShippingStatus,
    handleSyncGhnShipment,
  } = useOrderShippingActions({
    loadOrders,
    openActionDialog,
    refreshSelectedOrder,
    replaceOrderRow,
    selectedOrder,
    setActionDialog,
    setActionDialogError,
    setActionLoading,
    setNotice,
  })

  const {
    executeAdjustPaymentStatus,
    executeUpdatePaymentMethodStatus,
    handleAdjustPaymentStatus,
    handleExpireStalePayments,
    handleRevealRefundAccount,
    handleUpdatePaymentMethodStatus,
  } = useOrderPaymentActions({
    canAdjustPayments,
    loadOrders,
    openActionDialog,
    refreshSelectedOrder,
    replaceOrderRow,
    selectedOrder,
    setActionDialog,
    setActionDialogError,
    setActionLoading,
    setNotice,
    setRevealedRefundAccounts,
  })


  const handleSubmitActionDialog = (input: OrderActionDialogInput) => {
    if (!actionDialog) return

    if (actionDialog.type === 'status') {
      const reason = (input.reason ?? '').trim()
      if (actionDialog.nextStatus === 'cancelled' && !reason) {
        setActionDialogError('Cần nhập lý do hủy đơn')
        return
      }

      void executeStatusUpdate(actionDialog.order, actionDialog.nextStatus, reason || undefined)
      return
    }

    if (actionDialog.type === 'return-review') {
      const reason = (input.reason ?? '').trim()
      if (actionDialog.decision === 'rejected' && !reason) {
        setActionDialogError('Cần nhập lý do từ chối trả hàng')
        return
      }

      void executeReviewReturnRequest(actionDialog.order, actionDialog.decision, reason || undefined)
      return
    }

    if (actionDialog.type === 'shipping') {
      if (!input.shipping) return
      void executeShippingUpdate(actionDialog.order, input.shipping)
      return
    }

    if (actionDialog.type === 'cancel-ghn') {
      void executeCancelGhnShipment(actionDialog.order)
      return
    }

    const reason = (input.reason ?? '').trim()
    if (!reason) {
      setActionDialogError('Cần nhập lý do thao tác')
      return
    }

    if (reason.length < 5) {
      setActionDialogError('Lý do cần ít nhất 5 ký tự')
      return
    }

    if (actionDialog.type === 'payment-status') {
      void executeAdjustPaymentStatus(actionDialog.order, actionDialog.nextStatus, reason)
      return
    }

    void executeUpdatePaymentMethodStatus(
      actionDialog.order,
      actionDialog.method,
      actionDialog.nextStatus,
      reason,
    )
  }

  return {
    actionDialog,
    actionDialogError,
    actionLoading,
    closeActionDialog,
    handleAdjustPaymentStatus,
    handleCancelGhnShipment,
    handleCreateGhnShipment,
    handleExpireStalePayments,
    handleRevealRefundAccount,
    handleReviewReturnRequest,
    handleShippingUpdate,
    handleSimulateShippingStatus,
    handleStatusUpdate,
    handleSubmitActionDialog,
    handleSyncGhnShipment,
    handleUpdatePaymentMethodStatus,
  }
}

