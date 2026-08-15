import { Checkbox, Image, InputNumber, Popconfirm, Tag, Tooltip } from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import { formatPrice } from '../../../utils/formatPrice'
import type { CartItem } from '../cart.types'

type Props = {
  item: CartItem
  pending: boolean
  onSelect: (selected: boolean) => void
  onQuantityChange: (quantity: number) => void
  onRemove: () => void
}

const getUnavailableMessage = (item: CartItem) => {
  if (item.name && item.availableQuantity < item.quantity) {
    return 'Không đủ hàng.'
  }

  if (item.name) {
    return 'Phân loại này đã ngừng kinh doanh.'
  }

  return 'Sản phẩm không tồn tại hoặc đã bị xóa.'
}

export function CartItemCard({ item, pending, onSelect, onQuantityChange, onRemove }: Props) {
  return (
    <article className={`cart-item-card${!item.isAvailable ? ' unavailable' : ''}`}>
      <Checkbox checked={item.isSelected} disabled={!item.isAvailable || pending} onChange={(event) => onSelect(event.target.checked)} />
      <Image className="cart-item-image" src={item.image} fallback="https://placehold.co/120x140?text=Fashionista" preview={false} alt={item.name} />
      <div className="cart-item-info">
        <div className="cart-item-heading">
          <div>
            <h3>{item.name || 'Sản phẩm'}</h3>
          </div>
        </div>
        <strong className="cart-item-price">{formatPrice(item.priceAtAddedTime)}</strong>
        <div className="cart-item-meta">
          {item.color && <span>Màu sắc: <b>{item.color}</b></span>}
          <span>Kích thước: <b>{item.size}</b></span>
          {!item.isAvailable && <Tag color="error">{getUnavailableMessage(item)}</Tag>}
        </div>
      </div>
      <div className="cart-item-actions">
        <Popconfirm title="Xóa sản phẩm khỏi giỏ?" okText="Xóa" cancelText="Hủy" onConfirm={onRemove}>
          <Tooltip title="Xóa sản phẩm"><button className="cart-remove" type="button" disabled={pending}><DeleteOutlined /></button></Tooltip>
        </Popconfirm>
        <InputNumber
          className="cart-quantity"
          min={1}
          max={Math.max(item.availableQuantity, 1)}
          value={item.quantity}
          disabled={pending || !item.isAvailable}
          controls
          onChange={(value) => value && value !== item.quantity && onQuantityChange(value)}
        />
      </div>
    </article>
  )
}
