import type { FormEvent } from 'react'
import { AdminEmptyIllustration } from '../../../components/AdminEmptyIllustration'
import type {
  LoyaltyPagination,
  LoyaltyPointHistory,
  LoyaltyUser,
  MembershipRanking,
} from '../loyalty.types'

type HistoryTypeFilter = 'all' | LoyaltyPointHistory['type']

type LoyaltyPointsPanelProps = {
  selectedTierFilter: MembershipRanking | null
  loyaltyUsers: LoyaltyUser[]
  selectedLoyaltyUser: LoyaltyUser | null
  sortedTiers: MembershipRanking[]
  userKeyword: string
  userPagination: LoyaltyPagination
  isSearchingUsers: boolean
  adjustmentDelta: string
  adjustmentReason: string
  adjustmentDeltaError: string | false
  adjustmentReasonError: string | false
  canManageLoyalty: boolean
  isAdjustingPoints: boolean
  historyTypeFilter: HistoryTypeFilter
  historyDateFrom: string
  historyDateTo: string
  pointHistory: LoyaltyPointHistory[]
  filteredPointHistory: LoyaltyPointHistory[]
  pointHistorySummary: { added: number; deducted: number }
  isLoadingHistory: boolean
  historyPagination: LoyaltyPagination
  visibleHistoryPages: number[]
  formatNumber: (value: number | null | undefined) => string
  formatHistoryDate: (value: string) => string
  getHistoryActor: (history: LoyaltyPointHistory) => string
  onClearTierFilter: () => void
  onSearchSubmit: (event: FormEvent<HTMLFormElement>) => void
  onUserKeywordChange: (value: string) => void
  onSelectUser: (user: LoyaltyUser) => void
  onLoadMoreUsers: () => void
  onAdjustSubmit: (event: FormEvent<HTMLFormElement>) => void
  onAdjustmentDeltaChange: (value: string) => void
  onAdjustmentReasonChange: (value: string) => void
  onHistoryTypeChange: (value: HistoryTypeFilter) => void
  onHistoryDateFromChange: (value: string) => void
  onHistoryDateToChange: (value: string) => void
  onClearHistoryDates: () => void
  onExportHistory: () => void
  onLoadHistoryPage: (page: number) => void
}

const historyTypeOptions: Array<{ value: HistoryTypeFilter; label: string }> = [
  { value: 'all', label: 'Tất cả' },
  { value: 'earn', label: 'Cộng' },
  { value: 'redeem', label: 'Đổi điểm' },
  { value: 'adjust', label: 'Điều chỉnh' },
]

