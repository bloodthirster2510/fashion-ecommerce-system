import { useCallback, type Dispatch, type SetStateAction } from 'react'
import { requestAdminNotificationRefresh } from '../../../notifications/notification-summary-events'
import {
  adjustOrderPaymentStatus,
  expireStalePayments,
  revealCustomerPaymentMethodAccount,
  updateCustomerPaymentMethodStatus,
  type AdminCustomerPaymentMethod,
  type AdminOrder,
  type AdminOrderPaymentStatus,
  type AdminPaymentMethodStatus,
} from '../orderAdminApi'
import type { Notice, OrderActionDialogState } from '../orderTypes'
import { getErrorMessage } from '../orderPresentation'

type UseOrderPaymentActionsOptions = {
  canAdjustPayments: boolean
  loadOrders: () => Promise<void>
  openActionDialog: (dialog: OrderActionDialogState) => void
  refreshSelectedOrder: (orderId: string) => Promise<void>
  replaceOrderRow: (order: AdminOrder) => void
  selectedOrder: AdminOrder | null
  setActionDialog: (dialog: OrderActionDialogState | null) => void
  setActionDialogError: (message: string) => void
  setActionLoading: (isLoading: boolean) => void
  setNotice: (notice: Notice | null) => void
  setRevealedRefundAccounts: Dispatch<SetStateAction<Record<string, string>>>
}

export function useOrderPaymentActions({
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
}: UseOrderPaymentActionsOptions) {
  const handleRevealRefundAccount = useCallback(async (method: AdminCustomerPaymentMethod) => {
    if (!canAdjustPayments) {
      setNotice({ type: 'error', message: 'Cần quyền payments.adjust để xem số tài khoản hoàn tiền.' })
      return
    }

    if (!method.hasStoredAccountNumber) {
      setNotice({ type: 'error', message: 'Tài khoản này chưa lưu số đầy đủ. Khách cần cập nhật lại tài khoản nhận hoàn tiền.' })
      return
    }

    setActionLoading(true)
    setNotice(null)

    try {
      const result = await revealCustomerPaymentMethodAccount(method._id)
      setRevealedRefundAccounts((current) => ({
        ...current,
        [method._id]: result.accountNumber,
      }))
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setActionLoading(false)
    }
  }, [canAdjustPayments, setActionLoading, setNotice, setRevealedRefundAccounts])

  const handleExpireStalePayments = async () => {
    setActionLoading(true)
    setNotice(null)

    try {
      const result = await expireStalePayments()
      setNotice({
        type: 'success',
        message: `Đã chuyển ${result.expiredCount} lượt thanh toán quá hạn sang hết hạn. Đơn sẽ tự hủy khi quá 3 ngày.`,
      })
      await loadOrders()
      requestAdminNotificationRefresh()
      if (selectedOrder) {
        await refreshSelectedOrder(selectedOrder._id)
      }
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setActionLoading(false)
    }
  }

  const executeAdjustPaymentStatus = async (
    order: AdminOrder,
    nextStatus: AdminOrderPaymentStatus,
    reason: string,
  ) => {
    setActionDialog(null)
    setActionDialogError('')
    setActionLoading(true)
    setNotice(null)

    try {
      const updatedOrder = await adjustOrderPaymentStatus(order._id, nextStatus, reason.trim())
      replaceOrderRow(updatedOrder)
      setNotice({ type: 'success', message: 'Đã điều chỉnh trạng thái thanh toán' })
      await refreshSelectedOrder(updatedOrder._id)
      await loadOrders()
      requestAdminNotificationRefresh()
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setActionLoading(false)
    }
  }

  const handleAdjustPaymentStatus = async (nextStatus: AdminOrderPaymentStatus) => {
    if (!selectedOrder) return
    openActionDialog({ type: 'payment-status', order: selectedOrder, nextStatus })
  }

  const executeUpdatePaymentMethodStatus = async (
    order: AdminOrder,
    method: AdminCustomerPaymentMethod,
    nextStatus: AdminPaymentMethodStatus,
    reason: string,
  ) => {
    setActionDialog(null)
    setActionDialogError('')
    setActionLoading(true)
    setNotice(null)

    try {
      await updateCustomerPaymentMethodStatus(method._id, nextStatus, reason.trim())
      setNotice({ type: 'success', message: 'Đã cập nhật phương thức thanh toán của khách hàng' })
      await refreshSelectedOrder(order._id)
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setActionLoading(false)
    }
  }

  const handleUpdatePaymentMethodStatus = async (
    method: AdminCustomerPaymentMethod,
    nextStatus: AdminPaymentMethodStatus,
  ) => {
    if (!selectedOrder) return
    openActionDialog({ type: 'payment-method-status', order: selectedOrder, method, nextStatus })
  }

  return {
    executeAdjustPaymentStatus,
    executeUpdatePaymentMethodStatus,
    handleAdjustPaymentStatus,
    handleExpireStalePayments,
    handleRevealRefundAccount,
    handleUpdatePaymentMethodStatus,
  }
}
