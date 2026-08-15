import { Button, Input, Skeleton } from 'antd'
import { formatPrice } from '../../../utils/formatPrice'
import type { CheckoutPreview } from '../cart.types'

type Props = {
  preview: CheckoutPreview | null
  fallbackSubTotal: number
  coupon: string
  loading: boolean
  placingOrder: boolean
  disabled: boolean
  onCouponChange: (value: string) => void
  onApplyCoupon: () => void
  onOrder: () => void
}

export function OrderSummary(props: Props) {
  const { preview, fallbackSubTotal, coupon, loading, placingOrder, disabled, onCouponChange, onApplyCoupon, onOrder } = props
  const summary = preview?.summary
  const totalDiscount = (summary?.couponDiscountAmount || 0) + (summary?.membershipDiscountAmount || 0)
  const subTotal = summary?.subTotal ?? fallbackSubTotal
  const shippingAmount = Math.max(0, (summary?.shippingFee || 0) - (summary?.shippingDiscountAmount || 0))
  const totalAmount = summary?.totalAmount ?? fallbackSubTotal

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
          <p><span>Tạm tính</span><b>{formatPrice(subTotal)}</b></p>
          <p><span>Phí giao hàng</span><b>{summary && shippingAmount === 0 ? 'Miễn phí' : formatPrice(shippingAmount)}</b></p>
          {totalDiscount > 0 && <p className="discount"><span>Tổng ưu đãi</span><b>-{formatPrice(totalDiscount)}</b></p>}
          <p className="summary-total"><span>Tổng</span><b>{formatPrice(totalAmount)}</b></p>
        </div>
      </Skeleton>
      <Button className="place-order-button" type="primary" size="large" block disabled={disabled || loading} loading={placingOrder} onClick={onOrder}>Đặt hàng</Button>
    </section>
  )
}
