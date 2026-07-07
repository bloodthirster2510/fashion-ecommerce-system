import type { RefObject } from 'react'
import type { AdminCoupon } from '../promotion.types'

type CouponDeleteDialogProps = {
  dialogRef: RefObject<HTMLDivElement | null>
  coupon: AdminCoupon
  usageCount: number
  actionLoading: boolean
  onClose: () => void
  onDelete: () => void | Promise<void>
}

type CouponBulkDeleteDialogProps = {
  dialogRef: RefObject<HTMLDivElement | null>
  coupons: AdminCoupon[]
  actionLoading: boolean
  onClose: () => void
  onDelete: () => void | Promise<void>
}

export function CouponDeleteDialog({
  dialogRef,
  coupon,
  usageCount,
  actionLoading,
  onClose,
  onDelete,
}: CouponDeleteDialogProps) {
  const lockedUsageCount = Math.max(usageCount, coupon.usedCount)
  const canDelete = lockedUsageCount === 0

  return (
    <div ref={dialogRef} tabIndex={-1} className="admin-confirm-layer" role="dialog" aria-modal="true" aria-labelledby="admin-coupon-delete-title">
      <div className="admin-confirm-box">
        <h2 id="admin-coupon-delete-title">Xóa voucher?</h2>
        <p>
          {canDelete
            ? `Voucher ${coupon.code} chưa có lịch sử sử dụng và có thể được xóa.`
            : `Voucher ${coupon.code} đã ghi nhận ${lockedUsageCount} lượt dùng hoặc giữ chỗ nên không thể xóa. Hãy tắt voucher để giữ dữ liệu đối soát.`}
        </p>
        <div className="admin-dialog-actions">
          <button className="admin-secondary-button" type="button" disabled={actionLoading} onClick={onClose}>
            Hủy
          </button>
          <button
            className="admin-danger-button"
            type="button"
            disabled={actionLoading || !canDelete}
            onClick={() => void onDelete()}
          >
            {actionLoading ? 'Đang xử lý...' : canDelete ? 'Xóa voucher' : 'Không thể xóa'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function CouponBulkDeleteDialog({
  dialogRef,
  coupons,
  actionLoading,
  onClose,
  onDelete,
}: CouponBulkDeleteDialogProps) {
  return (
    <div ref={dialogRef} tabIndex={-1} className="admin-confirm-layer" role="dialog" aria-modal="true" aria-labelledby="admin-coupon-bulk-delete-title">
      <div className="admin-confirm-box">
        <h2 id="admin-coupon-bulk-delete-title">Xóa nhiều voucher?</h2>
        <p>Đã chọn {coupons.length} voucher. Voucher có lịch sử sử dụng sẽ được giữ lại để bảo toàn dữ liệu đối soát.</p>
        <div className="admin-dialog-actions">
          <button className="admin-secondary-button" type="button" disabled={actionLoading} onClick={onClose}>Hủy</button>
          <button className="admin-danger-button" type="button" disabled={actionLoading} onClick={() => void onDelete()}>{actionLoading ? 'Đang xử lý...' : 'Xóa voucher hợp lệ'}</button>
        </div>
      </div>
    </div>
  )
}
