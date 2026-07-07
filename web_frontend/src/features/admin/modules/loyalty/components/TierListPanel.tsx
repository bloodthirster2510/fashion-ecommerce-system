import type { MembershipRanking } from '../loyalty.types'
import {
  Button,
  EmptyState,
  Field,
  FilterBar,
  StatusBadge,
} from '../../../components/ui'

type TierStatusFilter = 'all' | 'active' | 'inactive'

type LoyaltyPolicyCard = {
  title: string
  value: string
  note: string
}

type TierListPanelProps = {
  sortedTiers: MembershipRanking[]
  visibleTiers: MembershipRanking[]
  tierKeyword: string
  tierStatusFilter: TierStatusFilter
  warnings: string[]
  policyCards: LoyaltyPolicyCard[]
  iconSymbols: Record<string, string>
  isLoading: boolean
  actionLoading: boolean
  error: string | null
  canManageLoyalty: boolean
  tierBatchProgress: string
  formatNumber: (value: number | null | undefined) => string
  onKeywordChange: (value: string) => void
  onStatusFilterChange: (value: TierStatusFilter) => void
  onReload: () => void
  onCreate: () => void
  onCreateDefaultSet: () => void
  onViewMembers: (tier: MembershipRanking) => void
  onEdit: (tier: MembershipRanking) => void
  onMove: (tier: MembershipRanking, direction: -1 | 1) => void
  onStatusChange: (tier: MembershipRanking, nextActive: boolean) => void
  onDelete: (tier: MembershipRanking) => void
}

