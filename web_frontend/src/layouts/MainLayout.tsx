import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { Button, Dropdown, Input, type MenuProps } from 'antd'
import {
  CameraOutlined,
  ClockCircleOutlined,
  DownOutlined,
  EnvironmentOutlined,
  FacebookFilled,
  HeartOutlined,
  InfoCircleOutlined,
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
import { Shirt } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { fetchCart } from '../features/cart/cart.slice'
import { catalogService } from '../features/catalog/catalog.service'
import type {
  CatalogCategory,
  CategoryGender,
  SearchSuggestCategory,
  SearchSuggestProduct,
  SearchSuggestResponse,
} from '../features/catalog/catalog.types'
import { waitForInteractionBestEffort } from '../features/recommendation/interaction.service'
import { LoginButton } from '../features/auth/components/LoginButton'
import shopNameImage from '../assets/images/ShopName.png'
import { useStorefrontSettings } from '../features/storefront-settings/storefrontSettings.context'
import type { StorefrontSocialPlatform } from '../features/storefront-settings/storefrontSettings.types'
import { formatPrice } from '../utils/formatPrice'

type MainLayoutProps = {
  children: ReactNode
}

type ApparelGender = Exclude<CategoryGender, 'unisex'>

const DressIcon = () => (
  <svg
    className="category-nav-avatar-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    focusable="false"
    aria-hidden="true"
  >
    <path d="M9 3.8h6l1.5 3.6-2.3 1.1L12 6.7 9.8 8.5 7.5 7.4z" />
    <path d="M10 8.1 6.8 20.2h10.4L14 8.1" />
    <path d="M8.5 14.3h7" />
  </svg>
)

type NavLink =
  | {
      label: string
      href: string
      icon: ReactNode
      gender?: undefined
    }
  | {
      label: string
      href: string
      icon: ReactNode
      gender: ApparelGender
    }

const navLinks = [
  { label: 'Giới thiệu', href: '/', icon: <InfoCircleOutlined /> },
  {
    label: 'Thời trang nam',
    href: '/products?gender=male',
    gender: 'male',
    icon: <Shirt className="category-nav-avatar-icon" strokeWidth={1.8} />,
  },
  { label: 'Thời trang nữ', href: '/products?gender=female', gender: 'female', icon: <DressIcon /> },
] satisfies NavLink[]
const supportLinks = [
  { label: 'Hướng dẫn đặt hàng', href: '/support?topic=orders' },
  { label: 'Chính sách giao hàng', href: '/policies/shipping' },
  { label: 'Trả hàng và hoàn tiền', href: '/policies/returns' },
  { label: 'Bảo vệ dữ liệu cá nhân', href: '/policies/privacy' },
  { label: 'Điều khoản sử dụng', href: '/policies/terms' },
  { label: 'Tiếp nhận khiếu nại', href: '/policies/complaints' },
]
const CATALOG_VISUAL_SEARCH_FILE_EVENT = 'catalog:visual-search-file-selected'
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

const normalizeSearchText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLocaleLowerCase('vi-VN')
    .trim()
    .replace(/\s+/g, ' ')

const mergeSuggestions = (primary: string[], secondary: string[], limit = 10) => {
  const seen = new Set<string>()
  const merged: string[] = []

  ;[...primary, ...secondary].forEach((item) => {
    const trimmed = item.trim()
    const key = normalizeSearchText(trimmed)
    if (!trimmed || seen.has(key)) return

    seen.add(key)
    merged.push(trimmed)
  })

  return merged.slice(0, limit)
}

const isRemoteImage = (value?: string | null) => Boolean(value && /^https?:\/\//i.test(value.trim()))

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
  const locationSearchParams = new URLSearchParams(window.location.search)
  const locationCategoryId = locationSearchParams.get('categoryId') ?? ''
  const locationKeyword = locationSearchParams.get('keyword') ?? locationSearchParams.get('visualText') ?? ''
  const [searchCategoryId, setSearchCategoryId] = useState(locationCategoryId)
  const [searchKeyword, setSearchKeyword] = useState(locationKeyword)
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [searchSuggest, setSearchSuggest] = useState<SearchSuggestResponse | null>(null)
  const [isSearchSuggestLoading, setIsSearchSuggestLoading] = useState(false)
  const searchSuggestAbortRef = useRef<AbortController | null>(null)
  const visualSearchInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setSearchCategoryId(locationCategoryId)
    setSearchKeyword(locationKeyword)
  }, [locationCategoryId, locationKeyword])

  useEffect(() => {
    const query = searchKeyword.trim()
    if (query.length < 2) {
      searchSuggestAbortRef.current?.abort()
      setSearchSuggest(null)
      setIsSearchSuggestLoading(false)
      return
    }

    setIsSearchSuggestLoading(true)
    const handle = window.setTimeout(() => {
      searchSuggestAbortRef.current?.abort()
      const controller = new AbortController()
      searchSuggestAbortRef.current = controller

      catalogService
        .suggestSearch(query, { signal: controller.signal })
        .then((data) => {
          if (controller.signal.aborted) return
          setSearchSuggest(data)
        })
        .catch((error: unknown) => {
          if (error instanceof Error && error.name === 'AbortError') return
          setSearchSuggest(null)
        })
        .finally(() => {
          if (controller.signal.aborted) return
          setIsSearchSuggestLoading(false)
        })
    }, 300)

    return () => {
      window.clearTimeout(handle)
      searchSuggestAbortRef.current?.abort()
    }
  }, [searchKeyword])

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
  const cartItemCount = cart?.product_list.reduce((sum, item) => sum + item.quantity, 0) ?? 0

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

  const runHeaderSearch = async (keywordValue: string, categoryIdValue = searchCategoryId) => {
    const keyword = keywordValue.trim()
    const categoryId = categoryIdValue.trim()
    const params = new URLSearchParams()

    if (keyword) {
      params.set('keyword', keyword)
    }

    if (categoryId) {
      params.set('categoryId', categoryId)
    }

    const nextQueryString = params.toString()
    const nextUrl = `/products${nextQueryString ? `?${nextQueryString}` : ''}`

    if (!keyword) {
      window.location.assign(nextUrl)
      return
    }

    setIsSearchFocused(false)
    await waitForInteractionBestEffort({
      actionType: 'search',
      source: 'search',
      metadata: {
        keyword,
        surface: 'web_header',
        ...(categoryId ? { categoryId } : {}),
      },
    })

    window.location.assign(nextUrl)
  }

  const handleSearchSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    const keyword = String(formData.get('keyword') ?? '').trim()
    const categoryId = String(formData.get('categoryId') ?? '').trim()

    await runHeaderSearch(keyword, categoryId)
  }

  const handleSuggestKeywordClick = (keyword: string) => {
    setSearchKeyword(keyword)
    void runHeaderSearch(keyword)
  }

  const handleSuggestProductClick = async (product: SearchSuggestProduct) => {
    setIsSearchFocused(false)
    await waitForInteractionBestEffort({
      productId: product._id,
      actionType: 'search_result_click',
      source: 'search',
      metadata: {
        keyword: searchKeyword.trim(),
        surface: 'search_suggestions',
      },
    })
    window.location.assign(`/products/${encodeURIComponent(product._id)}`)
  }

  const handleSuggestCategoryClick = (category: SearchSuggestCategory) => {
    setIsSearchFocused(false)
    window.location.assign(`/products?categoryId=${encodeURIComponent(category._id)}`)
  }

  const dispatchVisualSearchFile = (file: File) => {
    const isProductListPage = window.location.pathname === '/products' || window.location.pathname === '/products/'

    if (isProductListPage) {
      window.dispatchEvent(new CustomEvent<File>(CATALOG_VISUAL_SEARCH_FILE_EVENT, { detail: file }))
      return
    }

    ;(window as Window & { __pendingVisualSearchFile?: File }).__pendingVisualSearchFile = file
    window.history.pushState(null, '', '/products')
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  const openHeaderVisualSearch = () => {
    setIsSearchFocused(false)
    visualSearchInputRef.current?.click()
  }

  const handleHeaderVisualSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (file) {
      dispatchVisualSearchFile(file)
    }
  }

  const normalizedSearchQuery = normalizeSearchText(searchKeyword)
  const keywordSuggestions = useMemo(
    () => mergeSuggestions(
      searchSuggest?.keywords ?? [],
      searchSuggest?.products.map((product) => product.name) ?? [],
    ),
    [searchSuggest],
  )
  const hasSuggestQuery = normalizedSearchQuery.length >= 2
  const showSearchPopout = isSearchFocused && hasSuggestQuery
  const hasSuggestContent = Boolean(
    keywordSuggestions.length ||
    searchSuggest?.products.length ||
    searchSuggest?.categories.length,
  )

  return (
    <header className="site-header">
      <div className="header-main">
        <a className="brand" href="/" aria-label={`Trang chủ ${settings.identity.name}`}>
          <img src={shopNameImage} alt={settings.identity.name} />
        </a>

        <form className="search" action="/products" method="get" role="search" onSubmit={handleSearchSubmit}>
          <input
            ref={visualSearchInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleHeaderVisualSearchChange}
            hidden
          />
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
          <Input
            name="keyword"
            placeholder="Bạn muốn tìm sản phẩm nào?"
            aria-label="Tìm sản phẩm bằng mô tả"
            value={searchKeyword}
            onChange={(event) => setSearchKeyword(event.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
          />
          <Button
            className="search-image"
            htmlType="button"
            icon={<CameraOutlined />}
            aria-label="Tìm sản phẩm bằng hình ảnh"
            title="Tìm bằng ảnh"
            onClick={openHeaderVisualSearch}
          />
          <Button className="search-submit" htmlType="submit" icon={<SearchOutlined />} aria-label="Tìm kiếm" />

          {showSearchPopout && (
            <div
              className="search-popout"
              role="listbox"
              aria-label="Gợi ý tìm kiếm"
              onMouseDown={(event) => event.preventDefault()}
            >
              {isSearchSuggestLoading && (
                <div className="search-popout-status">
                  <SearchOutlined aria-hidden="true" />
                  <span>Đang gợi ý...</span>
                </div>
              )}

              {!isSearchSuggestLoading && hasSuggestContent && (
                <>
                  {keywordSuggestions.length > 0 && (
                    <section className="search-popout-section">
                      <h2>Gợi ý tìm kiếm</h2>
                      <div className="search-keyword-list">
                        {keywordSuggestions.map((keyword) => (
                          <button
                            key={keyword}
                            type="button"
                            className="search-keyword-row"
                            onClick={() => handleSuggestKeywordClick(keyword)}
                          >
                            <SearchOutlined aria-hidden="true" />
                            <span>{keyword}</span>
                          </button>
                        ))}
                      </div>
                    </section>
                  )}

                  {searchSuggest?.products.length ? (
                    <section className="search-popout-section">
                      <h2>Sản phẩm nổi bật</h2>
                      <div className="search-product-list">
                        {searchSuggest.products.slice(0, 3).map((product) => (
                          <button
                            key={product._id}
                            type="button"
                            className="search-product-row"
                            onClick={() => void handleSuggestProductClick(product)}
                          >
                            <span className="search-product-image">
                              {isRemoteImage(product.image)
                                ? <img src={product.image} alt="" />
                                : <ShopOutlined aria-hidden="true" />}
                            </span>
                            <span className="search-product-copy">
                              <strong>{product.name}</strong>
                              {product.brandName && <small>{product.brandName}</small>}
                              <b>{formatPrice(product.finalPrice)}</b>
                            </span>
                          </button>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {searchSuggest?.categories.length ? (
                    <section className="search-popout-section">
                      <h2>Danh mục</h2>
                      <div className="search-category-list">
                        {searchSuggest.categories.map((category) => (
                          <button
                            key={category._id}
                            type="button"
                            className="search-category-row"
                            onClick={() => handleSuggestCategoryClick(category)}
                          >
                            <ShopOutlined aria-hidden="true" />
                            <span>{category.name}</span>
                            <small>{category.gender === 'male' ? 'Nam' : category.gender === 'female' ? 'Nữ' : 'Unisex'}</small>
                          </button>
                        ))}
                      </div>
                    </section>
                  ) : null}
                </>
              )}

              {!isSearchSuggestLoading && searchSuggest && !hasSuggestContent && (
                <div className="search-popout-empty">
                  <SearchOutlined aria-hidden="true" />
                  <strong>Chưa có gợi ý phù hợp</strong>
                  <span>Nhấn Enter để tìm "{searchKeyword.trim()}".</span>
                </div>
              )}
            </div>
          )}
        </form>

        <nav className="header-actions" aria-label="Liên kết nhanh">
          {(!currentUser || currentUser.role === 'user') && (
            <Button className="client-action-button client-action-button--favorite" type="text" href="/account?section=favorites">
              <span>Yêu thích</span>
              <span className="client-action-icon">
                <HeartOutlined />
              </span>
            </Button>
          )}
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
              <span className="category-nav-symbol" aria-hidden="true">{link.icon}</span>
              <span className="category-nav-text">{link.label}</span>
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
