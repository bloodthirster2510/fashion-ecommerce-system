import { Alert, Empty } from 'antd'
import { ChevronRight, RefreshCcw, ShieldCheck, Sparkles, Star, TicketPercent, Truck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { MainLayout } from '../../../layouts/MainLayout'
import { ProductCard } from '../../../components/ProductCard'
import { formatPrice } from '../../../utils/formatPrice'
import { cartService } from '../../cart/cart.service'
import { catalogService } from '../../catalog/catalog.service'
import type { ProductListItem } from '../../catalog/catalog.types'
import { profileService, type AvailableCouponItem } from '../../profile/profile.service'
import { formatCouponValue, formatDisplayDate } from '../../profile/profile.utils'
import { HomeSlider } from '../components/HomeSlider'
import '../../catalog/catalog.css'
import './home.css'

type HomeProducts = {
  newest: ProductListItem[]
  sale: ProductListItem[]
  bestSeller: ProductListItem[]
}

const emptyProducts: HomeProducts = {
  newest: [],
  sale: [],
  bestSeller: [],
}

const serviceHighlights = [
  {
    icon: Truck,
    title: 'Giao hàng nhanh',
    description: 'Theo dõi đơn thuận tiện',
  },
  {
    icon: RefreshCcw,
    title: 'Đổi trả dễ',
    description: 'Hỗ trợ sau mua rõ ràng',
  },
  {
    icon: ShieldCheck,
    title: 'Thanh toán an toàn',
    description: 'COD và VNPay bảo mật',
  },
  {
    icon: Star,
    title: 'Sản phẩm chọn lọc',
    description: 'Ưu tiên mẫu mới, dễ phối',
  },
]

const styleStories = [
  {
    title: 'Basic mỗi ngày',
    description: 'Những món dễ mặc, dễ phối cho lịch trình bận rộn.',
    href: '/products?sort=newest',
  },
  {
    title: 'Săn deal cuối mùa',
    description: 'Các lựa chọn giảm giá tốt để làm mới tủ đồ.',
    href: '/products?isSale=true&sort=price_asc',
  },
  {
    title: 'Được yêu thích',
    description: 'Ưu tiên sản phẩm bán chạy và nhận nhiều đánh giá.',
    href: '/products?sort=best_seller',
  },
]

const loadAvailableCoupons = async () => {
  const cartItemIds = await cartService.getCart()
    .then((cart) => {
      const availableItems = cart.product_list.filter((item) => item.isAvailable)
      const selectedItems = availableItems.filter((item) => item.isSelected)
      return (selectedItems.length ? selectedItems : availableItems).map((item) => item._id)
    })
    .catch(() => [])

  return profileService.getAvailableCoupons({
    cartItemIds,
    paymentMethod: 'COD',
    page: 1,
    limit: 6,
  })
}

function SectionHeading({ eyebrow, title, href }: { eyebrow: string; title: string; href?: string }) {
  return (
    <header className="home-section-heading">
      <div>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {href && (
        <a className="home-section-link" href={href}>
          Xem tất cả
          <ChevronRight size={16} aria-hidden="true" />
        </a>
      )}
    </header>
  )
}

function CouponShowcase({ coupons, hasError }: { coupons: AvailableCouponItem[]; hasError: boolean }) {
  return (
    <section className="home-section" aria-label="Voucher">
      <SectionHeading eyebrow="Ưu đãi tài khoản" title="Voucher dành cho bạn" href="/account?section=coupons" />

      {coupons.length > 0 ? (
        <div className="home-coupon-grid">
          {coupons.slice(0, 3).map(({ coupon, isApplicable, reason, estimatedDiscountAmount, estimatedShippingDiscountAmount }) => {
            const totalEstimatedDiscount = estimatedDiscountAmount + estimatedShippingDiscountAmount
            return (
              <article className={`home-coupon-card${isApplicable === false ? ' is-disabled' : ''}`} key={coupon._id}>
                <div className="home-coupon-mark" aria-hidden="true">
                  <TicketPercent size={22} />
                </div>
                <div className="home-coupon-copy">
                  <span>{coupon.code}</span>
                  <h3>{coupon.name}</h3>
                  <strong>{formatCouponValue(coupon)}</strong>
                  <small>Đơn từ {formatPrice(coupon.minOrderAmount)} · HSD {formatDisplayDate(coupon.endAt)}</small>
                  {totalEstimatedDiscount > 0 && <em>Dự kiến giảm {formatPrice(totalEstimatedDiscount)}</em>}
                  {isApplicable === false && reason && <em>{reason}</em>}
                </div>
                <a
                  className="home-coupon-action"
                  href={`/cart?coupon=${encodeURIComponent(coupon.code)}`}
                  aria-disabled={isApplicable === false}
                >
                  Dùng ngay
                </a>
              </article>
            )
          })}
        </div>
      ) : (
        <article className="home-coupon-fallback">
          <TicketPercent size={24} aria-hidden="true" />
          <div>
            <h3>{hasError ? 'Đăng nhập để xem voucher phù hợp' : 'Voucher sẽ xuất hiện tại đây'}</h3>
            <p>Thêm sản phẩm vào giỏ để hệ thống gợi ý mã giảm giá tốt nhất cho đơn hàng.</p>
          </div>
          <a href="/products">Mua sắm ngay</a>
        </article>
      )}
    </section>
  )
}

function ProductShowcase({
  eyebrow,
  title,
  href,
  products,
}: {
  eyebrow: string
  title: string
  href: string
  products: ProductListItem[]
}) {
  if (products.length === 0) return null

  return (
    <section className="home-section" aria-label={title}>
      <SectionHeading eyebrow={eyebrow} title={title} href={href} />
      <div className="home-product-grid">
        {products.map((product) => (
          <ProductCard product={product} key={product._id} />
        ))}
      </div>
    </section>
  )
}

function HomeLoadingSkeleton() {
  return (
    <div className="home-loading-skeleton" aria-label="Đang tải nội dung trang chủ" aria-busy="true">
      {[1, 2].map((section) => (
        <section className="home-section" key={section}>
          <div className="home-skeleton-heading">
            <span />
            <strong />
          </div>
          <div className="home-product-grid">
            {Array.from({ length: 5 }, (_, index) => (
              <article className="home-skeleton-product" key={index}>
                <div className="home-skeleton-product-image" />
                <div className="home-skeleton-product-body">
                  <span />
                  <span />
                  <strong />
                  <div><i /><i /></div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}

      <section className="home-section">
        <div className="home-skeleton-heading">
          <span />
          <strong />
        </div>
        <div className="home-coupon-grid">
          {[1, 2].map((coupon) => (
            <article className="home-skeleton-coupon" key={coupon}>
              <div />
              <section><span /><strong /><i /><i /></section>
              <b />
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

export function HomePage() {
  const [products, setProducts] = useState<HomeProducts>(emptyProducts)
  const [coupons, setCoupons] = useState<AvailableCouponItem[]>([])
  const [hasCouponError, setHasCouponError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true
    const abortController = new AbortController()

    const loadHomeData = async () => {
      try {
        setIsLoading(true)
        setError('')

        const [newestResult, saleResult, bestSellerResult, couponResult] = await Promise.all([
          catalogService.getProducts({ isNew: true, sort: 'newest', page: 1, limit: 5 }, false, {
            signal: abortController.signal,
          }),
          catalogService.getProducts({ isSale: true, sort: 'price_asc', page: 1, limit: 5 }, false, {
            signal: abortController.signal,
          }),
          catalogService.getProducts({ sort: 'best_seller', page: 1, limit: 5 }, false, {
            signal: abortController.signal,
          }),
          loadAvailableCoupons()
            .then((result) => ({ items: result.items, hasError: false }))
            .catch(() => ({ items: [], hasError: true })),
        ])

        if (!isMounted) return

        setCoupons(couponResult.items)
        setHasCouponError(couponResult.hasError)
        setProducts({
          newest: newestResult.items,
          sale: saleResult.items,
          bestSeller: bestSellerResult.items,
        })
      } catch (loadError: unknown) {
        if (!isMounted || (loadError instanceof Error && loadError.name === 'AbortError')) return
        setError(loadError instanceof Error ? loadError.message : 'Không thể tải dữ liệu trang chủ.')
      } finally {
        if (isMounted && !abortController.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    void loadHomeData()

    return () => {
      isMounted = false
      abortController.abort()
    }
  }, [])

  const hasAnyProducts = products.newest.length > 0 || products.sale.length > 0 || products.bestSeller.length > 0

  return (
    <MainLayout>
      <main className="home-page">
        <HomeSlider />

        <section className="home-service-strip" aria-label="Lợi ích mua hàng">
          {serviceHighlights.map((item) => {
            const Icon = item.icon
            return (
              <article className="home-service-item" key={item.title}>
                <span aria-hidden="true">
                  <Icon size={20} />
                </span>
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.description}</small>
                </div>
              </article>
            )
          })}
        </section>

        {isLoading ? (
          <HomeLoadingSkeleton />
        ) : (
        <div>
          {error && <Alert className="home-alert" type="warning" message={error} showIcon />}

          <ProductShowcase
            eyebrow="Vừa lên kệ"
            title="Sản phẩm mới"
            href="/products?isNew=true&sort=newest"
            products={products.newest}
          />

          <CouponShowcase coupons={coupons} hasError={hasCouponError} />

          <ProductShowcase
            eyebrow="Giá tốt hôm nay"
            title="Đang giảm giá"
            href="/products?isSale=true"
            products={products.sale}
          />

          <section className="home-section" aria-label="Gợi ý phong cách">
            <SectionHeading eyebrow="Chọn theo cảm hứng" title="Gợi ý phong cách" />
            <div className="home-story-grid">
              {styleStories.map((story, index) => (
                <a className="home-story-card" href={story.href} key={story.title}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <h3>{story.title}</h3>
                  <p>{story.description}</p>
                  <i>
                    <Sparkles size={16} aria-hidden="true" />
                  </i>
                </a>
              ))}
            </div>
          </section>

          <ProductShowcase
            eyebrow="Khách hàng quan tâm"
            title="Bán chạy"
            href="/products?sort=best_seller"
            products={products.bestSeller}
          />

          {!isLoading && !error && !hasAnyProducts && (
            <Empty className="home-empty" description="Chưa có dữ liệu nổi bật để hiển thị." />
          )}
        </div>
        )}
      </main>
    </MainLayout>
  )
}
