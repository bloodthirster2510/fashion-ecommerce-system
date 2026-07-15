import { Button, Field, FilterBar } from '../../../components/ui'
import type { SupportFilters } from '../support.service'
import type { FaqCategory, SupportCategory, SupportPerson, SupportPriority, SupportTicketStatus, SupportTicketType } from '../support.types'

type SupportTicketFiltersProps = {
  filters: SupportFilters
  canMarkSpam: boolean
  statusLabels: Record<SupportTicketStatus, string>
  priorityLabels: Record<SupportPriority, string>
  categoryLabels: Record<SupportCategory | FaqCategory, string>
  typeLabels: Record<SupportTicketType, string>
  assignees: SupportPerson[]
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
  typeLabels,
  assignees,
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
      <Field label="Loại yêu cầu">
        <select aria-label="Lọc loại yêu cầu" value={filters.type ?? 'all'} onChange={(event) => onFiltersChange((old) => ({ ...old, type: event.target.value as SupportFilters['type'], page: 1 }))}>
          <option value="all">Tất cả loại</option>
          {Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
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
      <Field label="Người xử lý">
        <select aria-label="Lọc người xử lý" value={filters.assignedTo ?? 'all'} onChange={(event) => onFiltersChange((old) => ({ ...old, assignedTo: event.target.value, page: 1 }))}>
          <option value="all">Tất cả</option>
          <option value="unassigned">Chưa phân công</option>
          {assignees.map((person) => <option key={person._id} value={person._id}>{person.name || person.email}</option>)}
        </select>
      </Field>
      <Field label="Phản hồi">
        <select aria-label="Lọc yêu cầu phản hồi" value={String(filters.requiresReply ?? 'all')} onChange={(event) => onFiltersChange((old) => ({ ...old, requiresReply: event.target.value === 'all' ? 'all' : event.target.value === 'true', page: 1 }))}>
          <option value="all">Tất cả</option><option value="true">Cần phản hồi</option><option value="false">Không chờ phản hồi</option>
        </select>
      </Field>
      <Field label="Liên kết đơn">
        <select aria-label="Lọc theo đơn hàng" value={String(filters.hasOrder ?? 'all')} onChange={(event) => onFiltersChange((old) => ({ ...old, hasOrder: event.target.value === 'all' ? 'all' : event.target.value === 'true', page: 1 }))}>
          <option value="all">Tất cả</option><option value="true">Có đơn hàng</option><option value="false">Không có đơn</option>
        </select>
      </Field>
      <Field label="Từ ngày"><input aria-label="Từ ngày" type="date" value={filters.dateFrom ?? ''} onChange={(event) => onFiltersChange((old) => ({ ...old, dateFrom: event.target.value, page: 1 }))} /></Field>
      <Field label="Đến ngày"><input aria-label="Đến ngày" type="date" value={filters.dateTo ?? ''} onChange={(event) => onFiltersChange((old) => ({ ...old, dateTo: event.target.value, page: 1 }))} /></Field>
      <Button variant="secondary" onClick={onReset}>
        Xóa lọc
      </Button>
      <Button variant="secondary" onClick={onRefresh}>
        Làm mới
      </Button>
    </FilterBar>
  )
}
