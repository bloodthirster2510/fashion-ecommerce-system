import { useState } from 'react'
import {
  Button,
  DataTable,
  EmptyState,
  StatusBadge,
  type DataTableColumn,
} from '../../../components/ui'
import type { AdminCoupon } from '../promotion.types'

type CouponDisplayStatus = 'active' | 'inactive' | 'expired' | 'upcoming'

type CouponTablePanelProps = {
  coupons: AdminCoupon[]
  selectedCouponIds: string[]
  isLoading: boolean
  actionLoading: boolean
  canManagePromotions: boolean
  errorMessage: string | null
  displayStatusMeta: Record<CouponDisplayStatus, { label: string; className: string }>
  displayStatusTone: Record<CouponDisplayStatus, 'success' | 'neutral' | 'danger' | 'warning'>
  formatCurrency: (value: number) => string
  formatDateTime: (value: string) => string
  getCouponStatus: (coupon: AdminCoupon) => CouponDisplayStatus
  getDiscountText: (coupon: AdminCoupon) => string
  getAudienceText: (coupon: AdminCoupon) => string
  getScopeText: (coupon: AdminCoupon) => string
  onRetry: () => void
  onToggleAll: () => void
  onToggleCouponSelection: (couponId: string) => void
  onOpenDetail: (coupon: AdminCoupon) => void | Promise<void>
  onOpenEdit: (coupon: AdminCoupon) => void
  onOpenDuplicate: (coupon: AdminCoupon) => void
  onStatusChange: (coupon: AdminCoupon, isActive: boolean) => void | Promise<void>
  onOpenDelete: (coupon: AdminCoupon) => void | Promise<void>
}

