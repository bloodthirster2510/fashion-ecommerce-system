import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Empty, Modal, Spin, message } from 'antd'
import {
  CarOutlined,
  HeartFilled,
  HeartOutlined,
  LeftOutlined,
  MinusOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  ShoppingCartOutlined,
  SwapOutlined,
} from '@ant-design/icons'
import { useAppDispatch, useAppSelector } from '../../../app/hooks'
import { MainLayout } from '../../../layouts/MainLayout'
import { formatPrice } from '../../../utils/formatPrice'
import { setCart } from '../../cart/cart.slice'
import { recordInteractionBestEffort } from '../../recommendation/interaction.service'
import { catalogService } from '../catalog.service'
import { customerProductActionsService } from '../customerProductActions.service'
import { ProductReviews } from '../reviews/ProductReviews'
import type { ProductColorVariant, ProductDetail, ProductVariant } from '../catalog.types'
import '../catalog.css'

const getProductIdFromPath = () => window.location.pathname.split('/').filter(Boolean)[1] || ''
const getRecommendationRequestIdFromSearch = () => {
  const requestId = new URLSearchParams(window.location.search).get('recommendationRequestId')?.trim()
  return requestId && requestId.length <= 120 ? requestId : undefined
}

const getFinalPrice = (variant?: ProductVariant) => {
  return variant?.finalPrice ?? 0
}

const getUniqueImages = (product: ProductDetail) => {
  const colorImages = product.variants.flatMap((variant) => variant.colors.map((color) => color.image))
  const images = [product.productImage, ...product.gallery, ...colorImages]
  return images.filter((image, index) => Boolean(image) && images.indexOf(image) === index)
}

const getThumbnailStartForImage = (imageIndex: number, maxThumbnailStart: number) => {
  if (imageIndex < 0) return 0
  return Math.min(Math.max(imageIndex - 2, 0), maxThumbnailStart)
}

