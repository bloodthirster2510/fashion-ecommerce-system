import type { RefObject } from 'react'
import type { AdminCoupon, CouponUsageItem, CouponUsageListResponse } from '../promotion.types'

type CouponDisplayStatus = 'active' | 'inactive' | 'expired' | 'upcoming'

type CouponDetailDialogProps = {
  dialogRef: RefObject<HTMLDivElement | null>
  coupon: AdminCoupon
  usage: CouponUsageListResponse
  actionLoading: boolean
  canManagePromotions: boolean
  usageSearch: string
  usageDateFrom: string
  usageDateTo: string
  displayStatusMeta: Record<CouponDisplayStatus, { label: string; className: string }>
  formatCurrency: (value: number) => string
  formatDateTime: (value: string) => string
  getCouponStatus: (coupon: AdminCoupon) => CouponDisplayStatus
  getDiscountText: (coupon: AdminCoupon) => string
  getAudienceText: (coupon: AdminCoupon) => string
  getScopeText: (coupon: AdminCoupon) => string
  getCouponActorLabel: (actor: AdminCoupon['createdBy']) => string
  getCouponUsageUser: (usage: CouponUsageItem) => string
  getCouponUsageOrder: (usage: CouponUsageItem) => string
  onUsageSearchChange: (value: string) => void
  onUsageDateFromChange: (value: string) => void
  onUsageDateToChange: (value: string) => void
  onExportUsageCsv: () => void | Promise<void>
  onLoadUsagePage: (page: number) => void | Promise<void>
  onClose: () => void
  onEdit: (coupon: AdminCoupon) => void
}

