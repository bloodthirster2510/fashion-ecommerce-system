import type { AdminOrder } from '../orderAdminApi'
import { formatCurrency } from '../orderPresentation'

export function OrderLineItemsPanel({ order }: { order: AdminOrder }) {
  return (
    <section className="admin-drawer-section admin-order-section-main admin-order-section-items">
      <h3>Sản phẩm</h3>
      <div className="admin-order-item-list">
        {order.order_list.map((item) => (
          <div className="admin-order-item" key={item._id ?? item.sku}>
            <div>
              <strong>{item.name}</strong>
              <span>{item.color} / {item.size} / {item.fitType}</span>
            </div>
            <span>
              {item.quantity} x {formatCurrency(item.priceAtPurchased)}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
