import { Button, Field, FilterBar } from '../../../components/ui'
import type { MembershipRanking } from '../../loyalty/loyalty.types'

type PromotionFilterBarProps = {
  keywordInput: string
  statusFilter: string
  discountFilter: string
  visibilityFilter: string
  audienceFilter: string
  rankFilter: string
  dateFromFilter: string
  dateToFilter: string
  sort: string
  tiers: MembershipRanking[]
  isLoading: boolean
  onRefresh: () => void
  onExport: () => void
  onReset: () => void
  onKeywordChange: (value: string) => void
  onStatusChange: (value: string) => void
  onDiscountChange: (value: string) => void
  onVisibilityChange: (value: string) => void
  onAudienceChange: (value: string) => void
  onRankChange: (value: string) => void
  onDateFromChange: (value: string) => void
  onDateToChange: (value: string) => void
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
  visibilityFilter,
  audienceFilter,
  rankFilter,
  dateFromFilter,
  dateToFilter,
  sort,
  tiers,
  isLoading,
  onRefresh,
  onExport,
  onReset,
  onKeywordChange,
  onStatusChange,
  onDiscountChange,
  onVisibilityChange,
  onAudienceChange,
  onRankChange,
  onDateFromChange,
  onDateToChange,
  onSortChange,
}: PromotionFilterBarProps) {
  return (
    <FilterBar actions={(
      <div className="admin-promotion-filter-actions">
        <Button variant="secondary" onClick={onRefresh}>
          Làm mới
        </Button>
        <Button variant="secondary" disabled={isLoading} onClick={onExport}>
          Xuất CSV
        </Button>
        <Button variant="ghost" onClick={onReset}>
          Xóa lọc
        </Button>
      </div>
    )}>
      <Field label="Tìm kiếm" grow>
        <input
          type="search"
          value={keywordInput}
          onChange={(event) => onKeywordChange(event.target.value)}
          placeholder="Tìm mã, tên hoặc mô tả voucher"
        />
      </Field>

      <Field label="Trạng thái">
        <select value={statusFilter} onChange={(event) => onStatusChange(event.target.value)}>
          {statusFilterLabels.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Loại giảm">
        <select value={discountFilter} onChange={(event) => onDiscountChange(event.target.value)}>
          <option value="all">Tất cả</option>
          <option value="percent">Phần trăm</option>
          <option value="fixed">Số tiền</option>
          <option value="free_shipping">Miễn phí vận chuyển</option>
        </select>
      </Field>

      <Field label="Hiển thị">
        <select value={visibilityFilter} onChange={(event) => onVisibilityChange(event.target.value)}>
          <option value="all">Tất cả</option>
          <option value="public">Công khai</option>
          <option value="private">Riêng tư</option>
        </select>
      </Field>

      <Field label="Đối tượng">
        <select value={audienceFilter} onChange={(event) => onAudienceChange(event.target.value)}>
          <option value="all_filter">Tất cả</option>
          <option value="all">Mọi khách</option>
          <option value="new_user">Khách mới</option>
          <option value="member">Thành viên</option>
        </select>
      </Field>

      <Field label="Hạng thành viên">
        <select value={rankFilter} onChange={(event) => onRankChange(event.target.value)}>
          <option value="">Tất cả hạng</option>
          {tiers.filter((tier) => tier._id).map((tier) => (
            <option key={tier._id} value={tier._id}>{tier.name}</option>
          ))}
        </select>
      </Field>

      <Field label="Hiệu lực từ">
        <input
          type="date"
          value={dateFromFilter}
          max={dateToFilter || undefined}
          onChange={(event) => onDateFromChange(event.target.value)}
        />
      </Field>

      <Field label="Hiệu lực đến">
        <input
          type="date"
          value={dateToFilter}
          min={dateFromFilter || undefined}
          onChange={(event) => onDateToChange(event.target.value)}
        />
      </Field>

      <Field label="Sắp xếp">
        <select value={sort} onChange={(event) => onSortChange(event.target.value)}>
          <option value="created_desc">Mới tạo trước</option>
          <option value="created_asc">Cũ nhất trước</option>
          <option value="end_asc">Sắp hết hạn</option>
          <option value="usage_desc">Dùng nhiều nhất</option>
          <option value="code_asc">Mã A-Z</option>
        </select>
      </Field>
    </FilterBar>
  )
}
