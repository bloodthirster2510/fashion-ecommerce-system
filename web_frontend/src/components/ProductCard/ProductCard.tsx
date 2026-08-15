import { HeartFilled, HeartOutlined, ShoppingCartOutlined } from '@ant-design/icons'
import { Button, message } from 'antd'
import { useEffect, useState, type MouseEvent } from 'react'
import { formatPrice } from '../../utils/formatPrice'
import { customerProductActionsService } from '../../features/catalog/customerProductActions.service'
import type { ProductListItem } from '../../features/catalog/catalog.types'

type ProductCardProps = {
  product: ProductListItem
  onProductClick?: (product: ProductListItem, href: string, event: MouseEvent<HTMLElement>) => void
  onFavoriteChange?: (product: ProductListItem, isFavorited: boolean) => void
}

export function ProductCard({ product, onProductClick, onFavoriteChange }: ProductCardProps) {
  const productHref = `/products/${product._id}`
  const [isFavorited, setIsFavorited] = useState(product.isFavorited === true)
  const [isFavoriteLoading, setIsFavoriteLoading] = useState(false)

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

  return (
    <article className="product-card">
      <a className="product-card-media" href={productHref} aria-label={product.name} onClick={handleProductClick}>
        {product.discount > 0 && <span className="product-discount-mark">-{product.discount}%</span>}
        <img src={product.image} alt={product.name} loading="lazy" />
      </a>
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
            href={productHref}
            icon={<ShoppingCartOutlined />}
            aria-label={`Chọn phân loại ${product.name}`}
            onClick={handleProductClick}
          >
            <span>Thêm vào giỏ</span>
          </Button>
          <a className="product-cart-label" href={productHref} onClick={handleProductClick}>
            Thêm vào giỏ
          </a>
          <span className={product.isAvailable ? 'product-stock-pill is-available' : 'product-stock-pill'}>
            {product.isAvailable ? 'Còn hàng' : 'Hết hàng'}
          </span>
        </div>
      </div>
    </article>
  )
}
