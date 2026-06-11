import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Empty, Spin } from 'antd'
import {
  CarOutlined,
  HeartOutlined,
  LeftOutlined,
  MinusOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  ShoppingCartOutlined,
  SwapOutlined,
} from '@ant-design/icons'
import { MainLayout } from '../../../layouts/MainLayout'
import { formatPrice } from '../../../utils/formatPrice'
import { catalogService } from '../catalog.service'
import type { CatalogCategory, ProductColorVariant, ProductDetail, ProductVariant } from '../catalog.types'
import '../catalog.css'

const getProductIdFromPath = () => window.location.pathname.split('/').filter(Boolean)[1] || ''

const getCategoryId = (category?: string | { _id: string } | null) => {
  if (!category) return null
  return typeof category === 'string' ? category : category._id
}

const buildCategoryTrail = (category: CatalogCategory | undefined, categories: CatalogCategory[]) => {
  if (!category) return []

  const categoriesById = new Map(categories.map((item) => [item._id, item]))
  const trail: CatalogCategory[] = []
  let current: CatalogCategory | undefined = category

  while (current) {
    trail.unshift(current)
    const parentId = getCategoryId(current.parent_id)
    current = parentId ? categoriesById.get(parentId) : undefined
  }

  return trail.length ? trail : [category]
}

const getFinalPrice = (variant?: ProductVariant) => {
  if (!variant) return 0
  return Math.round(variant.price * (1 - variant.discount / 100))
}

const getUniqueImages = (product: ProductDetail) => {
  const images = [product.product_image, ...product.variant.flatMap((variant) => variant.colors.map((color) => color.image))]
  return images.filter((image, index) => Boolean(image) && images.indexOf(image) === index)
}

