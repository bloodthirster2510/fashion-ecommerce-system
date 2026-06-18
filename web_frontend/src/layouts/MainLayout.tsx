import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Button, Carousel, Input } from 'antd'
import { DownOutlined, HeartOutlined, SearchOutlined, ShoppingCartOutlined } from '@ant-design/icons'
import heroImage from '../assets/images/hero.png'
import { catalogService } from '../features/catalog/catalog.service'
import type { CatalogCategory, CategoryGender } from '../features/catalog/catalog.types'
import { LoginButton } from '../features/auth/components/LoginButton'

type MainLayoutProps = {
  children: ReactNode
  showSlider?: boolean
}

type ApparelGender = Exclude<CategoryGender, 'unisex'>

type NavLink =
  | {
      label: string
      href: string
      gender?: undefined
    }
  | {
      label: string
      href: string
      gender: ApparelGender
    }

const navLinks = [
  { label: 'Giới thiệu', href: '/' },
  { label: 'Thời trang nam', href: '/products?gender=male', gender: 'male' },
  { label: 'Thời trang nữ', href: '/products?gender=female', gender: 'female' },
] satisfies NavLink[]
const supportLinks = [
  'Hướng dẫn đặt hàng',
  'Giao hàng',
  'Chính sách trả hàng hoàn tiền',
  'Chính sách bảo mật',
  'Liên hệ với chúng tôi',
]
const shopContact = {
  phone: import.meta.env.VITE_SHOP_PHONE?.trim() || 'Đang cập nhật',
  email: import.meta.env.VITE_SHOP_EMAIL?.trim() || 'Đang cập nhật',
  hours: import.meta.env.VITE_SHOP_HOURS?.trim() || 'Đang cập nhật',
}
const slides = [
  {
    id: 'summer',
    image: heroImage,
    label: 'Bộ sưu tập mới',
    description: 'Slider tự động chuyển với hiệu ứng fade.',
  },
  {
    id: 'daily',
    image: heroImage,
    label: 'Phong cách hằng ngày',
    description: 'Khung sẵn sàng thay banner thật khi có asset.',
  },
  {
    id: 'sale',
    image: heroImage,
    label: 'Ưu đãi trong tuần',
    description: 'Dùng Ant Design Carousel cho animation.',
  },
]

type CategoryMenuGroup = {
  parent: CatalogCategory
  children: CatalogCategory[]
}

// Mongoose có thể trả ObjectId đã populate thành object hoặc chỉ là string.
// Chuẩn hóa về string giúp logic nhóm cha/con không phụ thuộc shape response.
const getCategoryId = (category?: Pick<CatalogCategory, '_id'> | string | null) => {
  if (!category) return null
  return typeof category === 'string' ? category : category._id
}

const getCategoryHref = (category: CatalogCategory) => `/products?categoryId=${category._id}`

const buildCategoryMenu = (categories: CatalogCategory[], gender: ApparelGender) => {
  //Lọc theo giới tính, unisex dùng chung cho cả menu nam và nữ.
  const scopedCategories = categories.filter((category) => category.gender === gender || category.gender === 'unisex')
  const childrenByParentId = new Map<string, CatalogCategory[]>()


  const rootIds = new Set(
    scopedCategories
      .filter((category) => !getCategoryId(category.parent_id))
      .map((category) => category._id),
  )

  scopedCategories.forEach((category) => {
    const parentId = getCategoryId(category.parent_id)

    if (!parentId) return

    const children = childrenByParentId.get(parentId) ?? []
    children.push(category)
    childrenByParentId.set(parentId, children)
  })

  // Ưu tiên dùng con trực tiếp của root làm cột. Nếu database chưa có root,
  // fallback về các danh mục không có parent để menu vẫn hiển thị được.
  const directRootChildren = scopedCategories.filter((category) => {
    const parentId = getCategoryId(category.parent_id)
    return parentId ? rootIds.has(parentId) : false
  })
  const groupParents = directRootChildren.length > 0
    ? directRootChildren
    : scopedCategories.filter((category) => !getCategoryId(category.parent_id))

  return groupParents
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, 'vi'))
    .map((parent): CategoryMenuGroup => {
      const children = childrenByParentId.get(parent._id) ?? []

      return {
        parent,
        children: children.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, 'vi')),
      }
    })
}

