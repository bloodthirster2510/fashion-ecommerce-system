type PromotionFilterBarProps = {
  keywordInput: string
  statusFilter: string
  discountFilter: string
  sort: string
  onReset: () => void
  onKeywordChange: (value: string) => void
  onStatusChange: (value: string) => void
  onDiscountChange: (value: string) => void
  onSortChange: (value: string) => void
}

const statusFilterLabels = [
  ['all', 'Tất cả trạng thái'],
  ['active', 'Đang chạy'],
  ['inactive', 'Tạm tắt'],
  ['expired', 'Hết hạn'],
  ['upcoming', 'Sắp mở'],
] as const

export function PromotionFilterBar({
  keywordInput,
  statusFilter,
  discountFilter,
  sort,
  onReset,
  onKeywordChange,
  onStatusChange,
  onDiscountChange,
  onSortChange,
}: PromotionFilterBarProps) {
  return (
    <section className="admin-catalog-filters admin-promotion-filters" aria-label="Bộ lọc voucher">
      <div className="admin-promotion-search">
        <input
          type="search"
          value={keywordInput}
          onChange={(event) => onKeywordChange(event.target.value)}
          placeholder="Tìm mã, tên hoặc mô tả voucher..."
          aria-label="Tìm kiếm voucher"
        />
      </div>

      <select
        value={statusFilter}
        onChange={(event) => onStatusChange(event.target.value)}
        aria-label="Lọc trạng thái voucher"
      >
        {statusFilterLabels.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      <select
        value={discountFilter}
        onChange={(event) => onDiscountChange(event.target.value)}
        aria-label="Lọc loại giảm"
      >
        <option value="all">Tất cả loại giảm</option>
        <option value="percent">Phần trăm</option>
        <option value="fixed">Số tiền</option>
        <option value="free_shipping">Miễn phí vận chuyển</option>
      </select>

      <select value={sort} onChange={(event) => onSortChange(event.target.value)} aria-label="Sắp xếp voucher">
        <option value="created_desc">Mới tạo trước</option>
        <option value="created_asc">Cũ nhất trước</option>
        <option value="end_asc">Sắp hết hạn</option>
        <option value="usage_desc">Dùng nhiều nhất</option>
        <option value="code_asc">Mã A-Z</option>
      </select>

      <button className="admin-secondary-button" type="button" onClick={onReset}>
        Đặt lại
      </button>
    </section>
  )
}
