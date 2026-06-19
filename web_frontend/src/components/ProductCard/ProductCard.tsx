import { ShoppingCartOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import { formatPrice } from '../../utils/formatPrice'
import type { ProductListItem } from '../../features/catalog/catalog.types'

type ProductCardProps = {
  product: ProductListItem
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <article className="product-card">
      <a className="product-card-media" href={`/products/${product._id}`} aria-label={product.name}>
        {product.discount > 0 && <span className="product-discount-mark">-{product.discount}%</span>}
        <img src={product.image} alt={product.name} loading="lazy" />
      </a>

      <div className="product-card-body">
        <a className="product-card-name" href={`/products/${product._id}`}>
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
          <Button
            className="product-cart-button"
            type="text"
            href={`/products/${product._id}`}
            icon={<ShoppingCartOutlined />}
            aria-label={`Chọn phân loại ${product.name}`}
          />
        </div>
      </div>
    </article>
  )
}
