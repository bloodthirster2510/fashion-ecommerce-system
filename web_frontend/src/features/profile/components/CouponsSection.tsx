import { useEffect, useState } from 'react'
import { Alert, Button, Empty, Skeleton } from 'antd'
import { GiftOutlined } from '@ant-design/icons'
import { formatPrice } from '../../../utils/formatPrice'
import { cartService } from '../../cart/cart.service'
import { profileService, type AvailableCouponItem } from '../profile.service'
import { formatCouponValue, formatDisplayDate } from '../profile.utils'

export function CouponsSection() {
  const [coupons, setCoupons] = useState<AvailableCouponItem[]>([])
  const [isLoadingCoupons, setIsLoadingCoupons] = useState(false)
  const [couponsError, setCouponsError] = useState('')

  useEffect(() => {
    let isMounted = true
    setIsLoadingCoupons(true)
    setCouponsError('')

    const loadCoupons = async () => {
      const cartItemIds = await cartService.getCart()
        .then((cart) => {
          const availableItems = cart.product_list.filter((item) => item.isAvailable)
          const selectedItems = availableItems.filter((item) => item.isSelected)
          return (selectedItems.length ? selectedItems : availableItems).map((item) => item._id)
        })
        .catch(() => [])

      const result = await profileService.getAvailableCoupons({
        cartItemIds,
        paymentMethod: 'COD',
        page: 1,
        limit: 20,
      })

      if (isMounted) setCoupons(result.items)
    }

    loadCoupons()
      .catch((loadError: unknown) => {
        if (!isMounted) return
        setCouponsError(loadError instanceof Error ? loadError.message : 'Không thể tải danh sách voucher.')
      })
      .finally(() => {
        if (isMounted) setIsLoadingCoupons(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <section className="account-coupons" aria-labelledby="account-coupons-title">
      <h1 id="account-coupons-title">Voucher của bạn</h1>

      {couponsError && <Alert type="error" message={couponsError} showIcon />}

      <Skeleton active loading={isLoadingCoupons} paragraph={{ rows: 8 }}>
        {!coupons.length && !couponsError ? (
          <Empty description="Hiện chưa có voucher khả dụng." />
        ) : (
          <div className="account-coupon-list">
            {coupons.map(({ coupon, isApplicable, reason }) => (
              <article className={`account-coupon-card${isApplicable === false ? ' is-disabled' : ''}`} key={coupon._id}>
                <div className="account-coupon-main">
                  <h2><GiftOutlined /> {coupon.code}</h2>
                  <strong>{formatCouponValue(coupon)}</strong>
                  <span>Đơn tối thiểu: {formatPrice(coupon.minOrderAmount)}</span>
                  <span>HSD: {formatDisplayDate(coupon.endAt)}</span>
                  {isApplicable === false && reason && <em>{reason}</em>}
                </div>
                <Button
                  type="primary"
                  disabled={isApplicable === false}
                  onClick={() => window.location.assign(`/cart?coupon=${encodeURIComponent(coupon.code)}`)}
                >
                  Sử dụng
                </Button>
              </article>
            ))}
          </div>
        )}
      </Skeleton>
    </section>
  )
}