export function TierListPanel({
  sortedTiers,
  visibleTiers,
  tierKeyword,
  tierStatusFilter,
  warnings,
  policyCards,
  iconSymbols,
  isLoading,
  actionLoading,
  error,
  canManageLoyalty,
  tierBatchProgress,
  formatNumber,
  onKeywordChange,
  onStatusFilterChange,
  onReload,
  onCreate,
  onCreateDefaultSet,
  onViewMembers,
  onEdit,
  onMove,
  onStatusChange,
  onDelete,
}: TierListPanelProps) {
  return (
    <div className="admin-loyalty-grid">
      <section className={`admin-loyalty-table${isLoading && sortedTiers.length ? ' is-refreshing' : ''}`}>
        <div className="admin-section-heading">
          <div>
            <p>Hạng thành viên</p>
            <h2>Điều kiện điểm và quyền lợi</h2>
          </div>
          {actionLoading ? <span>Đang xử lý...</span> : isLoading ? <span>Đang tải...</span> : null}
        </div>

        {error ? (
          <EmptyState
            title="Không tải được hạng thành viên"
            description={error}
            action={(
              <Button variant="secondary" disabled={isLoading} onClick={onReload}>
                Thử lại
              </Button>
            )}
          />
        ) : null}

        <FilterBar>
          <Field label="Tìm hạng" grow>
            <input
              value={tierKeyword}
              onChange={(event) => onKeywordChange(event.target.value)}
              placeholder="Tìm theo tên hạng hoặc quyền lợi"
            />
          </Field>
          <Field label="Trạng thái">
            <select
              value={tierStatusFilter}
              onChange={(event) => onStatusFilterChange(event.target.value as TierStatusFilter)}
            >
              <option value="all">Tất cả</option>
              <option value="active">Đang áp dụng</option>
              <option value="inactive">Tạm tắt</option>
            </select>
          </Field>
        </FilterBar>

        {warnings.map((warning) => <p className="admin-smart-warning" key={warning}>{warning}</p>)}

        {!isLoading && !error && sortedTiers.length === 0 ? (
          <EmptyState
            title="Chưa có hạng thành viên"
            description="Tạo hạng đầu tiên hoặc dùng bộ hạng mẫu để bắt đầu chương trình thành viên."
            action={(
              <div className="admin-loyalty-empty-actions">
                <Button variant="primary" disabled={!canManageLoyalty} onClick={onCreate}>
                  Thêm hạng
                </Button>
                <Button
                  variant="secondary"
                  disabled={!canManageLoyalty || actionLoading}
                  onClick={onCreateDefaultSet}
                >
                  Tạo bộ hạng mẫu
                </Button>
              </div>
            )}
          />
        ) : null}

        {tierBatchProgress ? <p className="admin-smart-warning" role="status">{tierBatchProgress}</p> : null}

        {sortedTiers.length > 0 && !error ? (
          <div className="admin-tier-ladder" role="list" aria-label="Các hạng thành viên">
            {visibleTiers.length ? visibleTiers.map((tier) => {
              const tierIndex = sortedTiers.findIndex((item) => item._id === tier._id)
              const nextTier = sortedTiers[tierIndex + 1]
              const hasPersistedTier = Boolean(tier._id)
              const isActive = tier.isActive !== false
              const maxPointText = nextTier
                ? formatNumber(Math.max(tier.minPoint, nextTier.minPoint - 1))
                : 'Không giới hạn'

              return (
                <article className="admin-tier-ladder-item" key={tier._id ?? `${tier.level}-${tier.name}`} role="listitem">
                  <div className="admin-tier-ladder-rank">
                    <span>Cấp</span>
                    <strong>{tier.level}</strong>
                  </div>
                  <div
                    className="admin-tier-ladder-card"
                    style={{
                      backgroundColor: tier.cardColor ?? '#5b788a',
                      color: tier.textColor ?? '#ffffff',
                    }}
                  >
                    <span aria-hidden="true" style={{ backgroundColor: tier.badgeColor ?? tier.cardColor ?? '#5b788a' }}>
                      {iconSymbols[tier.iconName ?? 'star'] ?? iconSymbols.star}
                    </span>
                    <strong>{tier.name}</strong>
                  </div>
                  <div className="admin-tier-ladder-main">
                    <div>
                      <h3>{tier.name}</h3>
                      <p>{tier.benefitDescription || 'Chưa mô tả quyền lợi.'}</p>
                    </div>
                    <dl>
                      <div>
                        <dt>Khoảng điểm</dt>
                        <dd>{formatNumber(tier.minPoint)} - {maxPointText}</dd>
                      </div>
                      <div>
                        <dt>Ưu đãi</dt>
                        <dd>{tier.discountPercent}%</dd>
                      </div>
                      <div>
                        <dt>Thành viên</dt>
                        <dd>
                          <button
                            className="admin-link-button"
                            type="button"
                            disabled={!tier._id}
                            onClick={() => onViewMembers(tier)}
                          >
                            {formatNumber(tier.memberCount ?? 0)}
                          </button>
                        </dd>
                      </div>
                      <div>
                        <dt>Trạng thái</dt>
                        <dd>
                          <StatusBadge tone={isActive ? 'success' : 'neutral'}>
                            {isActive ? 'Đang áp dụng' : 'Tạm tắt'}
                          </StatusBadge>
                        </dd>
                      </div>
                    </dl>
                  </div>
                  <div className="admin-tier-ladder-actions">
                    <Button
                      variant="secondary"
                      disabled={!canManageLoyalty || !hasPersistedTier || actionLoading}
                      onClick={() => onEdit(tier)}
                    >
                      Sửa
                    </Button>
                    <details className="admin-action-menu">
                      <summary aria-label={`Thao tác với hạng ${tier.name}`}>•••</summary>
                      <div>
                        <button
                          type="button"
                          disabled={!canManageLoyalty || tierIndex <= 0 || actionLoading}
                          onClick={() => onMove(tier, -1)}
                        >
                          Đưa lên
                        </button>
                        <button
                          type="button"
                          disabled={!canManageLoyalty || tierIndex >= sortedTiers.length - 1 || actionLoading}
                          onClick={() => onMove(tier, 1)}
                        >
                          Đưa xuống
                        </button>
                        <button
                          type="button"
                          disabled={!canManageLoyalty || !hasPersistedTier || actionLoading}
                          onClick={() => onStatusChange(tier, !isActive)}
                        >
                          {isActive ? 'Tạm tắt' : 'Bật lại'}
                        </button>
                        <button
                          className="is-danger"
                          type="button"
                          disabled={!canManageLoyalty || !hasPersistedTier || actionLoading}
                          onClick={() => onDelete(tier)}
                        >
                          Xóa
                        </button>
                      </div>
                    </details>
                  </div>
                </article>
              )
            }) : (
              <EmptyState
                title="Không có hạng phù hợp"
                description="Thử đổi từ khóa hoặc trạng thái lọc để xem lại danh sách hạng."
              />
            )}
          </div>
        ) : null}

        {isLoading && sortedTiers.length ? (
          <div className="admin-table-refresh-indicator" role="status">Đang cập nhật hạng...</div>
        ) : null}
      </section>

      <aside className="admin-loyalty-panel">
        <div className="admin-section-heading">
          <div>
            <p>Quy tắc điểm</p>
            <h2>Luồng vận hành</h2>
          </div>
        </div>

        <div className="admin-loyalty-policy-list">
          {policyCards.map((item) => (
            <div key={item.title}>
              <span>{item.title}</span>
              <strong>{item.value}</strong>
              <p>{item.note}</p>
            </div>
          ))}
        </div>
      </aside>
    </div>
  )
}
