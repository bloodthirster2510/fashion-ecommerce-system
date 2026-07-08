export function StockWarning({ low, out }: { low: number; out: number }) {
  if (!low && !out) return <span className="admin-product-stock-ok">Đủ hàng</span>

  return (
    <span className="admin-product-warning">
      {low ? <strong>{low} sắp hết</strong> : null}
      {low && out ? <i aria-hidden="true">·</i> : null}
      {out ? <strong className="is-out">{out} hết hàng</strong> : null}
    </span>
  )
}