export function LoyaltyPointsPanel({
  selectedTierFilter,
  loyaltyUsers,
  selectedLoyaltyUser,
  sortedTiers,
  userKeyword,
  userPagination,
  isSearchingUsers,
  adjustmentDelta,
  adjustmentReason,
  adjustmentDeltaError,
  adjustmentReasonError,
  canManageLoyalty,
  isAdjustingPoints,
  historyTypeFilter,
  historyDateFrom,
  historyDateTo,
  pointHistory,
  filteredPointHistory,
  pointHistorySummary,
  isLoadingHistory,
  historyPagination,
  visibleHistoryPages,
  formatNumber,
  formatHistoryDate,
  getHistoryActor,
  onClearTierFilter,
  onSearchSubmit,
  onUserKeywordChange,
  onSelectUser,
  onLoadMoreUsers,
  onAdjustSubmit,
  onAdjustmentDeltaChange,
  onAdjustmentReasonChange,
  onHistoryTypeChange,
  onHistoryDateFromChange,
  onHistoryDateToChange,
  onClearHistoryDates,
  onExportHistory,
  onLoadHistoryPage,
}: LoyaltyPointsPanelProps) {
  const getUserTierName = (user: LoyaltyUser) =>
    [...sortedTiers].reverse().find((tier) => user.loyaltyPoint >= tier.minPoint)?.name ?? 'Chưa xếp hạng'

  return (
    <section className="admin-loyalty-points" id="loyalty-point-management">
      <div className="admin-section-heading">
        <div>
          <p>Quản lý điểm</p>
          <h2>Điều chỉnh và lịch sử điểm khách hàng</h2>
        </div>
      </div>

      <div className="admin-loyalty-points-grid">
        <div className="admin-loyalty-user-search">
          {selectedTierFilter ? (
            <div className="admin-loyalty-tier-filter">
              <span>Đang xem hạng <strong>{selectedTierFilter.name}</strong></span>
              <button className="admin-link-button" type="button" onClick={onClearTierFilter}>
                Bỏ lọc
              </button>
            </div>
          ) : null}

          <form onSubmit={onSearchSubmit}>
            <label htmlFor="loyalty-user-keyword">Tìm khách hàng</label>
            <div>
              <input
                id="loyalty-user-keyword"
                value={userKeyword}
                onChange={(event) => onUserKeywordChange(event.target.value)}
                placeholder="Tên, email hoặc số điện thoại"
                maxLength={80}
              />
              <button className="admin-secondary-button" type="submit" disabled={isSearchingUsers}>
                {isSearchingUsers ? 'Đang tìm...' : 'Tìm kiếm'}
              </button>
            </div>
          </form>

          <div className="admin-loyalty-user-results">
            {loyaltyUsers.length === 0 ? (
              <p>{isSearchingUsers ? 'Đang tìm khách hàng...' : 'Tìm và chọn khách hàng để quản lý điểm.'}</p>
            ) : loyaltyUsers.map((user) => (
              <button
                className={selectedLoyaltyUser?._id === user._id ? 'is-selected' : ''}
                type="button"
                key={user._id}
                onClick={() => onSelectUser(user)}
              >
                <span>
                  <strong>{user.name}</strong>
                  <small>{user.email}{user.phone ? ` · ${user.phone}` : ''}</small>
                  <em>Hạng: {getUserTierName(user)}</em>
                </span>
                <b>{formatNumber(user.loyaltyPoint)} điểm</b>
              </button>
            ))}
          </div>

          {userPagination.page < userPagination.totalPages ? (
            <button
              className="admin-secondary-button admin-loyalty-load-more"
              type="button"
              disabled={isSearchingUsers}
              onClick={onLoadMoreUsers}
            >
              {isSearchingUsers ? 'Đang tải...' : `Tải thêm (${loyaltyUsers.length}/${userPagination.totalItems})`}
            </button>
          ) : null}
        </div>

        <div className="admin-loyalty-point-detail">
          {!selectedLoyaltyUser ? (
            <div className="admin-loyalty-empty-state">
              <AdminEmptyIllustration variant="customer" />
              <strong>Chưa chọn khách hàng</strong>
              <span>Chọn một khách hàng ở danh sách bên trái để xem lịch sử và điều chỉnh điểm.</span>
            </div>
          ) : (
            <>
              <div className="admin-loyalty-selected-user">
                <span>
                  <strong>{selectedLoyaltyUser.name}</strong>
                  <small>{selectedLoyaltyUser.email}</small>
                </span>
                <b>{formatNumber(selectedLoyaltyUser.loyaltyPoint)} điểm</b>
              </div>

              <form className="admin-loyalty-adjust-form" onSubmit={onAdjustSubmit}>
                <label>
                  <span>Điểm điều chỉnh</span>
                  <input
                    type="number"
                    value={adjustmentDelta}
                    onChange={(event) => onAdjustmentDeltaChange(event.target.value)}
                    placeholder="Ví dụ: 500 hoặc -200"
                    min={-1000000}
                    max={1000000}
                    step={1}
                    required
                  />
                  {adjustmentDeltaError ? <small className="admin-field-error">{adjustmentDeltaError}</small> : null}
                </label>
                <label>
                  <span>Lý do</span>
                  <input
                    value={adjustmentReason}
                    onChange={(event) => onAdjustmentReasonChange(event.target.value)}
                    placeholder="Lý do hỗ trợ/điều chỉnh"
                    minLength={2}
                    maxLength={200}
                    required
                  />
                  {adjustmentReasonError ? <small className="admin-field-error">{adjustmentReasonError}</small> : null}
                </label>
                <button
                  className="admin-primary-button"
                  type="submit"
                  disabled={!canManageLoyalty || isAdjustingPoints}
                >
                  {isAdjustingPoints ? 'Đang cập nhật...' : 'Xác nhận điều chỉnh'}
                </button>
              </form>

              <div className="admin-loyalty-history">
                <div className="admin-loyalty-history-heading">
                  <h3>Lịch sử điểm</h3>
                  <div>
                    {historyTypeOptions.map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        className={historyTypeFilter === type.value ? 'is-active' : ''}
                        onClick={() => onHistoryTypeChange(type.value)}
                      >
                        {type.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={isLoadingHistory || historyPagination.totalItems === 0}
                      onClick={onExportHistory}
                    >
                      Xuất CSV
                    </button>
                  </div>
                </div>

                <div className="admin-loyalty-history-date-filters">
                  <label>
                    <span>Từ ngày</span>
                    <input
                      type="date"
                      value={historyDateFrom}
                      max={historyDateTo || undefined}
                      onChange={(event) => onHistoryDateFromChange(event.target.value)}
                    />
                  </label>
                  <label>
                    <span>Đến ngày</span>
                    <input
                      type="date"
                      value={historyDateTo}
                      min={historyDateFrom || undefined}
                      onChange={(event) => onHistoryDateToChange(event.target.value)}
                    />
                  </label>
                  {historyDateFrom || historyDateTo ? (
                    <button className="admin-link-button" type="button" onClick={onClearHistoryDates}>
                      Xóa ngày
                    </button>
                  ) : null}
                </div>

                <div className="admin-loyalty-history-summary">
                  <span>Cộng <strong>+{formatNumber(pointHistorySummary.added)}</strong></span>
                  <span>Trừ <strong>-{formatNumber(pointHistorySummary.deducted)}</strong></span>
                  <small>Toàn bộ kết quả đã lọc</small>
                </div>

                {isLoadingHistory ? <p>Đang tải lịch sử...</p> : null}
                {!isLoadingHistory && pointHistory.length === 0 ? <p>Chưa có giao dịch điểm.</p> : null}

                {!isLoadingHistory && filteredPointHistory.length > 0 ? (
                  <div className="admin-loyalty-history-list">
                    {filteredPointHistory.map((history) => (
                      <article key={history._id}>
                        <span className={history.delta > 0 ? 'is-positive' : 'is-negative'}>
                          {history.delta > 0 ? '+' : ''}{formatNumber(history.delta)}
                        </span>
                        <div>
                          <strong>{history.reason}</strong>
                          <small>
                            {formatHistoryDate(history.createdAt)} · {getHistoryActor(history)} · Số dư {formatNumber(history.balanceAfter)}
                          </small>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : null}

                {!isLoadingHistory && pointHistory.length > 0 && filteredPointHistory.length === 0 ? (
                  <p>Không có giao dịch thuộc bộ lọc này.</p>
                ) : null}

                {historyPagination.totalPages > 1 ? (
                  <div className="admin-loyalty-pagination">
                    <button
                      className="admin-link-button"
                      type="button"
                      disabled={isLoadingHistory || historyPagination.page <= 1}
                      onClick={() => onLoadHistoryPage(historyPagination.page - 1)}
                    >
                      Trang trước
                    </button>
                    {visibleHistoryPages.map((pageNumber) => (
                      <button
                        className={pageNumber === historyPagination.page ? 'is-active' : 'admin-link-button'}
                        type="button"
                        key={pageNumber}
                        disabled={isLoadingHistory}
                        aria-current={pageNumber === historyPagination.page ? 'page' : undefined}
                        onClick={() => onLoadHistoryPage(pageNumber)}
                      >
                        {pageNumber}
                      </button>
                    ))}
                    <button
                      className="admin-link-button"
                      type="button"
                      disabled={isLoadingHistory || historyPagination.page >= historyPagination.totalPages}
                      onClick={() => onLoadHistoryPage(historyPagination.page + 1)}
                    >
                      Trang sau
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
