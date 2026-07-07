import { Button, Field, FilterBar } from '../../../components/ui'
import type { SupportFilters } from '../support.service'
import type { FaqCategory, SupportCategory, SupportPriority, SupportTicketStatus } from '../support.types'

type SupportTicketFiltersProps = {
  filters: SupportFilters
  canMarkSpam: boolean
  statusLabels: Record<SupportTicketStatus, string>
  priorityLabels: Record<SupportPriority, string>
  categoryLabels: Record<SupportCategory | FaqCategory, string>
  onFiltersChange: (updater: (filters: SupportFilters) => SupportFilters) => void
  onReset: () => void
  onRefresh: () => void
}

export function SupportTicketFilters({
  filters,
  canMarkSpam,
  statusLabels,
  priorityLabels,
  categoryLabels,
  onFiltersChange,
  onReset,
  onRefresh,
}: SupportTicketFiltersProps) {
  return (
    <FilterBar>
      <Field label="Tìm ticket" grow>
        <input
          aria-label="Tìm ticket"
          placeholder="Mã ticket, khách hàng, mã đơn..."
          value={filters.search ?? ''}
          onChange={(event) => onFiltersChange((old) => ({ ...old, search: event.target.value, page: 1 }))}
        />
      </Field>
      <Field label="Trạng thái">
        <select
          aria-label="Lọc trạng thái"
          value={filters.status ?? 'all'}
          onChange={(event) => onFiltersChange((old) => ({ ...old, status: event.target.value as SupportFilters['status'], page: 1 }))}
        >
          <option value="all">Tất cả trạng thái</option>
          {Object.entries(statusLabels)
            .filter(([value]) => canMarkSpam || value !== 'spam')
            .map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </Field>
      <Field label="Ưu tiên">
        <select
          aria-label="Lọc ưu tiên"
          value={filters.priority ?? 'all'}
          onChange={(event) => onFiltersChange((old) => ({ ...old, priority: event.target.value as SupportFilters['priority'], page: 1 }))}
        >
          <option value="all">Tất cả mức</option>
          {Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </Field>
      <Field label="Danh mục">
        <select
          aria-label="Lọc danh mục"
          value={filters.category ?? 'all'}
          onChange={(event) => onFiltersChange((old) => ({ ...old, category: event.target.value as SupportFilters['category'], page: 1 }))}
        >
          <option value="all">Tất cả danh mục</option>
          {Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </Field>
      <Button variant="secondary" onClick={onReset}>
        Xóa lọc
      </Button>
      <Button variant="secondary" onClick={onRefresh}>
        Làm mới
      </Button>
    </FilterBar>
  )
}
