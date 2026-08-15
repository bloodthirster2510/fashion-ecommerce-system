import { useMemo, useState } from 'react'
import { ChevronDown, Filter, RefreshCw, Search, X } from 'lucide-react'
import { Button, Field } from '../../../components/ui'
import type { SupportFilters } from '../support.service'
import type { FaqCategory, SupportCategory, SupportPerson, SupportPriority, SupportTicketStatus, SupportTicketType } from '../support.types'

type SupportTicketFiltersProps = {
  filters: SupportFilters
  currentUserId: string
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
  currentUserId,
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
  const advancedFilterCount = useMemo(() => [
    filters.assignedTo,
    filters.requiresReply,
    filters.priority,
    filters.type,
    filters.category,
    filters.hasOrder,
    filters.dateFrom,
    filters.dateTo,
  ].filter((value) => value !== undefined && value !== '' && value !== 'all').length, [filters])
  const activeFilterCount = useMemo(() => [
    filters.search,
    filters.status,
    filters.priority,
    filters.type,
    filters.category,
    filters.assignedTo,
    filters.requiresReply,
    filters.hasOrder,
    filters.dateFrom,
    filters.dateTo,
  ].filter((value) => value !== undefined && value !== '' && value !== 'all').length, [filters])
  const [advancedOpen, setAdvancedOpen] = useState(advancedFilterCount > 0)
  const activeView = filters.assignedTo === currentUserId
    ? 'mine'
    : filters.assignedTo === 'unassigned'
      ? 'unassigned'
      : filters.requiresReply === true
        ? 'reply'
        : 'all'

  const selectView = (view: 'all' | 'reply' | 'mine' | 'unassigned') => {
    onFiltersChange((old) => ({
      ...old,
      page: 1,
      assignedTo: view === 'mine' ? currentUserId : view === 'unassigned' ? 'unassigned' : 'all',
      requiresReply: view === 'reply' ? true : 'all',
    }))
  }

  return (
    <section className="admin-support-filters" aria-label="Bộ lọc ticket">
      <div className="admin-support-queue-views" role="group" aria-label="Hàng đợi nhanh">
        <span>Chế độ xem</span>
        <button type="button" className={activeView === 'all' ? 'is-active' : undefined} aria-pressed={activeView === 'all'} onClick={() => selectView('all')}>Tất cả</button>
        <button type="button" className={activeView === 'reply' ? 'is-active' : undefined} aria-pressed={activeView === 'reply'} onClick={() => selectView('reply')}>Cần phản hồi</button>
        <button type="button" className={activeView === 'mine' ? 'is-active' : undefined} aria-pressed={activeView === 'mine'} onClick={() => selectView('mine')}>Của tôi</button>
        <button type="button" className={activeView === 'unassigned' ? 'is-active' : undefined} aria-pressed={activeView === 'unassigned'} onClick={() => selectView('unassigned')}>Chưa phân công</button>
      </div>
      <div className="admin-support-filter-primary">
        <label className="admin-support-search">
          <Search aria-hidden="true" />
          <input
            aria-label="Tìm ticket"
            placeholder="Tìm mã ticket, khách hàng, mã đơn..."
            value={filters.search ?? ''}
            onChange={(event) => onFiltersChange((old) => ({ ...old, search: event.target.value, page: 1 }))}
          />
        </label>
        <select
          aria-label="Lọc trạng thái"
          value={filters.status ?? 'all'}
          onChange={(event) => onFiltersChange((old) => ({ ...old, status: event.target.value as SupportFilters['status'], page: 1 }))}
        >
          <option value="all">Mọi trạng thái</option>
          {Object.entries(statusLabels)
            .filter(([value]) => canMarkSpam || value !== 'spam')
            .map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button className={`admin-support-filter-toggle${advancedOpen ? ' is-open' : ''}`} type="button" aria-expanded={advancedOpen} onClick={() => setAdvancedOpen((open) => !open)}>
          <Filter aria-hidden="true" />
          <span>Nâng cao</span>
          {advancedFilterCount > 0 ? <b>{advancedFilterCount}</b> : null}
          <ChevronDown aria-hidden="true" />
        </button>
        <button className="admin-support-icon-button" type="button" title="Làm mới hàng đợi" aria-label="Làm mới hàng đợi" onClick={onRefresh}>
          <RefreshCw aria-hidden="true" />
        </button>
      </div>

      {advancedOpen ? (
        <div className="admin-support-filter-advanced">
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
          <Field label="Mức ưu tiên">
            <select aria-label="Lọc ưu tiên" value={filters.priority ?? 'all'} onChange={(event) => onFiltersChange((old) => ({ ...old, priority: event.target.value as SupportFilters['priority'], page: 1 }))}>
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
            <select aria-label="Lọc danh mục" value={filters.category ?? 'all'} onChange={(event) => onFiltersChange((old) => ({ ...old, category: event.target.value as SupportFilters['category'], page: 1 }))}>
              <option value="all">Tất cả danh mục</option>
              {Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <Field label="Liên kết đơn">
            <select aria-label="Lọc theo đơn hàng" value={String(filters.hasOrder ?? 'all')} onChange={(event) => onFiltersChange((old) => ({ ...old, hasOrder: event.target.value === 'all' ? 'all' : event.target.value === 'true', page: 1 }))}>
              <option value="all">Tất cả</option><option value="true">Có đơn hàng</option><option value="false">Không có đơn</option>
            </select>
          </Field>
          <Field label="Từ ngày"><input aria-label="Từ ngày" type="date" value={filters.dateFrom ?? ''} onChange={(event) => onFiltersChange((old) => ({ ...old, dateFrom: event.target.value, page: 1 }))} /></Field>
          <Field label="Đến ngày"><input aria-label="Đến ngày" type="date" value={filters.dateTo ?? ''} onChange={(event) => onFiltersChange((old) => ({ ...old, dateTo: event.target.value, page: 1 }))} /></Field>
        </div>
      ) : null}

      {activeFilterCount > 0 ? (
        <div className="admin-support-filter-footer">
          <span>Đang áp dụng {activeFilterCount} bộ lọc</span>
          <Button variant="ghost" onClick={onReset}><X aria-hidden="true" /> Xóa tất cả</Button>
        </div>
      ) : null}
    </section>
  )
}
