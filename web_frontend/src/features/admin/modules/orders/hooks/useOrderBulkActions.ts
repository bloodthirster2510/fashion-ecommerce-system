import { useEffect, useMemo, useState } from 'react'
import { requestAdminNotificationRefresh } from '../../../notifications/notification-summary-events'
import {
  bulkProcessGhnShipments,
  bulkUpdateOrderStatus,
  exportOrdersCsv,
  type AdminOrder,
  type AdminOrderStatus,
  type BulkOrderActionResult,
  type OrderListFilters,
} from '../orderAdminApi'
import { getErrorMessage } from '../orderPresentation'
import type { Notice } from '../orderTypes'

type UseOrderBulkActionsOptions = {
  activeFilters: OrderListFilters
  loadOrders: () => void | Promise<void>
  orders: AdminOrder[]
  setNotice: (notice: Notice | null) => void
}

const getSafeLabelUrl = (value?: string | null) => {
  if (!value) return null

  try {
    const url = new URL(value, window.location.origin)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

const getBulkResultNotice = (result: BulkOrderActionResult, actionLabel: string): Notice => {
  if (result.failedCount === 0) {
    return {
      type: 'success',
      message: `${actionLabel} thành công cho ${result.succeededCount} đơn hàng.`,
    }
  }

  const firstFailure = result.results.find((item) => !item.success)?.message
  return {
    type: result.succeededCount > 0 ? 'warning' : 'error',
    message: `${actionLabel}: thành công ${result.succeededCount}, lỗi ${result.failedCount}.`
      + (firstFailure ? ` Lỗi đầu tiên: ${firstFailure}` : ''),
  }
}

export function useOrderBulkActions({
  activeFilters,
  loadOrders,
  orders,
  setNotice,
}: UseOrderBulkActionsOptions) {
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([])
  const [bulkStatus, setBulkStatus] = useState<AdminOrderStatus>('packed')
  const [bulkReason, setBulkReason] = useState('')
  const [isBulkLoading, setIsBulkLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    const visibleOrderIds = new Set(orders.map((order) => order._id))
    setSelectedOrderIds((current) => current.filter((orderId) => visibleOrderIds.has(orderId)))
  }, [orders])

  const selectedOrders = useMemo(() => {
    const selectedIdSet = new Set(selectedOrderIds)
    return orders.filter((order) => selectedIdSet.has(order._id))
  }, [orders, selectedOrderIds])

  const labelCount = selectedOrders.filter((order) => getSafeLabelUrl(order.shipping?.labelUrl)).length

  const toggleOrder = (orderId: string, selected: boolean) => {
    setSelectedOrderIds((current) => (
      selected
        ? [...new Set([...current, orderId])]
        : current.filter((currentOrderId) => currentOrderId !== orderId)
    ))
  }

  const togglePage = (selected: boolean) => {
    setSelectedOrderIds(selected ? orders.map((order) => order._id) : [])
  }

  const finishBulkAction = async (result: BulkOrderActionResult, actionLabel: string) => {
    const failedOrderIds = result.results
      .filter((item) => !item.success)
      .map((item) => item.orderId)

    setSelectedOrderIds(failedOrderIds)
    setNotice(getBulkResultNotice(result, actionLabel))
    await loadOrders()
    requestAdminNotificationRefresh()
  }

  const handleBulkStatusUpdate = async () => {
    const reason = bulkReason.trim()
    if (selectedOrderIds.length === 0) {
      setNotice({ type: 'warning', message: 'Hãy chọn ít nhất một đơn hàng.' })
      return
    }
    if (!reason) {
      setNotice({ type: 'warning', message: 'Lý do thao tác hàng loạt là bắt buộc.' })
      return
    }

    setIsBulkLoading(true)
    setNotice(null)
    try {
      const result = await bulkUpdateOrderStatus(selectedOrderIds, bulkStatus, reason)
      await finishBulkAction(result, 'Cập nhật trạng thái')
      if (result.failedCount === 0) setBulkReason('')
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setIsBulkLoading(false)
    }
  }

  const handleBulkGhn = async (action: 'create' | 'sync') => {
    const reason = bulkReason.trim()
    if (selectedOrderIds.length === 0) {
      setNotice({ type: 'warning', message: 'Hãy chọn ít nhất một đơn hàng.' })
      return
    }
    if (selectedOrderIds.length > 20) {
      setNotice({ type: 'warning', message: 'Mỗi lượt xử lý GHN tối đa 20 đơn để tránh quá tải nhà vận chuyển.' })
      return
    }
    if (!reason) {
      setNotice({ type: 'warning', message: 'Lý do thao tác hàng loạt là bắt buộc.' })
      return
    }

    setIsBulkLoading(true)
    setNotice(null)
    try {
      const result = await bulkProcessGhnShipments(selectedOrderIds, action, reason)
      await finishBulkAction(
        result,
        action === 'create' ? 'Tạo lại vận đơn GHN' : 'Đồng bộ vận đơn GHN',
      )
      if (result.failedCount === 0) setBulkReason('')
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setIsBulkLoading(false)
    }
  }

  const handleExportCsv = async () => {
    setIsExporting(true)
    setNotice(null)
    try {
      const result = await exportOrdersCsv(activeFilters)
      downloadBlob(result.blob, result.filename)
      setNotice({
        type: result.truncated ? 'warning' : 'success',
        message: result.truncated
          ? `Đã xuất 5.000/${result.totalItems ?? 'nhiều'} đơn đầu tiên theo bộ lọc.`
          : `Đã xuất ${result.totalItems ?? 'toàn bộ'} đơn hàng theo bộ lọc.`,
      })
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setIsExporting(false)
    }
  }

  const handleOpenLabels = () => {
    const labelUrls = Array.from(new Set(
      selectedOrders
        .map((order) => getSafeLabelUrl(order.shipping?.labelUrl))
        .filter((url): url is string => Boolean(url)),
    ))

    if (labelUrls.length === 0) {
      setNotice({ type: 'warning', message: 'Các đơn đã chọn chưa có URL nhãn vận chuyển hợp lệ.' })
      return
    }

    labelUrls.forEach((url) => window.open(url, '_blank', 'noopener,noreferrer'))
    setNotice({
      type: 'success',
      message: `Đã yêu cầu mở ${labelUrls.length} nhãn vận chuyển. Hãy cho phép popup nếu trình duyệt chặn.`,
    })
  }

  return {
    bulkReason,
    bulkStatus,
    clearSelection: () => setSelectedOrderIds([]),
    handleBulkGhn,
    handleBulkStatusUpdate,
    handleExportCsv,
    handleOpenLabels,
    isBulkLoading,
    isExporting,
    labelCount,
    selectedOrderIds,
    setBulkReason,
    setBulkStatus,
    toggleOrder,
    togglePage,
  }
}
