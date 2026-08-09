import { HeartOutlined, ShoppingCartOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import type { MouseEvent } from 'react'
import { formatPrice } from '../../utils/formatPrice'
import type { ProductListItem } from '../../features/catalog/catalog.types'

type ProductCardProps = {
  product: ProductListItem
  onProductClick?: (product: ProductListItem, href: string, event: MouseEvent<HTMLElement>) => void
}

export function ProductCard({ product, onProductClick }: ProductCardProps) {
  const productHref = `/products/${product._id}`
  const handleProductClick = (event: MouseEvent<HTMLElement>) => {
    onProductClick?.(product, productHref, event)
  }

  return (
    <article className="product-card">
      <a className="product-card-media" href={productHref} aria-label={product.name} onClick={handleProductClick}>
        {product.discount > 0 && <span className="product-discount-mark">-{product.discount}%</span>}
        <span className="product-card-favorite" aria-hidden="true">
          <HeartOutlined />
        </span>
        <img src={product.image} alt={product.name} loading="lazy" />
      </a>

      <div className="product-card-body">
        <a className="product-card-name" href={productHref} onClick={handleProductClick}>
          {product.name}
        </a>

        <div className="product-card-tags" aria-label="Nhãn sản phẩm">
          {product.isNew && <span className="product-tag product-tag-new">Hàng mới</span>}
          {product.isSale && <span className="product-tag product-tag-sale">Sale</span>}
        </div>

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
          />
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
