import { Button, Input, Skeleton } from 'antd'
import { formatPrice } from '../../../utils/formatPrice'
import type { CheckoutPreview } from '../cart.types'

type Props = {
  preview: CheckoutPreview | null
  coupon: string
  loading: boolean
  placingOrder: boolean
  disabled: boolean
  onCouponChange: (value: string) => void
  onApplyCoupon: () => void
  onOrder: () => void
}

export function OrderSummary(props: Props) {
  const { preview, coupon, loading, placingOrder, disabled, onCouponChange, onApplyCoupon, onOrder } = props
  const summary = preview?.summary
  const totalDiscount = (summary?.couponDiscountAmount || 0) + (summary?.membershipDiscountAmount || 0)
  return (
    <section className="order-summary">
      <h2>Mã giảm giá</h2>
      <div className="coupon-row">
        <Input value={coupon} placeholder="Nhập mã voucher của bạn" onChange={(event) => onCouponChange(event.target.value.toUpperCase())} onPressEnter={onApplyCoupon} />
        <Button type="primary" loading={loading} onClick={onApplyCoupon}>Áp dụng</Button>
      </div>
      {preview?.coupon && <div className="applied-coupon"><b>{preview.coupon.code}</b><span>{preview.coupon.name}</span></div>}
      {preview?.appliedMembership && (
        <div className="membership-card">
          <span className="membership-medal">{preview.appliedMembership.name.charAt(0)}</span>
          <div><b>Hạng thẻ: {preview.appliedMembership.name}</b><small>Ưu đãi thành viên hiện tại</small></div>
          <strong>-{preview.appliedMembership.discountPercent}%</strong>
        </div>
      )}
      <Skeleton active loading={loading && !preview} paragraph={{ rows: 4 }}>
        <div className="summary-lines">
          <p><span>Tạm tính</span><b>{formatPrice(summary?.subTotal || 0)}</b></p>
          <p><span>Phí giao hàng</span><b>{summary && summary.shippingFee - summary.shippingDiscountAmount === 0 ? 'Miễn phí' : formatPrice((summary?.shippingFee || 0) - (summary?.shippingDiscountAmount || 0))}</b></p>
          {totalDiscount > 0 && <p className="discount"><span>Tổng ưu đãi</span><b>-{formatPrice(totalDiscount)}</b></p>}
          <p className="summary-total"><span>Tổng</span><b>{formatPrice(summary?.totalAmount || 0)}</b></p>
        </div>
      </Skeleton>
      <Button className="place-order-button" type="primary" size="large" block disabled={disabled || loading} loading={placingOrder} onClick={onOrder}>Đặt hàng</Button>
    </section>
  )
}
