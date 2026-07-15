import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Button, Dropdown, Input, type MenuProps } from 'antd'
import {
  ClockCircleOutlined,
  DownOutlined,
  EnvironmentOutlined,
  FacebookFilled,
  HeartOutlined,
  InstagramOutlined,
  LinkOutlined,
  MailOutlined,
  MessageOutlined,
  PhoneOutlined,
  SearchOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  TikTokOutlined,
  YoutubeFilled,
} from '@ant-design/icons'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { fetchCart } from '../features/cart/cart.slice'
import { catalogService } from '../features/catalog/catalog.service'
import type { CatalogCategory, CategoryGender } from '../features/catalog/catalog.types'
import { LoginButton } from '../features/auth/components/LoginButton'
import shopNameImage from '../assets/images/ShopName.png'
import { useStorefrontSettings } from '../features/storefront-settings/storefrontSettings.context'
import type { StorefrontSocialPlatform } from '../features/storefront-settings/storefrontSettings.types'

type MainLayoutProps = {
  children: ReactNode
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
  { label: 'Hướng dẫn đặt hàng', href: '/support?topic=orders' },
  { label: 'Chính sách giao hàng', href: '/policies/shipping' },
  { label: 'Trả hàng và hoàn tiền', href: '/policies/returns' },
  { label: 'Bảo vệ dữ liệu cá nhân', href: '/policies/privacy' },
  { label: 'Điều khoản sử dụng', href: '/policies/terms' },
  { label: 'Tiếp nhận khiếu nại', href: '/policies/complaints' },
]
const socialIconByPlatform = {
  facebook: FacebookFilled,
  instagram: InstagramOutlined,
  tiktok: TikTokOutlined,
  youtube: YoutubeFilled,
  zalo: MessageOutlined,
  other: LinkOutlined,
} satisfies Record<StorefrontSocialPlatform, typeof FacebookFilled>
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
  const dispatch = useAppDispatch()
  const { settings } = useStorefrontSettings()
  const currentUser = useAppSelector((state) => state.auth.currentUser)
  const cart = useAppSelector((state) => state.cart.data)
  const [categories, setCategories] = useState<CatalogCategory[]>([])
  const [isLoadingCategories, setIsLoadingCategories] = useState(true)
  const [categoryError, setCategoryError] = useState('')
  const [searchCategoryId, setSearchCategoryId] = useState(
    () => new URLSearchParams(window.location.search).get('categoryId') ?? '',
  )

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

  useEffect(() => {
    if (!currentUser) return

    void dispatch(fetchCart())
  }, [currentUser, dispatch])

  // Dữ liệu API giữ dạng flat list; memo hóa việc dựng menu để không tính lại
  // mỗi lần Header render vì login/search/action thay đổi.
  const menusByGender = useMemo(
    () => ({
      male: buildCategoryMenu(categories, 'male'),
      female: buildCategoryMenu(categories, 'female'),
    }),
    [categories],
  )

  const selectedSearchCategory = useMemo(
    () => categories.find((category) => category._id === searchCategoryId),
    [categories, searchCategoryId],
  )
  const cartItemCount = cart?.product_list.length ?? 0

  const searchCategoryItems = useMemo<MenuProps['items']>(() => {
    const items = [...categories]
      .sort((a, b) => a.gender.localeCompare(b.gender) || a.level - b.level || a.name.localeCompare(b.name, 'vi'))
      .map((category) => ({
        key: category._id,
        label: (
          <span className="search-category-option">
            <span className="search-category-option-name">{category.name}</span>
            <span className="search-category-option-gender">
              {category.gender === 'male' ? 'Nam' : category.gender === 'female' ? 'Nữ' : 'Unisex'}
            </span>
          </span>
        ),
      }))

    return [
      { key: 'all', label: 'Tất cả danh mục' },
      { type: 'divider' },
      ...items,
    ]
  }, [categories])

  const handleSearchCategoryClick: MenuProps['onClick'] = ({ key }) => {
    setSearchCategoryId(key === 'all' ? '' : key)
  }

  return (
    <header className="site-header">
      <div className="header-main">
        <a className="brand" href="/" aria-label={`Trang chủ ${settings.identity.name}`}>
          <img src={shopNameImage} alt={settings.identity.name} />
        </a>

        <form className="search" action="/products" method="get" role="search">
          <Dropdown
            disabled={isLoadingCategories || Boolean(categoryError)}
            menu={{
              items: searchCategoryItems,
              onClick: handleSearchCategoryClick,
              selectedKeys: [searchCategoryId || 'all'],
            }}
            overlayClassName="search-category-dropdown"
            placement="bottomLeft"
            trigger={['click']}
          >
            <Button
              className="search-category-trigger"
              type="text"
              aria-label="Chọn danh mục tìm kiếm"
              title={categoryError || undefined}
            >
              <span>{isLoadingCategories ? 'Đang tải...' : selectedSearchCategory?.name ?? 'Danh mục'}</span>
              <DownOutlined aria-hidden="true" />
            </Button>
          </Dropdown>
          <input type="hidden" name="categoryId" value={searchCategoryId} />
          <Input name="keyword" placeholder="Tìm kiếm sản phẩm..." aria-label="Tìm kiếm sản phẩm" />
          <Button className="search-submit" htmlType="submit" icon={<SearchOutlined />} aria-label="Tìm kiếm" />
        </form>

        <nav className="header-actions" aria-label="Liên kết nhanh">
          <Button className="client-action-button client-action-button--favorite" type="text" href="/account?section=favorites">
            <span>Yêu thích</span>
            <span className="client-action-icon">
              <HeartOutlined />
            </span>
          </Button>
          <Button className="client-action-button client-action-button--cart" type="text" href="/cart">
            <span>Giỏ hàng</span>
            <span className="client-action-icon">
              <ShoppingCartOutlined />
            </span>
            {currentUser && cartItemCount > 0 && (
              <span className="cart-count-badge">{cartItemCount > 99 ? '99+' : cartItemCount}</span>
            )}
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

function Footer() {
  const { settings } = useStorefrontSettings()
  const { identity, contact } = settings
  const socialLinks = settings.socials.filter((social) => social.enabled && social.url)

  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <section className="footer-about">
          <a className="footer-logo" href="/" aria-label={`Trang chủ ${identity.name}`}>
            <img src={shopNameImage} alt={identity.name} />
          </a>
          <h2>Về {identity.name}</h2>
          <p>{identity.description}</p>
        </section>

        <section className="footer-contact">
          <h2>Giới thiệu</h2>
          <p>
            <ShopOutlined aria-hidden="true" />
            <span>{identity.legalName || identity.name}</span>
          </p>
          {contact.phone ? (
            <p>
              <PhoneOutlined aria-hidden="true" />
              <a href={`tel:${contact.phone.replace(/[^0-9+]/g, '')}`}>{contact.phone}</a>
            </p>
          ) : null}
          {contact.email ? (
            <p>
              <MailOutlined aria-hidden="true" />
              <a href={`mailto:${contact.email}`}>{contact.email}</a>
            </p>
          ) : null}
          {contact.hours ? (
            <p>
              <ClockCircleOutlined aria-hidden="true" />
              <span>{contact.hours}</span>
            </p>
          ) : null}
          {contact.address ? (
            <p>
              <EnvironmentOutlined aria-hidden="true" />
              {contact.mapUrl
                ? <a href={contact.mapUrl} target="_blank" rel="noreferrer">{contact.address}</a>
                : <span>{contact.address}</span>}
            </p>
          ) : null}
        </section>

        <section>
          <h2>Hỗ trợ</h2>
          <ul>
            {supportLinks.map((link) => (
              <li key={link.label}>
                <a href={link.href}>{link.label}</a>
              </li>
            ))}
          </ul>
        </section>

        <section>
          {socialLinks.length ? (
            <>
              <h2>Cộng đồng</h2>
              <div className="social-list" aria-label="Mạng xã hội">
                {socialLinks.map((social) => {
                  const Icon = socialIconByPlatform[social.platform]
                  return <a key={`${social.platform}-${social.url}`} href={social.url} aria-label={social.label} title={social.label} target="_blank" rel="noreferrer"><Icon aria-hidden="true" /></a>
                })}
              </div>
            </>
          ) : null}

          <h2 className="payment-heading">Thanh toán</h2>
          <div className="payment-list" aria-label="Phương thức thanh toán">
            <span>COD</span>
            <span>VNPAY</span>
          </div>
        </section>
      </div>
    </footer>
  )
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="site-frame">
      <Header />
      {children}
      <Footer />
    </div>
  )
}
