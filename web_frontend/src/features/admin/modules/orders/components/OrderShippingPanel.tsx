import { useEffect, useState } from 'react'
import type { AdminOrder, UpdateOrderGhnMappingPayload } from '../orderAdminApi'
import type { ShippingSimulationStatus } from '../orderTypes'
import {
  canCancelGhnShipment,
  canCreateGhnShipment,
  canSimulateShippingStatus,
  canSyncGhnShipment,
  formatCurrency,
  formatShippingProvider,
  formatShippingStatus,
  getAddressLine,
  getShippingPillClass,
  getShippingSimulationActionLabel,
  shippingSimulationActions,
} from '../orderPresentation'
import { Copy } from 'lucide-react'
import { formatAdminDate } from '../../../utils/dateTime'

type OrderShippingPanelProps = {
  canUpdateOrders: boolean
  isActionLoading: boolean
  order: AdminOrder
  onCancelGhnShipment: () => void
  onCopyReference: (value: string, label: string) => void
  onCreateGhnShipment: () => void
  onShippingUpdate: () => void
  onSimulateShippingStatus: (status: ShippingSimulationStatus) => void
  onSyncGhnShipment: () => void
  onUpdateGhnMapping: (payload: UpdateOrderGhnMappingPayload) => void
}

export function OrderShippingPanel({
  canUpdateOrders,
  isActionLoading,
  order,
  onCancelGhnShipment,
  onCopyReference,
  onCreateGhnShipment,
  onShippingUpdate,
  onSimulateShippingStatus,
  onSyncGhnShipment,
  onUpdateGhnMapping,
}: OrderShippingPanelProps) {
  const [isEditingMapping, setIsEditingMapping] = useState(false)
  const [mappingError, setMappingError] = useState('')
  const [ghnProvinceId, setGhnProvinceId] = useState('')
  const [ghnDistrictId, setGhnDistrictId] = useState('')
  const [ghnWardCode, setGhnWardCode] = useState('')
  const [confidence, setConfidence] = useState<UpdateOrderGhnMappingPayload['confidence']>('manual')
  const [mappingNote, setMappingNote] = useState('')
  const mappingReady =
    order.shippingAddress.ghnMappingStatus === 'mapped' &&
    Boolean(order.shippingAddress.ghnMappingConfidence) &&
    Boolean(order.shippingAddress.ghnMappingVerifiedAt) &&
    Boolean(order.shippingAddress.ghnMappingVerificationSource) &&
    Boolean(order.shippingAddress.ghnDistrictId) &&
    Boolean(order.shippingAddress.ghnWardCode)

  useEffect(() => {
    setGhnProvinceId(order.shippingAddress.ghnProvinceId?.toString() ?? '')
    setGhnDistrictId(order.shippingAddress.ghnDistrictId?.toString() ?? '')
    setGhnWardCode(order.shippingAddress.ghnWardCode ?? '')
    setConfidence(order.shippingAddress.ghnMappingConfidence ?? 'manual')
    setMappingNote('')
    setMappingError('')
    setIsEditingMapping(false)
  }, [
    order._id,
    order.shippingAddress.ghnDistrictId,
    order.shippingAddress.ghnMappingConfidence,
    order.shippingAddress.ghnProvinceId,
    order.shippingAddress.ghnWardCode,
  ])

  const submitMapping = () => {
    const provinceId = Number(ghnProvinceId)
    const districtId = Number(ghnDistrictId)
    const wardCode = ghnWardCode.trim()
    if (!Number.isInteger(provinceId) || provinceId <= 0 || !Number.isInteger(districtId) || districtId <= 0 || !wardCode) {
      setMappingError('Cần nhập đúng GHN ProvinceID, DistrictID và WardCode.')
      return
    }

    setMappingError('')
    onUpdateGhnMapping({
      ghnProvinceId: provinceId,
      ghnDistrictId: districtId,
      ghnWardCode: wardCode,
      confidence,
      note: mappingNote.trim() || 'Admin xác minh mapping từ hàng chờ giao hàng',
      applyToFutureAddresses: true,
    })
  }

  return (
    <section className="admin-drawer-section admin-order-section-main admin-order-section-shipping">
      <div className="admin-section-inline-heading">
        <h3>Khách hàng & giao hàng</h3>
        <button
          className="admin-link-button"
          type="button"
          disabled={!canUpdateOrders || isActionLoading}
          onClick={onShippingUpdate}
        >
          Cập nhật vận đơn
        </button>
      </div>
      <div className="admin-address-block">
        <strong>{order.shippingAddress.customerName}</strong>
        <span>{order.shippingAddress.phoneNumber}</span>
        <p>{getAddressLine(order)}</p>
      </div>
      <div className={`admin-ghn-mapping-card ${mappingReady ? 'is-ready' : 'is-warning'}`}>
        <div className="admin-ghn-mapping-heading">
          <div>
            <strong>{mappingReady ? 'Mapping GHN đã xác minh' : 'Cần xác minh mapping GHN'}</strong>
            <span>
              {mappingReady
                ? `${order.shippingAddress.ghnMappingConfidence} · ${formatAdminDate(order.shippingAddress.ghnMappingVerifiedAt)}`
                : 'Đơn đang dùng phí tạm tính; hệ thống sẽ không gọi tạo vận đơn GHN.'}
            </span>
          </div>
          <button
            className="admin-link-button"
            type="button"
            disabled={!canUpdateOrders || isActionLoading}
            onClick={() => setIsEditingMapping((current) => !current)}
          >
            {isEditingMapping ? 'Đóng' : mappingReady ? 'Sửa mapping' : 'Xử lý mapping'}
          </button>
        </div>
        <div className="admin-ghn-mapping-codes">
          <span>ProvinceID: <strong>{order.shippingAddress.ghnProvinceId ?? '—'}</strong></span>
          <span>DistrictID: <strong>{order.shippingAddress.ghnDistrictId ?? '—'}</strong></span>
          <span>WardCode: <strong>{order.shippingAddress.ghnWardCode ?? '—'}</strong></span>
        </div>
        {isEditingMapping ? (
          <div className="admin-ghn-mapping-form">
            <label>
              <span>GHN ProvinceID</span>
              <input
                type="number"
                min={1}
                value={ghnProvinceId}
                onChange={(event) => setGhnProvinceId(event.target.value)}
              />
            </label>
            <label>
              <span>GHN DistrictID</span>
              <input
                type="number"
                min={1}
                value={ghnDistrictId}
                onChange={(event) => setGhnDistrictId(event.target.value)}
              />
            </label>
            <label>
              <span>GHN WardCode</span>
              <input
                value={ghnWardCode}
                maxLength={20}
                onChange={(event) => setGhnWardCode(event.target.value)}
              />
            </label>
            <label>
              <span>Độ tin cậy</span>
              <select
                value={confidence}
                onChange={(event) => setConfidence(event.target.value as UpdateOrderGhnMappingPayload['confidence'])}
              >
                <option value="exact">Khớp chính xác</option>
                <option value="manual">Admin xác minh thủ công</option>
                <option value="legacy">Dữ liệu cũ đã đối chiếu</option>
              </select>
            </label>
            <label className="admin-ghn-mapping-note">
              <span>Ghi chú kiểm tra</span>
              <input
                value={mappingNote}
                maxLength={500}
                onChange={(event) => setMappingNote(event.target.value)}
                placeholder="Nguồn đối chiếu hoặc lý do sửa"
              />
            </label>
            {mappingError ? <p className="admin-notice is-error">{mappingError}</p> : null}
            <button
              className="admin-primary-button"
              type="button"
              disabled={!canUpdateOrders || isActionLoading}
              onClick={submitMapping}
            >
              Xác minh và áp dụng
            </button>
          </div>
        ) : null}
      </div>
      <div className="admin-detail-grid">
        <div>
          <span>Đơn vị</span>
          <strong>{formatShippingProvider(order.shipping?.provider)}</strong>
        </div>
        <div>
          <span>Mã vận đơn</span>
          <strong className="admin-code-with-copy">
            <span>{order.shipping?.trackingCode || 'Chưa có'}</span>
            {order.shipping?.trackingCode ? (
              <button
                className="admin-copy-button"
                type="button"
                onClick={() => onCopyReference(order.shipping?.trackingCode ?? '', 'mã vận đơn')}
                aria-label="Sao chép mã vận đơn"
              >
                <Copy size={14} strokeWidth={2.4} />
              </button>
            ) : null}
          </strong>
        </div>
        <div>
          <span>Phí khách trả</span>
          <strong>{formatCurrency(order.shippingFee)}</strong>
        </div>
        <div>
          <span>Chi phí thực tế</span>
          <strong>{formatCurrency(order.shipping?.actualProviderCost ?? 0)}</strong>
        </div>
      </div>
      <div className="admin-shipping-simulator">
        <div className="admin-shipping-simulator-header">
          <span>Đối tác vận chuyển</span>
          <strong className={getShippingPillClass(order.shipping?.status)}>
            {formatShippingStatus(order.shipping?.status)}
          </strong>
        </div>
        {order.shipping?.status === 'failed' ? (
          <p className="admin-shipping-failed-note">
            Đơn vị vận chuyển báo giao không thành công. Admin có thể bấm Giao lại sau khi liên hệ khách, hoặc xử lý hoàn tiền/hỗ trợ theo chính sách.
          </p>
        ) : null}
        <div className="admin-ghn-actions">
          <button
            className="admin-primary-button"
            type="button"
            disabled={!canUpdateOrders || isActionLoading || !canCreateGhnShipment(order)}
            onClick={onCreateGhnShipment}
          >
            Tạo vận đơn GHN
          </button>
          <button
            className="admin-secondary-button"
            type="button"
            disabled={!canUpdateOrders || isActionLoading || !canSyncGhnShipment(order)}
            onClick={onSyncGhnShipment}
          >
            Đồng bộ GHN
          </button>
          <button
            className="admin-danger-button"
            type="button"
            disabled={!canUpdateOrders || isActionLoading || !canCancelGhnShipment(order)}
            onClick={onCancelGhnShipment}
          >
            Hủy vận đơn GHN
          </button>
        </div>
        <div className="admin-shipping-simulator-actions">
          {shippingSimulationActions.map((action) => (
            <button
              className={action.className}
              type="button"
              key={action.status}
              disabled={!canUpdateOrders || isActionLoading || !canSimulateShippingStatus(order, action.status)}
              onClick={() => onSimulateShippingStatus(action.status)}
            >
              {getShippingSimulationActionLabel(order, action)}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
