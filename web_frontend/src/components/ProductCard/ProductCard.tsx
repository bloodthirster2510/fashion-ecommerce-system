import { HeartFilled, HeartOutlined, ShoppingCartOutlined } from '@ant-design/icons'
import { Button, message } from 'antd'
import { useEffect, useState, type MouseEvent } from 'react'
import { useAppDispatch } from '../../app/hooks'
import { formatPrice } from '../../utils/formatPrice'
import { customerProductActionsService } from '../../features/catalog/customerProductActions.service'
import { catalogService } from '../../features/catalog/catalog.service'
import { setCart } from '../../features/cart/cart.slice'
import type { ProductDetail, ProductListItem } from '../../features/catalog/catalog.types'

type ProductCardProps = {
  product: ProductListItem
  onProductClick?: (product: ProductListItem, href: string, event: MouseEvent<HTMLElement>) => void
  onFavoriteChange?: (product: ProductListItem, isFavorited: boolean) => void
  showFavoriteButton?: boolean
}

export function ProductCard({ product, onProductClick, onFavoriteChange, showFavoriteButton = true }: ProductCardProps) {
  const dispatch = useAppDispatch()
  const productHref = `/products/${product._id}`
  const [isFavorited, setIsFavorited] = useState(product.isFavorited === true)
  const [isFavoriteLoading, setIsFavoriteLoading] = useState(false)
  const [isCartLoading, setIsCartLoading] = useState(false)

  useEffect(() => {
    setIsFavorited(product.isFavorited === true)
  }, [product._id, product.isFavorited])

  const handleProductClick = (event: MouseEvent<HTMLElement>) => {
    onProductClick?.(product, productHref, event)
  }

  const handleFavoriteClick = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()

    if (isFavoriteLoading) return

    const nextIsFavorited = !isFavorited

    try {
      setIsFavoriteLoading(true)
      setIsFavorited(nextIsFavorited)

      const status = nextIsFavorited
        ? await customerProductActionsService.addFavorite(product._id)
        : await customerProductActionsService.removeFavorite(product._id)

      setIsFavorited(status.isFavorited)
      onFavoriteChange?.(product, status.isFavorited)
      message.success(status.isFavorited ? 'Đã thêm vào sản phẩm yêu thích.' : 'Đã bỏ khỏi sản phẩm yêu thích.')
    } catch (favoriteError) {
      setIsFavorited(!nextIsFavorited)
      message.error(favoriteError instanceof Error ? favoriteError.message : 'Không thể cập nhật sản phẩm yêu thích.')
    } finally {
      setIsFavoriteLoading(false)
    }
  }

  const getDefaultPurchaseSelection = (detail: ProductDetail) => {
    const variants = detail.variants.filter((variant) => variant.isActive)
    const variant = variants.find((item) => item.inventory.some((inventory) => inventory.isAvailable && inventory.availableQuantity > 0))
    if (!variant) return null

    const inventory = variant.inventory.find((item) => item.isAvailable && item.availableQuantity > 0)
    if (!inventory) return null

    const color = variant.colors.find((item) => item._id === inventory.colorVariantId && item.isActive !== false)
    if (!color) return null

    return { variant, color, size: inventory.size }
  }

  const handleAddToCart = async (event: MouseEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (isCartLoading || !product.isAvailable) return

    setIsCartLoading(true)
    try {
      const detail = await catalogService.getProductById(product._id)
      const selection = getDefaultPurchaseSelection(detail)

      if (!selection) {
        message.warning('Sản phẩm hiện không có phân loại còn hàng.')
        return
      }

      const updatedCart = await customerProductActionsService.addCartItem({
        productId: product._id,
        variantId: selection.variant._id,
        colorVariantId: selection.color._id,
        size: selection.size,
        quantity: 1,
        isSelected: true,
      })
      dispatch(setCart(updatedCart))
      message.success('Đã thêm sản phẩm vào giỏ hàng.')
    } catch (cartError) {
      message.error(cartError instanceof Error ? cartError.message : 'Không thể thêm sản phẩm vào giỏ hàng.')
    } finally {
      setIsCartLoading(false)
    }
  }

  return (
    <article className="product-card">
      <a className="product-card-media" href={productHref} aria-label={product.name} onClick={handleProductClick}>
        {product.discount > 0 && <span className="product-discount-mark">-{product.discount}%</span>}
        <img src={product.image} alt={product.name} loading="lazy" />
      </a>
      {showFavoriteButton && (
        <button
          className={isFavorited ? 'product-card-favorite is-favorited' : 'product-card-favorite'}
          type="button"
          onClick={handleFavoriteClick}
          disabled={isFavoriteLoading}
          aria-label={isFavorited ? `Bỏ yêu thích ${product.name}` : `Yêu thích ${product.name}`}
          aria-pressed={isFavorited}
        >
          {isFavorited ? <HeartFilled /> : <HeartOutlined />}
        </button>
      )}

      <div className="product-card-body">
        <a className="product-card-name" href={productHref} onClick={handleProductClick}>
          {product.name}
        </a>

        <div className="product-card-bottom">
          <div className="product-price">
            <strong>{formatPrice(product.finalPrice)}</strong>
            {product.isSale && <span>{formatPrice(product.originalPrice)}</span>}
          </div>
        </div>

        <div className="product-card-action">
          <Button
            className="product-cart-button"
            type="text"
            icon={<ShoppingCartOutlined />}
            aria-label={`Thêm ${product.name} vào giỏ hàng`}
            loading={isCartLoading}
            disabled={!product.isAvailable}
            onClick={(event) => void handleAddToCart(event)}
          >
            <span>Thêm vào giỏ</span>
          </Button>
          <button className="product-cart-label" type="button" disabled={!product.isAvailable || isCartLoading} onClick={(event) => void handleAddToCart(event)}>
            Thêm vào giỏ
          </button>
          <span className={product.isAvailable ? 'product-stock-pill is-available' : 'product-stock-pill'}>
            {product.isAvailable ? 'Còn hàng' : 'Hết hàng'}
          </span>
        </div>
      </div>
    </article>
  )
}
