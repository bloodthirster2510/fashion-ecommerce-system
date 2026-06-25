import { type FormEvent, useEffect, useState } from 'react'
import type { OrderActionDialogInput, OrderActionDialogState, ShippingUpdateDialogValues } from './orderTypes'
import {
  getShippingUpdateDialogValues,
  paymentMethodStatusLabels,
  paymentStatusLabels,
} from './orderPresentation'

export function OrderActionDialog({
  action,
  errorMessage,
  isLoading,
  onClose,
  onSubmit,
}: {
  action: OrderActionDialogState
  errorMessage: string
  isLoading: boolean
  onClose: () => void
  onSubmit: (input: OrderActionDialogInput) => void
}) {
  const [reason, setReason] = useState('')
  const [shippingValues, setShippingValues] = useState<ShippingUpdateDialogValues>(
    action.type === 'shipping' ? action.values : getShippingUpdateDialogValues(action.order),
  )

  useEffect(() => {
    setReason('')
    setShippingValues(action.type === 'shipping' ? action.values : getShippingUpdateDialogValues(action.order))
  }, [action])

  const updateShippingValue = (field: keyof ShippingUpdateDialogValues, value: string) => {
    setShippingValues((current) => ({ ...current, [field]: value }))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (action.type === 'shipping') {
      onSubmit({ shipping: shippingValues })
      return
    }

    onSubmit({ reason })
  }

  const submitLabel = (() => {
    if (action.type === 'status' && action.nextStatus === 'cancelled') return 'Hủy đơn'
    if (action.type === 'status' && action.nextStatus === 'delivered') return 'Xác nhận đã giao'
    if (action.type === 'return-review') return action.decision === 'approved' ? 'Duyệt trả hàng' : 'Từ chối trả hàng'
    if (action.type === 'shipping') return 'Cập nhật vận đơn'
    if (action.type === 'cancel-ghn') return 'Hủy vận đơn GHN'
    if (action.type === 'payment-status') return 'Điều chỉnh thanh toán'
    return 'Cập nhật phương thức'
  })()

  const title = (() => {
    if (action.type === 'status' && action.nextStatus === 'cancelled') return 'Hủy đơn hàng'
    if (action.type === 'status' && action.nextStatus === 'delivered') return 'Xác nhận giao thành công'
    if (action.type === 'return-review') return action.decision === 'approved' ? 'Duyệt yêu cầu trả hàng' : 'Từ chối yêu cầu trả hàng'
    if (action.type === 'shipping') return 'Cập nhật vận đơn'
    if (action.type === 'cancel-ghn') return 'Hủy vận đơn GHN'
    if (action.type === 'payment-status') return 'Điều chỉnh trạng thái thanh toán'
    return 'Cập nhật phương thức thanh toán'
  })()

  const helper = (() => {
    if (action.type === 'status' && action.nextStatus === 'cancelled') {
      return 'Lý do hủy sẽ được ghi vào đơn và nhật ký thao tác.'
    }
    if (action.type === 'status' && action.nextStatus === 'delivered') {
      return 'Thời hạn trả hàng 7 ngày sẽ bắt đầu từ thời điểm xác nhận.'
    }
    if (action.type === 'return-review') {
      return action.decision === 'approved'
        ? 'Có thể thêm ghi chú để đội vận hành theo dõi xử lý sau duyệt.'
        : 'Lý do từ chối là bắt buộc để phản hồi cho khách hàng.'
    }
    if (action.type === 'shipping') {
      return 'Các trường bỏ trống sẽ được lưu dạng chưa có dữ liệu; lý do cập nhật là bắt buộc.'
    }
    if (action.type === 'cancel-ghn') {
      return 'Thao tác này hủy vận đơn đang liên kết với GHN cho đơn hiện tại.'
    }
    if (action.type === 'payment-status') {
      return `Chuyển thanh toán sang "${paymentStatusLabels[action.nextStatus]}". Lý do đối soát là bắt buộc.`
    }
    if (action.type === 'payment-method-status') {
      return `Chuyển "${action.method.displayName}" sang "${paymentMethodStatusLabels[action.nextStatus]}". Lý do là bắt buộc.`
    }
    return 'Vui lòng kiểm tra đúng đơn trước khi xác nhận thao tác.'
  })()

  const isDanger =
    (action.type === 'status' && action.nextStatus === 'cancelled') ||
    (action.type === 'return-review' && action.decision === 'rejected') ||
    action.type === 'cancel-ghn'
  const submitClassName = isDanger ? 'admin-danger-button' : 'admin-primary-button'

  return (
    <div className="admin-order-action-layer" role="dialog" aria-modal="true" aria-labelledby="admin-order-action-title">
      <button
        className="admin-order-action-backdrop"
        type="button"
        aria-label="Đóng"
        disabled={isLoading}
        onClick={onClose}
      />
      <form className="admin-order-action-dialog" onSubmit={handleSubmit}>
        <header>
          <div>
            <span>{action.order.orderCode}</span>
            <h2 id="admin-order-action-title">{title}</h2>
          </div>
          <button className="admin-icon-button" type="button" disabled={isLoading} onClick={onClose}>
            ×
          </button>
        </header>

        <p className="admin-order-action-helper">{helper}</p>

        {action.type === 'shipping' ? (
          <div className="admin-order-action-grid">
            <label>
              <span>Đơn vị vận chuyển</span>
              <input
                value={shippingValues.provider}
                onChange={(event) => updateShippingValue('provider', event.target.value)}
                disabled={isLoading}
                placeholder="GHN"
              />
            </label>
            <label>
              <span>Mã vận đơn</span>
              <input
                value={shippingValues.trackingCode}
                onChange={(event) => updateShippingValue('trackingCode', event.target.value)}
                disabled={isLoading}
                placeholder="Chưa có"
              />
            </label>
            <label>
              <span>Trạng thái vận chuyển</span>
              <input
                value={shippingValues.status}
                onChange={(event) => updateShippingValue('status', event.target.value)}
                disabled={isLoading}
                placeholder="created"
              />
            </label>
            <label>
              <span>Chi phí thực tế</span>
              <input
                type="number"
                min={0}
                step={1000}
                value={shippingValues.actualProviderCost}
                onChange={(event) => updateShippingValue('actualProviderCost', event.target.value)}
                disabled={isLoading}
                placeholder="Không bắt buộc"
              />
            </label>
            <label className="is-wide">
              <span>URL nhãn vận chuyển</span>
              <input
                value={shippingValues.labelUrl}
                onChange={(event) => updateShippingValue('labelUrl', event.target.value)}
                disabled={isLoading}
                placeholder="Không bắt buộc"
              />
            </label>
            <label className="is-wide">
              <span>Lý do cập nhật</span>
              <textarea
                value={shippingValues.reason}
                onChange={(event) => updateShippingValue('reason', event.target.value)}
                disabled={isLoading}
                rows={3}
                required
              />
            </label>
          </div>
        ) : action.type === 'cancel-ghn' || (action.type === 'status' && action.nextStatus === 'delivered') ? (
          <div className={`admin-order-action-warning${isDanger ? ' is-danger' : ''}`}>
            <strong>{submitLabel}</strong>
            <span>Vui lòng kiểm tra đúng đơn trước khi xác nhận thao tác này.</span>
          </div>
        ) : (
          <label className="admin-order-action-reason">
            <span>
              {action.type === 'return-review' && action.decision === 'approved'
                ? 'Ghi chú xử lý'
                : 'Lý do thao tác'}
            </span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={isLoading}
              rows={4}
              required={
                action.type !== 'return-review' ||
                action.decision === 'rejected'
              }
            />
          </label>
        )}

        {errorMessage ? (
          <p className="admin-notice is-error" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <footer>
          <button className="admin-secondary-button" type="button" disabled={isLoading} onClick={onClose}>
            Giữ lại
          </button>
          <button className={submitClassName} type="submit" disabled={isLoading}>
            {isLoading ? 'Đang xử lý...' : submitLabel}
          </button>
        </footer>
      </form>
    </div>
  )
}