export function CouponTablePanel({
  coupons,
  selectedCouponIds,
  isLoading,
  actionLoading,
  canManagePromotions,
  errorMessage,
  displayStatusMeta,
  displayStatusTone,
  formatCurrency,
  formatDateTime,
  getCouponStatus,
  getDiscountText,
  getAudienceText,
  getScopeText,
  onRetry,
  onToggleAll,
  onToggleCouponSelection,
  onOpenDetail,
  onOpenEdit,
  onOpenDuplicate,
  onStatusChange,
  onOpenDelete,
}: CouponTablePanelProps) {
  const [openCouponId, setOpenCouponId] = useState<string | null>(null)

  const couponColumns: Array<DataTableColumn<AdminCoupon>> = [
    {
      key: 'select',
      header: (
        <input
          type="checkbox"
          aria-label="Chọn tất cả voucher trên trang"
          aria-checked={selectedCouponIds.length > 0 && selectedCouponIds.length < coupons.length ? 'mixed' : undefined}
          checked={coupons.length > 0 && selectedCouponIds.length === coupons.length}
          onChange={onToggleAll}
        />
      ),
      render: (coupon) => (
        <input
          type="checkbox"
          aria-label={`Chọn voucher ${coupon.code}`}
          checked={selectedCouponIds.includes(coupon._id)}
          onChange={() => onToggleCouponSelection(coupon._id)}
          onClick={(event) => event.stopPropagation()}
        />
      ),
    },
    {
      key: 'voucher',
      header: 'Voucher',
      render: (coupon) => (
        <div className="admin-promotion-code-cell">
          <strong>{coupon.code}</strong>
          <span>{coupon.name}</span>
        </div>
      ),
    },
    {
      key: 'discount',
      header: 'Giá trị',
      render: (coupon) => (
        <div className="admin-promotion-stack-cell">
          <strong>{getDiscountText(coupon)}</strong>
          <span>Đơn từ {formatCurrency(coupon.minOrderAmount)}</span>
        </div>
      ),
    },
    {
      key: 'conditions',
      header: 'Điều kiện',
      render: (coupon) => (
        <div className="admin-promotion-stack-cell" title={`${getAudienceText(coupon)} · ${getScopeText(coupon)}`}>
          <strong>{getAudienceText(coupon)}</strong>
          <span>{getScopeText(coupon)}</span>
        </div>
      ),
    },
    {
      key: 'time',
      header: 'Hiệu lực',
      render: (coupon) => {
        const remainingCount = coupon.usageLimit == null
          ? null
          : Math.max(0, coupon.usageLimit - coupon.usedCount)
        const remainingUsage = remainingCount == null
          ? 'Không giới hạn'
          : remainingCount === 0
            ? `Hết lượt (0 / ${coupon.usageLimit})`
            : `${remainingCount} / ${coupon.usageLimit}`

        return (
          <div className="admin-promotion-stack-cell">
            <strong>{formatDateTime(coupon.startAt)}</strong>
            <span>Đến {formatDateTime(coupon.endAt)}</span>
            <span>{remainingCount === 0 ? remainingUsage : `Còn lượt: ${remainingUsage}`}</span>
          </div>
        )
      },
    },
    {
      key: 'visibility',
      header: 'Hiển thị',
      render: (coupon) => (
        <StatusBadge tone={coupon.isPublic ? 'info' : 'neutral'}>
          {coupon.isPublic ? 'Công khai' : 'Riêng tư'}
        </StatusBadge>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (coupon) => {
        const status = getCouponStatus(coupon)
        return (
          <StatusBadge tone={displayStatusTone[status]}>
            {displayStatusMeta[status].label}
          </StatusBadge>
        )
      },
    },
    {
      key: 'actions',
      header: 'Thao tác',
      render: (coupon) => {
        const status = getCouponStatus(coupon)
        const canToggleCouponStatus = status === 'active' || status === 'inactive'

        return (
          <div className="admin-row-actions" onClick={(event) => event.stopPropagation()}>
            <Button className="admin-promotion-view-button" variant="secondary" disabled={actionLoading} onClick={() => void onOpenDetail(coupon)}>
              Xem
            </Button>
            <details
              className="admin-action-menu"
              open={openCouponId === coupon._id}
              onToggle={(event) => {
                const isOpen = event.currentTarget.open
                setOpenCouponId((currentId) => {
                  if (isOpen) return coupon._id
                  return currentId === coupon._id ? null : currentId
                })
              }}
            >
              <summary aria-label={`Thao tác với ${coupon.code}`}>•••</summary>
              <div>
                <button type="button" disabled={!canManagePromotions || actionLoading} onClick={() => { setOpenCouponId(null); onOpenEdit(coupon) }}>Sửa</button>
                <button type="button" disabled={!canManagePromotions || actionLoading} onClick={() => { setOpenCouponId(null); onOpenDuplicate(coupon) }}>Nhân bản</button>
                <button
                  type="button"
                  disabled={!canManagePromotions || actionLoading || !canToggleCouponStatus}
                  title={canToggleCouponStatus ? undefined : 'Không thể đổi trạng thái voucher chưa bắt đầu hoặc đã hết hạn'}
                  onClick={() => { setOpenCouponId(null); void onStatusChange(coupon, !coupon.isActive) }}
                >
                  {coupon.isActive ? 'Tắt' : 'Bật'}
                </button>
                <button className="is-danger" type="button" disabled={!canManagePromotions || actionLoading} onClick={() => { setOpenCouponId(null); void onOpenDelete(coupon) }}>Xóa</button>
              </div>
            </details>
          </div>
        )
      },
    },
  ]

  if (errorMessage) {
    return (
      <EmptyState
        title="Không tải được voucher"
        description={errorMessage}
        role="alert"
        action={(
          <Button variant="secondary" onClick={onRetry}>
            Thử lại
          </Button>
        )}
      />
    )
  }

  return (
    <div className={`admin-promotions-table-shell${isLoading && coupons.length ? ' is-refreshing' : ''}`}>
      <DataTable
        columns={couponColumns}
        items={coupons}
        getRowKey={(coupon) => coupon._id}
        isLoading={isLoading}
        emptyText="Không có voucher phù hợp."
        onRowClick={(coupon) => void onOpenDetail(coupon)}
      />
      {isLoading && coupons.length ? <div className="admin-table-refresh-indicator" role="status">Đang cập nhật dữ liệu...</div> : null}
    </div>
  )
}
