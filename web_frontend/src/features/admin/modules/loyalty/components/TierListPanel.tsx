import type { MembershipRanking } from '../loyalty.types'
import { EmptyState } from '../../../components/ui'

type TierStatusFilter = 'all' | 'active' | 'inactive'

type TierListPanelProps = {
  sortedTiers: MembershipRanking[]
  visibleTiers: MembershipRanking[]
  tierKeyword: string
  tierStatusFilter: TierStatusFilter
  warnings: string[]
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
    <section className={`admin-catalog-section admin-loyalty-section${isLoading && sortedTiers.length ? ' is-refreshing' : ''}`}>
      <header>
        <div>
          <h2>Hạng thành viên</h2>
          {actionLoading ? <span>Đang xử lý...</span> : isLoading ? <span>Đang tải...</span> : null}
        </div>
      </header>

      {error ? (
        <EmptyState
          title="Không tải được hạng thành viên"
          description={error}
          action={(
            <button className="admin-secondary-button" type="button" disabled={isLoading} onClick={onReload}>
              Thử lại
            </button>
          )}
        />
      ) : null}

      <div className="admin-catalog-filters admin-loyalty-filters">
        <input
          type="search"
          value={tierKeyword}
          onChange={(event) => onKeywordChange(event.target.value)}
          placeholder="Tìm kiếm hạng thành viên..."
          aria-label="Tìm kiếm hạng thành viên"
        />
        <select
          value={tierStatusFilter}
          onChange={(event) => onStatusFilterChange(event.target.value as TierStatusFilter)}
          aria-label="Lọc trạng thái hạng thành viên"
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="active">Đang áp dụng</option>
          <option value="inactive">Tạm tắt</option>
        </select>
        <button
          className="admin-secondary-button"
          type="button"
          onClick={() => {
            onKeywordChange('')
            onStatusFilterChange('all')
          }}
        >
          Đặt lại
        </button>
      </div>

      {warnings.map((warning) => <p className="admin-smart-warning" key={warning}>{warning}</p>)}

      {!isLoading && !error && sortedTiers.length === 0 ? (
        <EmptyState
          title="Chưa có hạng thành viên"
          description="Tạo hạng đầu tiên hoặc dùng bộ hạng mẫu để bắt đầu chương trình thành viên."
          action={(
            <div className="admin-loyalty-empty-actions">
              <button className="admin-primary-button" type="button" disabled={!canManageLoyalty} onClick={onCreate}>
                + Thêm hạng
              </button>
              <button
                className="admin-secondary-button"
                type="button"
                disabled={!canManageLoyalty || actionLoading}
                onClick={onCreateDefaultSet}
              >
                Tạo bộ hạng mẫu
              </button>
            </div>
          )}
        />
      ) : null}

      {tierBatchProgress ? <p className="admin-smart-warning" role="status">{tierBatchProgress}</p> : null}

      {sortedTiers.length > 0 && !error ? (
        <div className="admin-table-shell">
          <table className="admin-table admin-loyalty-tier-table">
            <thead>
              <tr>
                <th>Cấp</th>
                <th>Thẻ</th>
                <th>Hạng thành viên</th>
                <th>Khoảng điểm</th>
                <th>Ưu đãi</th>
                <th>Thành viên</th>
                <th>Trạng thái</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {visibleTiers.length ? visibleTiers.map((tier) => {
                const tierIndex = sortedTiers.findIndex((item) => item._id === tier._id)
                const nextTier = sortedTiers[tierIndex + 1]
                const hasPersistedTier = Boolean(tier._id)
                const isActive = tier.isActive !== false
                const maxPointText = nextTier
                  ? formatNumber(Math.max(tier.minPoint, nextTier.minPoint - 1))
                  : 'Không giới hạn'

                return (
                  <tr key={tier._id ?? `${tier.level}-${tier.name}`}>
                    <td>
                      <span className="admin-tier-level-badge">
                        Cấp
                        <strong>{tier.level}</strong>
                      </span>
                    </td>
                    <td>
                      <span
                        className="admin-loyalty-visual-preview"
                        style={{
                          backgroundColor: tier.cardColor ?? '#5b788a',
                          color: tier.textColor ?? '#ffffff',
                        }}
                      >
                        <span aria-hidden="true" style={{ backgroundColor: tier.badgeColor ?? tier.cardColor ?? '#5b788a' }}>
                          {iconSymbols[tier.iconName ?? 'star'] ?? iconSymbols.star}
                        </span>
                        <strong>{tier.name}</strong>
                      </span>
                    </td>
                    <td>
                      <span className="admin-loyalty-tier-cell">
                        <strong>{tier.name}</strong>
                        <small>{tier.benefitDescription || 'Chưa mô tả quyền lợi.'}</small>
                      </span>
                    </td>
                    <td>{formatNumber(tier.minPoint)} - {maxPointText}</td>
                    <td>{tier.discountPercent}%</td>
                    <td>
                      <button
                        className="admin-link-button admin-loyalty-member-link"
                        type="button"
                        disabled={!tier._id}
                        onClick={() => onViewMembers(tier)}
                      >
                        {formatNumber(tier.memberCount ?? 0)}
                      </button>
                    </td>
                    <td>
                      <span className={`admin-status-pill ${isActive ? 'is-active' : 'is-blocked'}`}>
                        {isActive ? 'Đang áp dụng' : 'Tạm tắt'}
                      </span>
                    </td>
                    <td>
                      <div className="admin-row-actions-wrapper">
                        <div className="admin-row-actions">
                          <button
                            className="admin-link-button"
                            type="button"
                            disabled={!canManageLoyalty || !hasPersistedTier || actionLoading}
                            onClick={() => onEdit(tier)}
                          >
                            Sửa
                          </button>
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
                      </div>
                    </td>
                  </tr>
                )
              }) : (
                <tr>
                  <td colSpan={8}>
                    <div className="admin-table-loading">Không có hạng phù hợp.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {isLoading && sortedTiers.length ? (
        <div className="admin-table-refresh-indicator" role="status">Đang cập nhật hạng...</div>
      ) : null}
    </section>
  )
}
