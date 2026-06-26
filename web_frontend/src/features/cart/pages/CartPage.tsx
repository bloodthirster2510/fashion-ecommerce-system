import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Button, Checkbox, Empty, message, Radio, Spin } from 'antd'
import { SafetyCertificateOutlined, ShoppingCartOutlined, WalletOutlined } from '@ant-design/icons'
import { MainLayout } from '../../../layouts/MainLayout'
import { useAppDispatch, useAppSelector } from '../../../app/hooks'
import { profileService, type UserAddress } from '../../profile/profile.service'
import { CartItemCard } from '../components/CartItemCard'
import { CheckoutInformation } from '../components/CheckoutInformation'
import { OrderSummary } from '../components/OrderSummary'
import { cartService } from '../cart.service'
import type { CheckoutPreview, PaymentMethod } from '../cart.types'
import { changeCartQuantity, fetchCart, removeCartItem, toggleAllCartItems, toggleCartItem } from '../cart.slice'
import '../cart.css'

export function CartPage() {
  const dispatch = useAppDispatch()
  const { data: cart, isLoading, pendingItemIds, error } = useAppSelector((state) => state.cart)
  const currentUser = useAppSelector((state) => state.auth.currentUser)
  const [addresses, setAddresses] = useState<UserAddress[]>([])
  const [addressId, setAddressId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('COD')
  const [note, setNote] = useState('')
  const [couponInput, setCouponInput] = useState(() => new URLSearchParams(window.location.search).get('coupon')?.trim().toUpperCase() || '')
  const [appliedCoupon, setAppliedCoupon] = useState(() => new URLSearchParams(window.location.search).get('coupon')?.trim().toUpperCase() || '')
  const [preview, setPreview] = useState<CheckoutPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [placingOrder, setPlacingOrder] = useState(false)
  const previewRequest = useRef(0)
  const selectedItems = useMemo(() => cart?.product_list.filter((item) => item.isSelected && item.isAvailable) ?? [], [cart])
  const selectedIds = useMemo(() => selectedItems.map((item) => item._id), [selectedItems])
  const allSelected = Boolean(cart?.product_list.length && cart.product_list.every((item) => !item.isAvailable || item.isSelected))

  useEffect(() => { void dispatch(fetchCart()) }, [dispatch])
  useEffect(() => {
    profileService.getAddresses().then((items) => {
      setAddresses(items)
      const preferred = items.find((item) => item.isDefault) ?? items[0]
      setAddressId(preferred?._id ?? '')
    }).catch((loadError) => message.error(loadError instanceof Error ? loadError.message : 'Không thể tải địa chỉ.'))
  }, [])

  useEffect(() => {
    if (!selectedIds.length || !addressId) {
      setPreview(null)
      return
    }
    const requestId = ++previewRequest.current
    setPreviewLoading(true)
    cartService.preview({ cartItemIds: selectedIds, addressId, paymentMethod, couponCode: appliedCoupon || undefined })
      .then((data) => { if (requestId === previewRequest.current) setPreview(data) })
      .catch((previewError) => {
        if (requestId !== previewRequest.current) return
        setPreview(null)
        message.error(previewError instanceof Error ? previewError.message : 'Không thể tính tổng đơn hàng.')
      })
      .finally(() => { if (requestId === previewRequest.current) setPreviewLoading(false) })
  }, [addressId, appliedCoupon, paymentMethod, selectedIds])

  useEffect(() => { if (error) message.error(error) }, [error])

  const applyCoupon = () => {
    const normalized = couponInput.trim().toUpperCase()
    if (!normalized) { setAppliedCoupon(''); return }
    setAppliedCoupon(normalized)
  }

  const placeOrder = async () => {
    if (!preview || !addressId || !selectedIds.length) return
    setPlacingOrder(true)
    try {
      const order = await cartService.createOrder({
        cartItemIds: selectedIds,
        addressId,
        paymentMethod,
        couponCode: appliedCoupon || undefined,
        quoteVersion: preview.quoteVersion,
        orderNote: note || undefined,
      })
      if (paymentMethod === 'VNPAY') {
        const payment = await cartService.createVNPayUrl(order._id)
        window.location.assign(payment.paymentUrl)
        return
      }
      message.success(`Đặt hàng thành công. Mã đơn: ${order.orderCode}`)
      await dispatch(fetchCart())
      window.location.assign(`/orders/${order._id}`)
    } catch (orderError) {
      message.error(orderError instanceof Error ? orderError.message : 'Không thể đặt hàng.')
    } finally {
      setPlacingOrder(false)
    }
  }

  return (
    <MainLayout>
      <main className="cart-page">
        <nav className="cart-breadcrumb"><a href="/">Trang chủ</a><span>/</span><span>Giỏ hàng</span></nav>
        {error && <Alert type="error" showIcon message={error} />}
        <div className="cart-layout">
          <div className="checkout-column">
            <CheckoutInformation user={currentUser} addresses={addresses} addressId={addressId} note={note} onAddressChange={setAddressId} onNoteChange={setNote} />
            <section className="payment-section">
              <h2>Hình thức thanh toán</h2>
              <Radio.Group value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                <Radio value="COD"><span className="payment-icon cod">COD</span><span><b>Thanh toán khi giao hàng (COD)</b><small>Được kiểm tra hàng trước khi nhận.</small></span></Radio>
                <Radio value="VNPAY"><span className="payment-icon vnpay"><WalletOutlined /></span><span><b>Ví điện tử VNPay</b><small>Thanh toán an toàn qua cổng VNPay.</small></span></Radio>
              </Radio.Group>
              <p className="checkout-security"><SafetyCertificateOutlined /> Thông tin thanh toán của bạn được bảo mật.</p>
            </section>
          </div>

          <div className="cart-column">
            <header className="cart-title-row">
              <h1><ShoppingCartOutlined /> Giỏ hàng</h1>
              <span>{cart?.summary.itemCount || 0} sản phẩm</span>
            </header>
            {!!cart?.product_list.length && (
              <div className="select-all-row">
                <Checkbox checked={allSelected} onChange={(event) => void dispatch(toggleAllCartItems(event.target.checked))}>Chọn tất cả</Checkbox>
                <Button type="link" href="/products">Tiếp tục mua sắm</Button>
              </div>
            )}
            <Spin spinning={isLoading}>
              {!isLoading && !cart?.product_list.length ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Giỏ hàng của bạn đang trống"><Button type="primary" href="/products">Khám phá sản phẩm</Button></Empty>
              ) : (
                <div className="cart-items">
                  {cart?.product_list.map((item) => (
                    <CartItemCard key={item._id} item={item} pending={pendingItemIds.includes(item._id)}
                      onSelect={(isSelected) => void dispatch(toggleCartItem({ itemId: item._id, isSelected }))}
                      onQuantityChange={(quantity) => void dispatch(changeCartQuantity({ itemId: item._id, quantity }))}
                      onRemove={() => void dispatch(removeCartItem(item._id))} />
                  ))}
                </div>
              )}
            </Spin>
            {!!cart?.product_list.length && (
              <OrderSummary preview={preview} coupon={couponInput} loading={previewLoading} placingOrder={placingOrder}
                disabled={!selectedIds.length || !addressId || !preview} onCouponChange={setCouponInput}
                onApplyCoupon={applyCoupon} onOrder={() => void placeOrder()} />
            )}
          </div>
        </div>
      </main>
    </MainLayout>
  )
}
