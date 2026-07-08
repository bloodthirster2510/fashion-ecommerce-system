import { formatNumber } from '../productDisplay.helpers'

type ProductStatsProps = {
  stats: {
    total: number
    sold: number
    stock: number
    warning: number
    inactive: number
  }
}

export function ProductStats({ stats }: ProductStatsProps) {
  return (
    <div className="admin-product-stats" aria-label="Thống kê sản phẩm">
      {[
        ['Tổng sản phẩm', stats.total, 'is-total'],
        ['Đã bán', stats.sold, 'is-sold'],
        ['Tồn kho', stats.stock, 'is-stock'],
        ['Sắp hết hàng', stats.warning, 'is-warning'],
        ['Ngừng bán', stats.inactive, 'is-inactive'],
      ].map(([label, value, className]) => (
        <div className={String(className)} key={String(label)}>
          <span>{label}</span>
          <strong>{formatNumber(Number(value))}</strong>
        </div>
      ))}
    </div>
  )
}