const stripDescription = (value: string) => {
  return value
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const isCssColor = (value?: string) => Boolean(value && (value.startsWith('#') || value.startsWith('rgb') || value.startsWith('hsl')))

export function ProductDetailPage() {
  const productId = getProductIdFromPath()
  const [product, setProduct] = useState<ProductDetail | null>(null)
  const [categories, setCategories] = useState<CatalogCategory[]>([])
  const [selectedVariantId, setSelectedVariantId] = useState('')
  const [selectedColorId, setSelectedColorId] = useState('')
  const [selectedSize, setSelectedSize] = useState('')
  const [selectedImage, setSelectedImage] = useState('')
  const [thumbnailStart, setThumbnailStart] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

 useEffect(() => {
  let isMounted = true

  const loadProductDetail = async () => {
    try {
      setIsLoading(true)
      setError('')

      const [productData, categoryData] = await Promise.all([
        catalogService.getProductById(productId),
        catalogService.getActiveCategories()
      ])

      if (!isMounted) return

      const firstVariant =
        productData.variant.find((variant) => variant.isActive) ??
        productData.variant[0]

      const firstColor = firstVariant?.colors[0]

      const firstSize =
        firstVariant?.sizeMeasurements[0]?.size ?? ''

      setProduct(productData)
      setCategories(categoryData)
      setSelectedVariantId(firstVariant?._id ?? '')
      setSelectedColorId(firstColor?._id ?? '')
      setSelectedSize(firstSize)
      setSelectedImage(firstColor?.image || productData.product_image)
      setThumbnailStart(0)
    } catch (loadError: unknown) {
      if (!isMounted) return

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

  const selectedVariant = useMemo(() => {
    return product?.variant.find((variant) => variant._id === selectedVariantId) ?? product?.variant[0]
  }, [product, selectedVariantId])

  const selectedColor = useMemo(() => {
    return selectedVariant?.colors.find((color) => color._id === selectedColorId) ?? selectedVariant?.colors[0]
  }, [selectedColorId, selectedVariant])

  const stockItem = product?.source?.sourceInventory?.find(
    (item) => item.color === selectedColor?.color && item.size === selectedSize,
  )
  const sku = stockItem?.sku ?? product?.source?.sourceProductId?.toString() ?? product?._id.slice(-8).toUpperCase()
  const isAvailable = product?.isActive && selectedVariant?.isActive && (stockItem ? stockItem.quantity > 0 : true)
  const images = product ? getUniqueImages(product) : []
  const maxThumbnailStart = Math.max(images.length - 5, 0)
  const visibleImages = images.slice(thumbnailStart, thumbnailStart + 5)
  const categoryTrail = buildCategoryTrail(product?.category_id, categories)
  const description = product ? stripDescription(product.description) : ''

  const handleVariantColorChange = (variant: ProductVariant, color: ProductColorVariant) => {
    const colorImageIndex = product ? getUniqueImages(product).indexOf(color.image) : -1

    setSelectedVariantId(variant._id)
    setSelectedColorId(color._id)
    setSelectedImage(color.image)
    setSelectedSize(variant.sizeMeasurements[0]?.size ?? '')
    setThumbnailStart(colorImageIndex >= 0 ? Math.min(colorImageIndex, maxThumbnailStart) : 0)
    setQuantity(1)
  }

  return (
    <MainLayout showSlider={false}>
      <main className="product-detail-page">
        {error && <Alert className="catalog-alert" type="error" message={error} showIcon />}

        <Spin spinning={isLoading}>
          {!isLoading && !product ? (
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
                      <img src={selectedImage || product.product_image} alt={product.name} />
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
                            className={image === selectedImage ? 'active' : ''}
                            key={image}
                            onClick={() => setSelectedImage(image)}
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
                      Loại: <strong>{product.category_id.name}</strong>
                      <span>Mã: {sku}</span>
                    </p>

                    <div className="detail-price">
                      <strong>{formatPrice(getFinalPrice(selectedVariant))}</strong>
                      {selectedVariant && selectedVariant.discount > 0 && <span>{formatPrice(selectedVariant.price)}</span>}
                    </div>

                    <section className="detail-option-group" aria-label="Màu sắc">
                      <span className="detail-option-label">Màu sắc</span>
                      <div className="color-options">
                        {product.variant.flatMap((variant) =>
                          variant.colors.map((color) => (
                            <button
                              type="button"
                              className={color._id === selectedColor?._id ? 'active' : ''}
                              key={color._id}
                              title={color.color}
                              aria-label={color.color}
                              onClick={() => handleVariantColorChange(variant, color)}
                            >
                              <span
                                style={{
                                  background: isCssColor(color.colorCode) ? color.colorCode : undefined,
                                  backgroundImage: isCssColor(color.colorCode) ? undefined : `url(${color.image})`,
                                }}
                              />
                            </button>
                          )),
                        )}
                      </div>
                    </section>

                    <section className="detail-option-group" aria-label="Kích thước">
                      <div className="size-title-line">
                        <span className="detail-option-label">Kích thước</span>
                        <label>
                          <input type="checkbox" /> Hướng dẫn chọn size
                        </label>
                      </div>
                      <div className="size-options">
                        {selectedVariant?.sizeMeasurements.map((sizeMeasurement) => (
                          <button
                            type="button"
                            className={sizeMeasurement.size === selectedSize ? 'active' : ''}
                            key={sizeMeasurement.size}
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
                          <button type="button" onClick={() => setQuantity((value) => value + 1)}>
                            <PlusOutlined />
                          </button>
                        </div>
                        <Button type="text" icon={<HeartOutlined />}>
                          Thêm Vào Sản Phẩm Yêu Thích
                        </Button>
                      </div>
                    </section>

                    <div className="detail-actions">
                      <Button type="primary" icon={<ShoppingCartOutlined />} disabled={!isAvailable}>
                        Thêm vào giỏ
                      </Button>
                      <Button disabled={!isAvailable}>Mua ngay</Button>
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
              </>
            )
          )}
        </Spin>
      </main>
    </MainLayout>
  )
}