function Header() {
  const [categories, setCategories] = useState<CatalogCategory[]>([])
  const [isLoadingCategories, setIsLoadingCategories] = useState(true)
  const [categoryError, setCategoryError] = useState('')

  useEffect(() => {
    let isMounted = true

    // Header dùng chung toàn app nên fetch danh mục một lần khi mount.
    // Guard isMounted tránh setState sau khi layout bị unmount trong lúc request còn chạy.
    catalogService
      .getActiveCategories()
      .then((items) => {
        if (!isMounted) return
        setCategories(items)
        setCategoryError('')
      })
      .catch((error: unknown) => {
        if (!isMounted) return
        setCategoryError(error instanceof Error ? error.message : 'Không thể tải danh mục.')
      })
      .finally(() => {
        if (!isMounted) return
        setIsLoadingCategories(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  // Dữ liệu API giữ dạng flat list; memo hóa việc dựng menu để không tính lại
  // mỗi lần Header render vì login/search/action thay đổi.
  const menusByGender = useMemo(
    () => ({
      male: buildCategoryMenu(categories, 'male'),
      female: buildCategoryMenu(categories, 'female'),
    }),
    [categories],
  )

  return (
    <header className="site-header">
      <div className="header-main">
        <a className="brand" href="/" aria-label="Trang chủ Fashionista">
          FASHIONISTA
        </a>

        <Input.Search
          className="search"
          placeholder="Bạn tìm gì hôm nay?"
          aria-label="Tìm kiếm sản phẩm"
          enterButton={<SearchOutlined />}
        />

        <nav className="header-actions" aria-label="Liên kết nhanh">
          <Button className="client-action-button client-action-button--favorite" type="text">
            <span>Yêu thích</span>
            <span className="client-action-icon">
              <HeartOutlined />
            </span>
          </Button>
          <Button className="client-action-button client-action-button--cart" type="text">
            <span>Giỏ hàng</span>
            <span className="client-action-icon">
              <ShoppingCartOutlined />
            </span>
          </Button>
          <LoginButton />
        </nav>
      </div>

      <nav className="category-nav" aria-label="Danh mục">
        {navLinks.map((link) => (
          <div className="category-nav-item" key={link.label}>
            <a className="category-nav-link" href={link.href}>
              {link.label}
              {link.gender && <DownOutlined className="category-nav-icon" aria-hidden="true" />}
            </a>

            {link.gender && (
              <div className="category-popout" aria-label={`Danh mục ${link.label}`}>
                {isLoadingCategories && <p className="category-popout-status">Đang tải danh mục...</p>}
                {!isLoadingCategories && categoryError && <p className="category-popout-status">{categoryError}</p>}
                {!isLoadingCategories && !categoryError && menusByGender[link.gender].length === 0 && (
                  <p className="category-popout-status">Chưa có danh mục phù hợp.</p>
                )}
                {!isLoadingCategories && !categoryError && menusByGender[link.gender].length > 0 && (
                  <div className="category-popout-grid">
                    {menusByGender[link.gender].map((group) => (
                      <section className="category-popout-group" key={group.parent._id}>
                        <h2>
                          <a href={getCategoryHref(group.parent)}>{group.parent.name}</a>
                        </h2>
                        <ul>
                          {group.children.map((item) => (
                            <li key={item._id}>
                              <a href={getCategoryHref(item)}>{item.name}</a>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </nav>
    </header>
  )
}

function Slider() {
  return (
    <section className="slider" aria-label="Nội dung nổi bật">
      <Carousel autoplay autoplaySpeed={3200} effect="fade" dots>
        {slides.map((slide) => (
          <div key={slide.id}>
            <article className="slide">
              <img src={slide.image} alt="" />
              <div className="slide-copy">
                <span>{slide.label}</span>
                <p>{slide.description}</p>
              </div>
            </article>
          </div>
        ))}
      </Carousel>
    </section>
  )
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <section>
          <h2>Giới thiệu</h2>
          <p>Cửa hàng thời trang</p>
          <p>SDT: {shopContact.phone}</p>
          <p>Email: {shopContact.email}</p>
          <p>Giờ mở cửa: {shopContact.hours}</p>
        </section>

        <section>
          <h2>Hỗ trợ</h2>
          <ul>
            {supportLinks.map((link) => (
              <li key={link}>
                <a href="/">{link}</a>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2>Cộng đồng</h2>
          <div className="social-list" aria-label="Mạng xã hội">
            <a href="/" aria-label="Facebook">f</a>
            <a href="/" aria-label="Instagram">ig</a>
            <a href="/" aria-label="TikTok">tt</a>
            <a href="/" aria-label="YouTube">yt</a>
          </div>

          <h2 className="payment-heading">Thanh toán</h2>
          <div className="payment-list" aria-label="Phương thức thanh toán">
            <span>CC</span>
            <span>QR</span>
          </div>
        </section>
      </div>
    </footer>
  )
}

export function MainLayout({ children, showSlider = true }: MainLayoutProps) {
  return (
    <div className="site-frame">
      <Header />
      {showSlider && <Slider />}
      {children}
      <Footer />
    </div>
  )
}