export function CouponDetailDialog({
  dialogRef,
  coupon,
  usage,
  actionLoading,
  canManagePromotions,
  usageSearch,
  usageDateFrom,
  usageDateTo,
  displayStatusMeta,
  formatCurrency,
  formatDateTime,
  getCouponStatus,
  getDiscountText,
  getAudienceText,
  getScopeText,
  getCouponActorLabel,
  getCouponUsageUser,
  getCouponUsageOrder,
  onUsageSearchChange,
  onUsageDateFromChange,
  onUsageDateToChange,
  onExportUsageCsv,
  onLoadUsagePage,
  onClose,
  onEdit,
}: CouponDetailDialogProps) {
  const status = getCouponStatus(coupon)
  const filteredUsage = usage.items

  return (
    <div ref={dialogRef} tabIndex={-1} className="admin-confirm-layer" role="dialog" aria-modal="true" aria-labelledby="admin-coupon-detail-title">
      <div className="admin-account-dialog admin-coupon-detail-dialog">
        <header className="admin-coupon-dialog-header">
          <div>
            <p>Chi tiết voucher</p>
            <h2 id="admin-coupon-detail-title">{coupon.code}</h2>
            <span>{coupon.name}</span>
          </div>
          <span className={`admin-status-pill ${displayStatusMeta[status].className}`}>
            {displayStatusMeta[status].label}
          </span>
        </header>

        <div className="admin-coupon-detail-body">
          <dl className="admin-coupon-detail-grid">
            <div><dt>Giá trị</dt><dd>{getDiscountText(coupon)}</dd></div>
            <div><dt>Đơn tối thiểu</dt><dd>{formatCurrency(coupon.minOrderAmount)}</dd></div>
            <div><dt>Đối tượng</dt><dd>{getAudienceText(coupon)}</dd></div>
            <div><dt>Phạm vi</dt><dd>{getScopeText(coupon)}</dd></div>
            <div><dt>Bắt đầu</dt><dd>{formatDateTime(coupon.startAt)}</dd></div>
            <div><dt>Kết thúc</dt><dd>{formatDateTime(coupon.endAt)}</dd></div>
            <div><dt>Giới hạn mỗi khách</dt><dd>{coupon.perUserLimit}</dd></div>
            <div><dt>Tổng lượt dùng</dt><dd>{usage.pagination.totalItems}</dd></div>
            <div><dt>Người tạo</dt><dd>{getCouponActorLabel(coupon.createdBy)}</dd></div>
            <div><dt>Người cập nhật</dt><dd>{getCouponActorLabel(coupon.updatedBy)}</dd></div>
            <div><dt>Ngày tạo</dt><dd>{coupon.createdAt ? formatDateTime(coupon.createdAt) : 'Không có dữ liệu'}</dd></div>
            <div><dt>Cập nhật gần nhất</dt><dd>{coupon.updatedAt ? formatDateTime(coupon.updatedAt) : 'Không có dữ liệu'}</dd></div>
          </dl>

          <section className="admin-coupon-usage-section">
            <div className="admin-section-heading">
              <div>
                <p>Đối soát</p>
                <h2>Lịch sử sử dụng</h2>
              </div>
              {actionLoading ? <span>Đang tải...</span> : null}
            </div>
            <div className="admin-coupon-usage-toolbar">
              <input type="search" value={usageSearch} onChange={(event) => onUsageSearchChange(event.target.value)} placeholder="Tìm khách hàng hoặc đơn hàng" />
              <input type="date" aria-label="Dùng từ ngày" value={usageDateFrom} max={usageDateTo || undefined} onChange={(event) => onUsageDateFromChange(event.target.value)} />
              <input type="date" aria-label="Dùng đến ngày" value={usageDateTo} min={usageDateFrom || undefined} onChange={(event) => onUsageDateToChange(event.target.value)} />
              <button className="admin-secondary-button" type="button" disabled={actionLoading} onClick={() => void onExportUsageCsv()}>Xuất toàn bộ CSV</button>
            </div>
            <div className="admin-coupon-usage-summary">
              <span>{usage.summary.usageCount} lượt</span>
              <span>Giảm sản phẩm {formatCurrency(usage.summary.discountAmount)}</span>
              <span>Giảm vận chuyển {formatCurrency(usage.summary.shippingDiscountAmount)}</span>
            </div>
            <div className="admin-table-scroll">
              <table className="admin-table admin-coupon-usage-table">
                <thead>
                  <tr>
                    <th>Khách hàng</th>
                    <th>Đơn hàng</th>
                    <th>Giảm sản phẩm</th>
                    <th>Giảm vận chuyển</th>
                    <th>Thời gian</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsage.length ? filteredUsage.map((item) => (
                    <tr key={item._id}>
                      <td>{getCouponUsageUser(item)}</td>
                      <td>{getCouponUsageOrder(item)}</td>
                      <td>{formatCurrency(item.discountAmount)}</td>
                      <td>{formatCurrency(item.shippingDiscountAmount)}</td>
                      <td>{formatDateTime(item.usedAt)}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5}><div className="admin-table-loading">Voucher chưa được sử dụng.</div></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <footer className="admin-dialog-actions admin-coupon-detail-actions">
          <span>
            Trang {usage.pagination.page} / {Math.max(1, usage.pagination.totalPages)}
          </span>
          <button
            className="admin-secondary-button"
            type="button"
            disabled={usage.pagination.page <= 1 || actionLoading}
            onClick={() => void onLoadUsagePage(usage.pagination.page - 1)}
          >
            Trước
          </button>
          <button
            className="admin-secondary-button"
            type="button"
            disabled={usage.pagination.page >= usage.pagination.totalPages || actionLoading}
            onClick={() => void onLoadUsagePage(usage.pagination.page + 1)}
          >
            Sau
          </button>
          <button className="admin-primary-button" type="button" disabled={actionLoading} onClick={onClose}>
            Đóng
          </button>
          <button className="admin-primary-button" type="button" disabled={!canManagePromotions || actionLoading} onClick={() => onEdit(coupon)}>
            Chỉnh sửa
          </button>
        </footer>
      </div>
    </div>
  )
}