const stripDescription = (value: string) => {
  return value
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const isCssColor = (value?: string) => Boolean(value && (value.startsWith('#') || value.startsWith('rgb') || value.startsWith('hsl')))

const isInventoryAvailable = (item?: ProductVariant['inventory'][number]) =>
  Boolean(item?.isAvailable && item.availableQuantity > 0)

const getAvailableInventoryItem = (variant?: ProductVariant, colorId?: string) =>
  variant?.inventory.find((item) =>
    isInventoryAvailable(item) && (!colorId || item.colorVariantId === colorId),
  )

const isColorPurchasable = (variant?: ProductVariant, color?: ProductColorVariant) =>
  Boolean(
    variant?.isActive &&
    color &&
    color.isActive !== false &&
    getAvailableInventoryItem(variant, color._id),
  )

const isSizeAvailableForColor = (variant?: ProductVariant, colorId?: string, size?: string) =>
  Boolean(
    colorId &&
    size &&
    variant?.isActive &&
    isInventoryAvailable(
      variant.inventory.find((item) => item.colorVariantId === colorId && item.size === size),
    ),
  )

const getDefaultColor = (variant?: ProductVariant) => {
  const availableInventory = getAvailableInventoryItem(variant)
  const activeColors = variant?.colors.filter((color) => color.isActive !== false) ?? []

  return (
    activeColors.find((color) => color._id === availableInventory?.colorVariantId) ??
    activeColors[0] ??
    variant?.colors[0]
  )
}

const getDefaultSize = (variant?: ProductVariant, colorId?: string) => {
  const availableInventory = getAvailableInventoryItem(variant, colorId)
  return availableInventory?.size ?? variant?.sizes[0]?.size ?? ''
}

const getVariantFitLabel = (variant: ProductVariant, index: number) =>
  variant.fitType?.label?.trim() || `Phom ${index + 1}`

const isProductNotFoundError = (error: unknown) => {
  if (!(error instanceof Error)) return false
  return ['Product not found', 'Invalid product id'].includes(error.message)
}

export function ProductDetailPage() {
  const dispatch = useAppDispatch()
  const currentUser = useAppSelector((state) => state.auth.currentUser)
  const isCustomer = currentUser?.role === 'user'
  const showFavoriteAction = !currentUser || isCustomer
  const productId = getProductIdFromPath()
  const recommendationRequestId = getRecommendationRequestIdFromSearch()
  const [product, setProduct] = useState<ProductDetail | null>(null)
  const [selectedVariantId, setSelectedVariantId] = useState('')
  const [selectedColorId, setSelectedColorId] = useState('')
  const [selectedSize, setSelectedSize] = useState('')
  const [selectedImage, setSelectedImage] = useState('')
  const [thumbnailStart, setThumbnailStart] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [isAddingToCart, setIsAddingToCart] = useState(false)
  const [isBuyingNow, setIsBuyingNow] = useState(false)
  const [isUpdatingFavorite, setIsUpdatingFavorite] = useState(false)
  const [isFavorited, setIsFavorited] = useState(false)
  const [isSizeGuideOpen, setIsSizeGuideOpen] = useState(false)
  const [error, setError] = useState('')
  const [isNotFound, setIsNotFound] = useState(false)

 useEffect(() => {
  let isMounted = true

  const loadProductDetail = async () => {
    try {
      setIsLoading(true)
      setError('')
      setIsNotFound(false)

      const productData = await catalogService.getProductById(productId)

      if (!isMounted) return

      const firstVariant =
        productData.variants.find((variant) => variant._id === productData.selectedVariantId) ??
        productData.variants.find((variant) => variant.isActive && getAvailableInventoryItem(variant)) ??
        productData.variants.find((variant) => variant.isActive) ??
        productData.variants[0]

      const firstColor = getDefaultColor(firstVariant)
      const firstSize = getDefaultSize(firstVariant, firstColor?._id)

      setProduct(productData)
      setSelectedVariantId(firstVariant?._id ?? '')
      setSelectedColorId(firstColor?._id ?? '')
      setSelectedSize(firstSize)
      setSelectedImage(firstColor?.image || productData.productImage)
      setThumbnailStart(0)
    } catch (loadError: unknown) {
      if (!isMounted) return

      if (isProductNotFoundError(loadError)) {
        setProduct(null)
        setIsNotFound(true)
        return
      }

      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Không thể tải chi tiết sản phẩm.'
      )
    } finally {
      if (isMounted) {
        setIsLoading(false)
      }
    }
  }

  loadProductDetail()

  return () => {
    isMounted = false
  }
}, [productId])

  useEffect(() => {
    if (!product?._id) {
      return
    }

    void recordInteractionBestEffort({
      productId: product._id,
      actionType: 'view',
      source: 'product_detail',
      metadata: {
        ...(recommendationRequestId ? { recommendationRequestId } : {}),
      },
    })
  }, [product?._id, recommendationRequestId])

  useEffect(() => {
    if (!isCustomer) {
      setIsFavorited(false)
      return
    }

    let isMounted = true

    customerProductActionsService
      .getFavoriteStatus(productId)
      .then((status) => {
        if (!isMounted) return
        setIsFavorited(status.isFavorited)
      })
      .catch(() => {
        if (!isMounted) return
        setIsFavorited(false)
      })

    return () => {
      isMounted = false
    }
  }, [isCustomer, productId])

  const selectedVariant = useMemo(() => {
    return product?.variants.find((variant) => variant._id === selectedVariantId) ?? product?.variants[0]
  }, [product, selectedVariantId])

  const selectedColor = useMemo(() => {
    return selectedVariant?.colors.find((color) => color._id === selectedColorId) ?? selectedVariant?.colors[0]
  }, [selectedColorId, selectedVariant])

  const stockItem = selectedVariant?.inventory.find(
    (item) => item.colorVariantId === selectedColor?._id && item.size === selectedSize,
  )
  const availableQuantity = stockItem?.availableQuantity ?? 0
  const isAvailable = Boolean(
    product?.isAvailable &&
    selectedVariant?.isActive &&
    selectedColor?.isActive !== false &&
    stockItem?.isAvailable &&
    availableQuantity > 0,
  )
  const maxQuantity = Math.max(availableQuantity, 1)
  const canPurchase = Boolean(isAvailable && selectedVariant && selectedColor && selectedSize && quantity <= maxQuantity)
  const images = product ? getUniqueImages(product) : []
  const maxThumbnailStart = Math.max(images.length - 5, 0)
  const visibleImages = images.slice(thumbnailStart, thumbnailStart + 5)
  const activeImageIndex = images.findIndex((image) => image === selectedImage)
  const currentImageIndex = activeImageIndex >= 0 ? activeImageIndex : 0
  const displayedImage = images[currentImageIndex] || product?.productImage || ''
  const canSlideImages = images.length > 1
  const categoryTrail = product?.categoryBreadcrumb ?? []
  const description = product ? stripDescription(product.description) : ''

  const handleImageChange = (image: string) => {
    const imageIndex = images.indexOf(image)

    setSelectedImage(image)
    setThumbnailStart(getThumbnailStartForImage(imageIndex, maxThumbnailStart))
  }

  const handleSlideImage = (direction: -1 | 1) => {
    if (!images.length) return

    const nextImageIndex = (currentImageIndex + direction + images.length) % images.length

    setSelectedImage(images[nextImageIndex])
    setThumbnailStart(getThumbnailStartForImage(nextImageIndex, maxThumbnailStart))
  }

  const handleVariantChange = (variant: ProductVariant) => {
    const firstColor = getDefaultColor(variant)
    const firstSize = getDefaultSize(variant, firstColor?._id)
    const colorImageIndex = product ? getUniqueImages(product).indexOf(firstColor?.image ?? '') : -1

    setSelectedVariantId(variant._id)
    setSelectedColorId(firstColor?._id ?? '')
    setSelectedImage(firstColor?.image || product?.productImage || '')
    setSelectedSize(firstSize)
    setThumbnailStart(getThumbnailStartForImage(colorImageIndex, maxThumbnailStart))
    setQuantity(1)
  }

  const handleVariantColorChange = (variant: ProductVariant, color: ProductColorVariant) => {
    const colorImageIndex = product ? getUniqueImages(product).indexOf(color.image) : -1

    setSelectedVariantId(variant._id)
    setSelectedColorId(color._id)
    setSelectedImage(color.image)
    setSelectedSize(getDefaultSize(variant, color._id))
    setThumbnailStart(getThumbnailStartForImage(colorImageIndex, maxThumbnailStart))
    setQuantity(1)
  }

  const handleAddToCart = async (redirectToCart = false) => {
    if (!product || !selectedVariant || !selectedColor || !selectedSize || !canPurchase) {
      message.warning('Vui lòng chọn sản phẩm còn hàng trước khi thêm vào giỏ.')
      return
    }

    if (redirectToCart) {
      setIsBuyingNow(true)
    } else {
      setIsAddingToCart(true)
    }

    try {
      const updatedCart = await customerProductActionsService.addCartItem({
        productId: product._id,
        variantId: selectedVariant._id,
        colorVariantId: selectedColor._id,
        size: selectedSize,
        quantity,
        isSelected: true,
        ...(recommendationRequestId ? { recommendationRequestId } : {}),
      }, {
        authRequiredMessage: redirectToCart
          ? customerProductActionsService.authMessages.buyNow
          : customerProductActionsService.authMessages.addToCart,
      })
      message.success(redirectToCart ? 'Đã thêm vào giỏ hàng.' : 'Đã thêm sản phẩm vào giỏ hàng.')
      dispatch(setCart(updatedCart))

      if (redirectToCart) {
        window.location.assign('/cart')
      }
    } catch (addError) {
      message.error(addError instanceof Error ? addError.message : 'Không thể thêm sản phẩm vào giỏ hàng.')
    } finally {
      setIsAddingToCart(false)
      setIsBuyingNow(false)
    }
  }

  const handleToggleFavorite = async () => {
    if (!product) return

    setIsUpdatingFavorite(true)

    try {
      const status = isFavorited
        ? await customerProductActionsService.removeFavorite(product._id)
        : await customerProductActionsService.addFavorite(product._id)

      setIsFavorited(status.isFavorited)
      message.success(status.isFavorited ? 'Đã thêm vào sản phẩm yêu thích.' : 'Đã bỏ khỏi sản phẩm yêu thích.')
    } catch (favoriteError) {
      message.error(favoriteError instanceof Error ? favoriteError.message : 'Không thể cập nhật sản phẩm yêu thích.')
    } finally {
      setIsUpdatingFavorite(false)
    }
  }

  return (
    <MainLayout>
      <main className="product-detail-page">
        {error && <Alert className="catalog-alert" type="error" message={error} showIcon />}

        <Spin spinning={isLoading}>
          {!isLoading && (isNotFound || !product) ? (
            <Empty description="Không tìm thấy sản phẩm." />
          ) : (
            product && (
              <>
                <nav className="catalog-breadcrumb product-detail-breadcrumb" aria-label="Đường dẫn sản phẩm">
                  <span>Trang chủ</span>
                  {categoryTrail.map((category) => (
                    <span key={category._id}>{category.name}</span>
                  ))}
                  <span>{product.name}</span>
                </nav>

                <section className="product-detail-shell">
                  <section className="product-gallery" aria-label="Ảnh sản phẩm">
                    <div className="product-gallery-main">
                      <div
                        className="product-gallery-slider"
                        style={{ transform: `translateX(-${currentImageIndex * 100}%)` }}
                      >
                        {images.map((image) => (
                          <div className="product-gallery-slide" key={image}>
                            <img src={image} alt={product.name} />
                          </div>
                        ))}
                      </div>

                      {canSlideImages && (
                        <>
                          <Button
                            className="product-gallery-chevron product-gallery-chevron-prev"
                            type="text"
                            icon={<LeftOutlined />}
                            aria-label="Xem ảnh trước"
                            onClick={() => handleSlideImage(-1)}
                          />
                          <Button
                            className="product-gallery-chevron product-gallery-chevron-next"
                            type="text"
                            icon={<LeftOutlined rotate={180} />}
                            aria-label="Xem ảnh sau"
                            onClick={() => handleSlideImage(1)}
                          />
                        </>
                      )}
                    </div>

                    <div className="product-thumbnails">
                      <Button
                        className="thumb-nav thumb-nav-prev"
                        type="text"
                        icon={<LeftOutlined />}
                        aria-label="Ảnh trước"
                        disabled={thumbnailStart === 0}
                        onClick={() => setThumbnailStart((value) => Math.max(0, value - 1))}
                      />
                      <div className="thumbnail-strip">
                        {visibleImages.map((image) => (
                          <button
                            type="button"
                            className={image === displayedImage ? 'active' : ''}
                            key={image}
                            onClick={() => handleImageChange(image)}
                          >
                            <img src={image} alt="" />
                          </button>
                        ))}
                      </div>
                      <Button
                        className="thumb-nav thumb-nav-next"
                        type="text"
                        icon={<LeftOutlined rotate={180} />}
                        aria-label="Ảnh sau"
                        disabled={thumbnailStart >= maxThumbnailStart}
                        onClick={() => setThumbnailStart((value) => Math.min(maxThumbnailStart, value + 1))}
                      />
                    </div>
                  </section>

                  <aside className="product-purchase-panel" aria-label="Thông tin mua hàng">
                    <div className="product-title-row">
                      <h1>{product.name}</h1>
                      <span className={isAvailable ? 'stock-badge available' : 'stock-badge'}>{isAvailable ? 'còn hàng' : 'hết hàng'}</span>
                    </div>

                    <p className="product-meta">
                      Loại: <strong>{product.category?.name ?? 'Chưa phân loại'}</strong>
                    </p>

                    <div className="detail-price">
                      <strong>{formatPrice(getFinalPrice(selectedVariant))}</strong>
                      {selectedVariant && selectedVariant.discount > 0 && <span>{formatPrice(selectedVariant.price)}</span>}
                    </div>

                    <section className="detail-option-group" aria-label="Phom dáng">
                      <span className="detail-option-label">Phom dáng</span>
                      <div className="fit-options">
                        {product.variants.map((variant, index) => (
                          <button
                            type="button"
                            className={variant._id === selectedVariant?._id ? 'active' : ''}
                            key={variant._id}
                            disabled={!variant.isActive}
                            onClick={() => handleVariantChange(variant)}
                          >
                            {getVariantFitLabel(variant, index)}
                          </button>
                        ))}
                      </div>
                    </section>

                    <section className="detail-option-group" aria-label="Màu sắc">
                      <span className="detail-option-label">Màu sắc</span>
                      <div className="color-options">
                        {selectedVariant?.colors.map((color) => {
                          const isDisabled = !isColorPurchasable(selectedVariant, color)

                          return (
                            <button
                              type="button"
                              className={[
                                color._id === selectedColor?._id ? 'active' : '',
                                isDisabled ? 'is-disabled' : '',
                              ].filter(Boolean).join(' ')}
                              key={color._id}
                              title={color.isActive === false ? `${color.color} - ngừng kinh doanh` : color.color}
                              aria-label={color.color}
                              disabled={isDisabled}
                              onClick={() => handleVariantColorChange(selectedVariant, color)}
                            >
                              <span
                                style={{
                                  background: isCssColor(color.colorCode) ? color.colorCode : undefined,
                                  backgroundImage: isCssColor(color.colorCode) ? undefined : `url(${color.image})`,
                                }}
                              />
                            </button>
                          )
                        })}
                      </div>
                    </section>

                    <section className="detail-option-group" aria-label="Kích thước">
                      <div className="size-title-line">
                        <span className="detail-option-label">Kích thước</span>
                        {product.sizeGuideImage && (
                          <button className="size-guide-trigger" type="button" onClick={() => setIsSizeGuideOpen(true)}>
                            Hướng dẫn chọn size
                          </button>
                        )}
                      </div>
                      <div className="size-options">
                        {selectedVariant?.sizes.map((sizeMeasurement) => (
                          <button
                            type="button"
                            className={[
                              sizeMeasurement.size === selectedSize ? 'active' : '',
                              !isSizeAvailableForColor(selectedVariant, selectedColor?._id, sizeMeasurement.size) ? 'is-disabled' : '',
                            ].filter(Boolean).join(' ')}
                            key={sizeMeasurement.size}
                            disabled={!isSizeAvailableForColor(selectedVariant, selectedColor?._id, sizeMeasurement.size)}
                            onClick={() => {
                              setSelectedSize(sizeMeasurement.size)
                              setQuantity(1)
                            }}
                          >
                            {sizeMeasurement.size}
                          </button>
                        ))}
                      </div>
                    </section>

                    <section className="detail-option-group" aria-label="Số lượng">
                      <span className="detail-option-label">Số lượng</span>
                      <div className="quantity-row">
                        <div className="quantity-control">
                          <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))}>
                            <MinusOutlined />
                          </button>
                          <span>{quantity}</span>
                          <button
                            type="button"
                            disabled={!isAvailable || quantity >= maxQuantity}
                            onClick={() => setQuantity((value) => Math.min(maxQuantity, value + 1))}
                          >
                            <PlusOutlined />
                          </button>
                        </div>
                        {showFavoriteAction && (
                          <Button
                            className={isFavorited ? 'favorite-toggle is-favorited' : 'favorite-toggle'}
                            type="text"
                            icon={isFavorited ? <HeartFilled /> : <HeartOutlined />}
                            loading={isUpdatingFavorite}
                            onClick={() => void handleToggleFavorite()}
                          >
                            {isFavorited ? 'Bỏ khỏi sản phẩm yêu thích' : 'Thêm vào sản phẩm yêu thích'}
                          </Button>
                        )}
                      </div>
                    </section>

                    <div className="detail-actions">
                      <Button
                        type="primary"
                        icon={<ShoppingCartOutlined />}
                        disabled={!canPurchase || isBuyingNow}
                        loading={isAddingToCart}
                        onClick={() => void handleAddToCart()}
                      >
                        Thêm vào giỏ
                      </Button>
                      <Button
                        disabled={!canPurchase || isAddingToCart}
                        loading={isBuyingNow}
                        onClick={() => void handleAddToCart(true)}
                      >
                        Mua ngay
                      </Button>
                    </div>

                    <div className="purchase-benefits">
                      <span><SafetyCertificateOutlined /> Đổi hàng trong 7 ngày</span>
                      <span><CarOutlined /> Miễn phí vận chuyển đơn từ 599k</span>
                      <span><SafetyCertificateOutlined /> Bảo hành trong vòng 30 ngày</span>
                      <span><SwapOutlined /> Vận chuyển toàn quốc</span>
                    </div>
                  </aside>
                </section>

                {description && (
                  <section className="product-description">
                    <h2>Mô tả sản phẩm</h2>
                    <p>{description}</p>
                  </section>
                )}

                <ProductReviews productId={product._id} variants={product.variants} />
                <Modal
                  className="size-guide-modal"
                  title="Hướng dẫn chọn size"
                  open={isSizeGuideOpen}
                  footer={null}
                  onCancel={() => setIsSizeGuideOpen(false)}
                >
                  <img src={product.sizeGuideImage} alt="Hướng dẫn chọn size" />
                </Modal>
              </>
            )
          )}
        </Spin>
      </main>
    </MainLayout>
  )
}
