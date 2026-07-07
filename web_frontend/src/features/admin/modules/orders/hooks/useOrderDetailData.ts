import { useCallback, useState } from 'react'
import {
  getOrder,
  listAuditLogs,
  listCustomerPaymentMethods,
  listOrderTransactions,
  type AdminAuditLog,
  type AdminCustomerPaymentMethod,
  type AdminOrder,
  type AdminTransaction,
} from '../orderAdminApi'
import type { Notice } from '../orderTypes'
import { getErrorMessage } from '../orderPresentation'

export function useOrderDetailData({
  canReadCustomerPaymentMethods,
  setNotice,
}: {
  canReadCustomerPaymentMethods: boolean
  setNotice: (notice: Notice | null) => void
}) {
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null)
  const [transactions, setTransactions] = useState<AdminTransaction[]>([])
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([])
  const [customerPaymentMethods, setCustomerPaymentMethods] = useState<AdminCustomerPaymentMethod[]>([])
  const [revealedRefundAccounts, setRevealedRefundAccounts] = useState<Record<string, string>>({})
  const [isDrawerLoading, setIsDrawerLoading] = useState(false)

  const resetOrderDetail = useCallback(() => {
    setSelectedOrder(null)
    setTransactions([])
    setAuditLogs([])
    setCustomerPaymentMethods([])
    setRevealedRefundAccounts({})
  }, [])

  const refreshSelectedOrder = useCallback(async (orderId: string) => {
    setIsDrawerLoading(true)

    try {
      const orderDetail = await getOrder(orderId)
      const [orderTransactions, paymentMethods, orderAuditLogs] = await Promise.all([
        listOrderTransactions(orderId),
        canReadCustomerPaymentMethods
          ? listCustomerPaymentMethods(orderDetail.user_id).catch(() => [])
          : Promise.resolve([]),
        listAuditLogs({ targetType: 'Order', targetId: orderId, limit: 20 }),
      ])
      setSelectedOrder(orderDetail)
      setTransactions(orderTransactions)
      setCustomerPaymentMethods(paymentMethods)
      setAuditLogs(orderAuditLogs.items)
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setIsDrawerLoading(false)
    }
  }, [canReadCustomerPaymentMethods, setNotice])

  const openOrder = useCallback((order: AdminOrder) => {
    setSelectedOrder(order)
    setTransactions([])
    setAuditLogs([])
    setCustomerPaymentMethods([])
    setRevealedRefundAccounts({})
    setNotice(null)
    void refreshSelectedOrder(order._id)
  }, [refreshSelectedOrder, setNotice])

  const openOrderById = useCallback((orderId: string) => {
    setSelectedOrder(null)
    setTransactions([])
    setAuditLogs([])
    setCustomerPaymentMethods([])
    setRevealedRefundAccounts({})
    setNotice(null)
    void refreshSelectedOrder(orderId)
  }, [refreshSelectedOrder, setNotice])

  return {
    auditLogs,
    customerPaymentMethods,
    isDrawerLoading,
    openOrder,
    openOrderById,
    refreshSelectedOrder,
    resetOrderDetail,
    revealedRefundAccounts,
    selectedOrder,
    setRevealedRefundAccounts,
    setSelectedOrder,
    transactions,
  }
}
