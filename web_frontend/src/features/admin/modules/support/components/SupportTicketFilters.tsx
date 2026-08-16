import { useMemo, useState } from 'react'
import { ChevronDown, RefreshCw, Search, SlidersHorizontal, X } from 'lucide-react'
import { Field } from '../../../components/ui'
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
    <section className="admin-support-filter-bar" aria-label="Bộ lọc hàng đợi">
      <div className="admin-support-filter-bar__top">
        <div className="admin-support-views" role="group" aria-label="Lọc theo góc nhìn">
          <button
            type="button"
            className={`admin-support-view-pill${activeView === 'all' ? ' is-active' : ''}`}
            aria-pressed={activeView === 'all'}
            onClick={() => selectView('all')}
          >
            Tất cả
          </button>
          <button
            type="button"
            className={`admin-support-view-pill${activeView === 'reply' ? ' is-active' : ''}`}
            aria-pressed={activeView === 'reply'}
            onClick={() => selectView('reply')}
          >
            Cần phản hồi
          </button>
          <button
            type="button"
            className={`admin-support-view-pill${activeView === 'mine' ? ' is-active' : ''}`}
            aria-pressed={activeView === 'mine'}
            onClick={() => selectView('mine')}
          >
            Của tôi
          </button>
          <button
            type="button"
            className={`admin-support-view-pill${activeView === 'unassigned' ? ' is-active' : ''}`}
            aria-pressed={activeView === 'unassigned'}
            onClick={() => selectView('unassigned')}
          >
            Chưa phân công
          </button>
        </div>

        <div className="admin-support-search-wrap">
          <label className="admin-support-search-input">
            <Search aria-hidden="true" />
            <input
              aria-label="Tìm kiếm ticket"
              placeholder="Tìm mã ticket, tên khách, email, mã đơn..."
              value={filters.search ?? ''}
              onChange={(event) => onFiltersChange((old) => ({ ...old, search: event.target.value, page: 1 }))}
            />
            {filters.search ? (
              <button
                type="button"
                className="admin-support-search-clear"
                onClick={() => onFiltersChange((old) => ({ ...old, search: '', page: 1 }))}
                aria-label="Xóa từ khóa tìm kiếm"
              >
                <X aria-hidden="true" />
              </button>
            ) : null}
          </label>

          <select
            className="admin-support-select"
            aria-label="Lọc trạng thái"
            value={filters.status ?? 'all'}
            onChange={(event) => onFiltersChange((old) => ({ ...old, status: event.target.value as SupportFilters['status'], page: 1 }))}
          >
            <option value="all">Tất cả trạng thái</option>
            {Object.entries(statusLabels)
              .filter(([value]) => canMarkSpam || value !== 'spam')
              .map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>

          <button
            className={`admin-support-filter-btn${advancedOpen ? ' is-open' : ''}${advancedFilterCount > 0 ? ' has-count' : ''}`}
            type="button"
            aria-expanded={advancedOpen}
            onClick={() => setAdvancedOpen((open) => !open)}
            title="Mở bộ lọc nâng cao"
          >
            <SlidersHorizontal aria-hidden="true" />
            <span>Nâng cao</span>
            {advancedFilterCount > 0 ? <b aria-label={`${advancedFilterCount} bộ lọc nâng cao`}>{advancedFilterCount}</b> : null}
            <ChevronDown className="admin-support-chevron" aria-hidden="true" />
          </button>

          <button
            className="admin-support-refresh-btn"
            type="button"
            title="Làm mới hàng đợi"
            aria-label="Làm mới hàng đợi"
            onClick={onRefresh}
          >
            <RefreshCw aria-hidden="true" />
          </button>
        </div>
      </div>

      {advancedOpen ? (
        <div className="admin-support-filter-advanced">
          <Field label="Người xử lý">
            <select
              aria-label="Lọc người xử lý"
              value={filters.assignedTo ?? 'all'}
              onChange={(event) => onFiltersChange((old) => ({ ...old, assignedTo: event.target.value, page: 1 }))}
            >
              <option value="all">Tất cả nhân viên</option>
              <option value="unassigned">Chưa phân công</option>
              {assignees.map((person) => <option key={person._id} value={person._id}>{person.name || person.email}</option>)}
            </select>
          </Field>

          <Field label="Mức ưu tiên">
            <select
              aria-label="Lọc ưu tiên"
              value={filters.priority ?? 'all'}
              onChange={(event) => onFiltersChange((old) => ({ ...old, priority: event.target.value as SupportFilters['priority'], page: 1 }))}
            >
              <option value="all">Tất cả mức ưu tiên</option>
              {Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>

          <Field label="Loại yêu cầu">
            <select
              aria-label="Lọc loại yêu cầu"
              value={filters.type ?? 'all'}
              onChange={(event) => onFiltersChange((old) => ({ ...old, type: event.target.value as SupportFilters['type'], page: 1 }))}
            >
              <option value="all">Tất cả loại yêu cầu</option>
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

          <Field label="Liên kết đơn hàng">
            <select
              aria-label="Lọc theo đơn hàng"
              value={String(filters.hasOrder ?? 'all')}
              onChange={(event) => onFiltersChange((old) => ({ ...old, hasOrder: event.target.value === 'all' ? 'all' : event.target.value === 'true', page: 1 }))}
            >
              <option value="all">Tất cả</option>
              <option value="true">Có đơn hàng liên kết</option>
              <option value="false">Không có đơn hàng</option>
            </select>
          </Field>

          <Field label="Từ ngày">
            <input
              aria-label="Từ ngày"
              type="date"
              value={filters.dateFrom ?? ''}
              onChange={(event) => onFiltersChange((old) => ({ ...old, dateFrom: event.target.value, page: 1 }))}
            />
          </Field>

          <Field label="Đến ngày">
            <input
              aria-label="Đến ngày"
              type="date"
              value={filters.dateTo ?? ''}
              onChange={(event) => onFiltersChange((old) => ({ ...old, dateTo: event.target.value, page: 1 }))}
            />
          </Field>
        </div>
      ) : null}

      {activeFilterCount > 0 ? (
        <div className="admin-support-filter-summary">
          <span>Đang lọc {activeFilterCount} điều kiện</span>
          <button type="button" className="admin-support-filter-reset" onClick={onReset}>
            <X aria-hidden="true" /> Xóa tất cả bộ lọc
          </button>
        </div>
      ) : null}
    </section>
  )
}
