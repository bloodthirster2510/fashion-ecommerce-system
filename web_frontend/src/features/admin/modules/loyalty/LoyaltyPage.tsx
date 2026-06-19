import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import type { AdminUser } from '../auth/adminSession'
import { useDialogAccessibility } from '../../hooks/useDialogAccessibility'
import {
  adjustLoyaltyPoints,
  createMembershipRanking,
  deleteMembershipRanking,
  listLoyaltyPointHistory,
  listLoyaltyUsers,
  listMembershipRankings,
  updateMembershipRanking,
  updateMembershipRankingStatus,
} from './loyalty.service'
import type {
  LoyaltyPagination,
  LoyaltyPointHistory,
  LoyaltyUser,
  MembershipRanking,
  MembershipRankingPayload,
} from './loyalty.types'
import './loyalty.css'
import { LoyaltyRulesPanel } from './components/LoyaltyRulesPanel'

type LoyaltyPageProps = {
  currentUser: AdminUser
}

type Notice = {
  type: 'success' | 'error'
  message: string
}

type TierFormState = {
  name: string
  level: string
  minPoint: string
  maxPoint: string
  discountPercent: string
  benefitDescription: string
  cardColor: string
  textColor: string
  badgeColor: string
  iconName: string
  isActive: boolean
}

type DialogState =
  | { type: 'create' }
  | { type: 'edit'; tier: MembershipRanking }
  | { type: 'status'; tier: MembershipRanking; nextActive: boolean }
  | { type: 'delete'; tier: MembershipRanking }
  | null

const formatNumber = (value: number | null | undefined) =>
  typeof value === 'number' ? new Intl.NumberFormat('vi-VN').format(value) : 'Không giới hạn'

const emptyPagination: LoyaltyPagination = {
  page: 1,
  limit: 10,
  totalItems: 0,
  totalPages: 0,
}

const formatHistoryDate = (value: string) => new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'short',
}).format(new Date(value))

const getHistoryActor = (history: LoyaltyPointHistory) => {
  if (history.actorId && typeof history.actorId === 'object') {
    return history.actorId.name
  }

  const roleLabels: Record<LoyaltyPointHistory['actorRole'], string> = {
    admin: 'Admin',
    staff: 'Nhân viên',
    system: 'Hệ thống',
    user: 'Khách hàng',
  }
  return roleLabels[history.actorRole]
}

const emptyTierForm: TierFormState = {
  name: '',
  level: '',
  minPoint: '',
  maxPoint: '',
  discountPercent: '',
  benefitDescription: '',
  cardColor: '#5b788a',
  textColor: '#ffffff',
  badgeColor: '#5b788a',
  iconName: 'star',
  isActive: true,
}

const iconOptions = [
  { value: 'star', label: 'Star' },
  { value: 'shield-star', label: 'Shield star' },
  { value: 'crown', label: 'Crown' },
  { value: 'diamond-stone', label: 'Diamond' },
  { value: 'medal-outline', label: 'Medal' },
  { value: 'trophy-outline', label: 'Trophy' },
  { value: 'certificate-outline', label: 'Certificate' },
]

const membershipIconSymbols: Record<string, string> = {
  star: '★',
  'shield-star': '✦',
  crown: '♛',
  'diamond-stone': '◆',
  certificate: '✪',
  'certificate-outline': '☆',
}

const policyCards = [
  {
    title: 'Cộng điểm',
    value: 'floor(totalAmount / 1000)',
    note: 'Chỉ cộng khi đơn chuyển sang delivered.',
  },
  {
    title: 'Trừ điểm',
    value: 'Adjustment âm',
    note: 'Áp dụng khi hoàn/trả sau khi đã cộng điểm.',
  },
  {
    title: 'Giảm theo hạng',
    value: 'Sau coupon sản phẩm',
    note: 'Ghi vào Order.membershipDiscountAmount.',
  },
]

const integrationChecks = [
  'Coupon có thể giới hạn theo eligibleMembershipRanks.',
  'Checkout lấy tier từ loyaltyPoint hiện tại.',
  'Khách hàng xem hạng, điểm và tiến trình nâng hạng ở profile.',
  'Support có category membership để xử lý khiếu nại điểm/hạng.',
  'Thay đổi hạng/quy tắc điểm cần ghi audit log.',
]

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Không thể xử lý yêu cầu'

const toTierForm = (tier: MembershipRanking): TierFormState => ({
  name: tier.name,
  level: String(tier.level),
  minPoint: String(tier.minPoint),
  maxPoint: tier.maxPoint === null || tier.maxPoint === undefined ? '' : String(tier.maxPoint),
  discountPercent: String(tier.discountPercent),
  benefitDescription: tier.benefitDescription ?? '',
  cardColor: tier.cardColor ?? '#5b788a',
  textColor: tier.textColor ?? '#ffffff',
  badgeColor: tier.badgeColor ?? tier.cardColor ?? '#5b788a',
  iconName: tier.iconName ?? 'star',
  isActive: tier.isActive !== false,
})

const getRelativeLuminance = (hexColor: string) => {
  const channels = hexColor.slice(1).match(/.{2}/g)
  if (!channels || channels.length !== 3) {
    return 0
  }

  const [red, green, blue] = channels.map((channel) => {
    const value = Number.parseInt(channel, 16) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

const getContrastRatio = (firstColor: string, secondColor: string) => {
  const first = getRelativeLuminance(firstColor)
  const second = getRelativeLuminance(secondColor)
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}

const toTierPayload = (form: TierFormState): MembershipRankingPayload => {
  const name = form.name.trim()
  const level = Number(form.level)
  const minPoint = Number(form.minPoint)
  const discountPercent = Number(form.discountPercent)

  if (name.length < 2) {
    throw new Error('Tên hạng phải có ít nhất 2 ký tự')
  }

  if (!Number.isInteger(level) || level < 1 || level > 20) {
    throw new Error('Level phải là số nguyên từ 1 đến 20')
  }

  if (!Number.isInteger(minPoint) || minPoint < 0 || minPoint > 100000000) {
    throw new Error('Điểm tối thiểu phải là số nguyên từ 0 đến 100.000.000')
  }

  if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
    throw new Error('Mức giảm giá phải nằm trong khoảng 0-100%')
  }

  if (getContrastRatio(form.cardColor, form.textColor) < 4.5) {
    throw new Error('Màu chữ và màu nền thẻ chưa đủ tương phản')
  }

  return {
    name,
    level,
    minPoint,
    discountPercent,
    benefitDescription: form.benefitDescription.trim(),
    cardColor: form.cardColor,
    textColor: form.textColor,
    badgeColor: form.badgeColor,
    iconName: form.iconName,
    isActive: form.isActive,
  }
}

export function LoyaltyPage({ currentUser }: LoyaltyPageProps) {
  const [tiers, setTiers] = useState<MembershipRanking[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [dialog, setDialog] = useState<DialogState>(null)
  const [tierForm, setTierForm] = useState<TierFormState>(emptyTierForm)
  const [userKeyword, setUserKeyword] = useState('')
  const [loyaltyUsers, setLoyaltyUsers] = useState<LoyaltyUser[]>([])
  const [isSearchingUsers, setIsSearchingUsers] = useState(false)
  const [selectedTierFilter, setSelectedTierFilter] = useState<MembershipRanking | null>(null)
  const [selectedLoyaltyUser, setSelectedLoyaltyUser] = useState<LoyaltyUser | null>(null)
  const [pointHistory, setPointHistory] = useState<LoyaltyPointHistory[]>([])
  const [historyPagination, setHistoryPagination] = useState<LoyaltyPagination>(emptyPagination)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [adjustmentDelta, setAdjustmentDelta] = useState('')
  const [adjustmentReason, setAdjustmentReason] = useState('')
  const [isAdjustingPoints, setIsAdjustingPoints] = useState(false)

  const canManageLoyalty =
    currentUser.role === 'admin' || currentUser.permissions?.includes('loyalty.write') === true

  const loadTiers = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const data = await listMembershipRankings()
      setTiers(data)
    } catch (err) {
      setError(getErrorMessage(err))
      setTiers([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTiers()
  }, [loadTiers])

  useEffect(() => {
    if (!notice) {
      return
    }

    const handle = window.setTimeout(() => setNotice(null), 5000)
    return () => window.clearTimeout(handle)
  }, [notice])

  const sortedTiers = useMemo(
    () => [...tiers].sort((a, b) => a.level - b.level),
    [tiers],
  )

  const activeTierCount = sortedTiers.filter((tier) => tier.isActive !== false).length
  const highestTier = sortedTiers[sortedTiers.length - 1]

  const replaceTier = (updatedTier: MembershipRanking) => {
    setTiers((currentTiers) =>
      currentTiers.map((tier) => (tier._id === updatedTier._id ? updatedTier : tier)),
    )
  }

  const openCreateDialog = () => {
    setTierForm(emptyTierForm)
    setNotice(null)
    setDialog({ type: 'create' })
  }

  const openEditDialog = (tier: MembershipRanking) => {
    setTierForm(toTierForm(tier))
    setNotice(null)
    setDialog({ type: 'edit', tier })
  }

  const openDeleteDialog = (tier: MembershipRanking) => {
    setNotice(null)
    setDialog({ type: 'delete', tier })
  }

  const openStatusDialog = (tier: MembershipRanking, nextActive: boolean) => {
    setNotice(null)
    setDialog({ type: 'status', tier, nextActive })
  }

  const closeDialog = () => {
    if (!actionLoading) {
      setDialog(null)
    }
  }

  const handleSubmitTier = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!dialog || dialog.type === 'delete') {
      return
    }

    setActionLoading(true)
    setNotice(null)

    try {
      const payload = toTierPayload(tierForm)

      if (dialog.type === 'create') {
        await createMembershipRanking(payload)
        setNotice({ type: 'success', message: 'Đã thêm hạng thành viên' })
      } else {
        if (!dialog.tier._id) {
          throw new Error('Không tìm thấy mã hạng thành viên')
        }

        const updatedTier = await updateMembershipRanking(dialog.tier._id, payload)
        replaceTier(updatedTier)
        setNotice({ type: 'success', message: 'Đã cập nhật hạng thành viên' })
      }

      setDialog(null)
      await loadTiers()
    } catch (err) {
      setNotice({ type: 'error', message: getErrorMessage(err) })
    } finally {
      setActionLoading(false)
    }
  }

  const handleStatusChange = async (tier: MembershipRanking, nextActive: boolean) => {
    if (!tier._id) {
      return false
    }

    setActionLoading(true)
    setNotice(null)

    try {
      await updateMembershipRankingStatus(tier._id, nextActive)
      await loadTiers()
      setNotice({
        type: 'success',
        message: nextActive ? 'Đã bật lại hạng thành viên' : 'Đã tạm tắt hạng thành viên',
      })
      return true
    } catch (err) {
      setNotice({ type: 'error', message: getErrorMessage(err) })
      return false
    } finally {
      setActionLoading(false)
    }
  }

  const handleConfirmStatusChange = async () => {
    if (!dialog || dialog.type !== 'status') {
      return
    }

    const didUpdate = await handleStatusChange(dialog.tier, dialog.nextActive)
    if (didUpdate) {
      setDialog(null)
    }
  }

  const handleDeleteTier = async () => {
    if (!dialog || dialog.type !== 'delete' || !dialog.tier._id) {
      return
    }

    setActionLoading(true)
    setNotice(null)

    try {
      await deleteMembershipRanking(dialog.tier._id)
      setTiers((currentTiers) => currentTiers.filter((tier) => tier._id !== dialog.tier._id))
      setDialog(null)
      setNotice({ type: 'success', message: 'Đã xóa hạng thành viên' })
    } catch (err) {
      setNotice({ type: 'error', message: getErrorMessage(err) })
    } finally {
      setActionLoading(false)
    }
  }

  const dialogRef = useDialogAccessibility(Boolean(dialog), closeDialog, !actionLoading)

  const loadPointHistory = useCallback(async (userId: string, page = 1) => {
    setIsLoadingHistory(true)

    try {
      const result = await listLoyaltyPointHistory(userId, page)
      setPointHistory(result.items)
      setHistoryPagination(result.pagination)
    } catch (err) {
      setNotice({ type: 'error', message: getErrorMessage(err) })
      setPointHistory([])
      setHistoryPagination(emptyPagination)
    } finally {
      setIsLoadingHistory(false)
    }
  }, [])

  const handleSearchLoyaltyUsers = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSearchingUsers(true)
    setNotice(null)

    try {
      const result = await listLoyaltyUsers(userKeyword, 1, 10, selectedTierFilter?._id)
      setLoyaltyUsers(result.items)
    } catch (err) {
      setNotice({ type: 'error', message: getErrorMessage(err) })
      setLoyaltyUsers([])
    } finally {
      setIsSearchingUsers(false)
    }
  }

  const handleViewTierMembers = async (tier: MembershipRanking) => {
    if (!tier._id) {
      return
    }

    setSelectedTierFilter(tier)
    setUserKeyword('')
    setIsSearchingUsers(true)
    setNotice(null)

    try {
      const result = await listLoyaltyUsers('', 1, 10, tier._id)
      setLoyaltyUsers(result.items)
      document.getElementById('loyalty-point-management')?.scrollIntoView({ behavior: 'smooth' })
    } catch (err) {
      setNotice({ type: 'error', message: getErrorMessage(err) })
      setLoyaltyUsers([])
    } finally {
      setIsSearchingUsers(false)
    }
  }

  const handleClearTierFilter = async () => {
    setSelectedTierFilter(null)
    setIsSearchingUsers(true)

    try {
      const result = await listLoyaltyUsers(userKeyword)
      setLoyaltyUsers(result.items)
    } catch (err) {
      setNotice({ type: 'error', message: getErrorMessage(err) })
    } finally {
      setIsSearchingUsers(false)
    }
  }

  const handleSelectLoyaltyUser = (user: LoyaltyUser) => {
    setSelectedLoyaltyUser(user)
    setAdjustmentDelta('')
    setAdjustmentReason('')
    void loadPointHistory(user._id)
  }

  const handleAdjustPoints = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedLoyaltyUser) {
      return
    }

    const delta = Number(adjustmentDelta)
    const reason = adjustmentReason.trim()
    if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 1000000) {
      setNotice({ type: 'error', message: 'Điểm điều chỉnh phải là số nguyên khác 0, tối đa 1.000.000 điểm' })
      return
    }
    if (reason.length < 2 || reason.length > 200) {
      setNotice({ type: 'error', message: 'Lý do phải có từ 2 đến 200 ký tự' })
      return
    }

    setIsAdjustingPoints(true)
    setNotice(null)

    try {
      const result = await adjustLoyaltyPoints({
        userId: selectedLoyaltyUser._id,
        delta,
        reason,
      })
      setSelectedLoyaltyUser((current) => current ? { ...current, ...result.user } : current)
      setLoyaltyUsers((users) => users.map((user) => (
        user._id === result.user._id ? { ...user, ...result.user } : user
      )))
      setAdjustmentDelta('')
      setAdjustmentReason('')
      setNotice({
        type: 'success',
        message: `Đã điều chỉnh từ ${formatNumber(result.balanceBefore)} thành ${formatNumber(result.balanceAfter)} điểm`,
      })
      await Promise.all([loadPointHistory(selectedLoyaltyUser._id), loadTiers()])
    } catch (err) {
      setNotice({ type: 'error', message: getErrorMessage(err) })
    } finally {
      setIsAdjustingPoints(false)
    }
  }

  return (
    <section className="admin-loyalty-page">
      <div className="admin-page-heading">
        <div>
          <p>Khách hàng / Membership</p>
          <h1>Chương trình thành viên</h1>
        </div>

        <button
          className="admin-primary-button"
          type="button"
          disabled={!canManageLoyalty}
          onClick={openCreateDialog}
        >
          Thêm hạng
        </button>
      </div>

      <div className="admin-notice admin-loyalty-notice">
        <strong>Admin có thể quản lý hạng, điểm tích lũy và quyền lợi khách hàng tại đây.</strong>
        <span>
          Điểm được cộng khi đơn giao thành công, thu hồi khi hoàn trả và lưu lịch sử theo từng đơn hàng.
        </span>
      </div>

      {notice ? (
        <p className={`admin-notice is-${notice.type}`} role="status">
          {notice.message}
        </p>
      ) : null}

      <div className="admin-user-stats admin-loyalty-stats">
        <div>
          <span>Hạng đang hoạt động</span>
          <strong>{activeTierCount}</strong>
        </div>
        <div>
          <span>Hạng cao nhất</span>
          <strong>{highestTier?.name ?? 'N/A'}</strong>
        </div>
        <div>
          <span>Ưu đãi tối đa</span>
          <strong>{highestTier ? `${highestTier.discountPercent}%` : '0%'}</strong>
        </div>
      </div>

      <div className="admin-loyalty-grid">
        <section className="admin-table-shell admin-loyalty-table">
          <div className="admin-section-heading">
            <div>
              <p>Cấu hình hạng</p>
              <h2>Điều kiện điểm và quyền lợi</h2>
            </div>
            {actionLoading ? <span>Đang xử lý...</span> : isLoading ? <span>Đang tải...</span> : null}
          </div>

          {error ? (
            <div className="admin-notice is-error admin-loyalty-load-error">
              <span>{error}</span>
              <button
                className="admin-link-button"
                type="button"
                disabled={isLoading}
                onClick={() => void loadTiers()}
              >
                Thử lại
              </button>
            </div>
          ) : null}

          <table className="admin-table">
            <thead>
              <tr>
                <th>Hạng</th>
                <th>Điểm yêu cầu</th>
                <th>Giảm giá</th>
                <th>Quyền lợi</th>
                <th>Thành viên</th>
                <th>Hiển thị</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8}>
                    <div className="admin-table-loading">Đang tải hạng thành viên...</div>
                  </td>
                </tr>
              ) : null}

              {!isLoading && !error && sortedTiers.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="admin-loyalty-empty-state">
                      <strong>Chưa có hạng thành viên nào</strong>
                      <span>Bấm “Thêm hạng” để bắt đầu cấu hình chương trình loyalty.</span>
                      <button
                        className="admin-secondary-button"
                        type="button"
                        disabled={!canManageLoyalty}
                        onClick={openCreateDialog}
                      >
                        Thêm hạng
                      </button>
                    </div>
                  </td>
                </tr>
              ) : null}

              {!isLoading ? sortedTiers.map((tier, index) => {
                const hasPersistedTier = Boolean(tier._id)
                const isActive = tier.isActive !== false

                return (
                  <tr key={tier._id ?? `${tier.level}-${tier.name}-${index}`}>
                    <td>
                      <strong>{tier.name}</strong>
                      <span>Level {tier.level}</span>
                    </td>
                    <td>
                      {formatNumber(tier.minPoint)} - {formatNumber(tier.maxPoint)}
                    </td>
                    <td>{tier.discountPercent}%</td>
                    <td>{tier.benefitDescription || 'Chưa mô tả'}</td>
                    <td>
                      <button
                        className="admin-link-button admin-loyalty-member-link"
                        type="button"
                        disabled={!hasPersistedTier}
                        onClick={() => void handleViewTierMembers(tier)}
                      >
                        {formatNumber(tier.memberCount ?? 0)}
                      </button>
                    </td>
                    <td>
                      <div
                        className="admin-loyalty-visual-preview"
                        style={{
                          backgroundColor: tier.cardColor ?? '#5b788a',
                          color: tier.textColor ?? '#ffffff',
                        }}
                      >
                        <span
                          aria-hidden="true"
                          style={{ backgroundColor: tier.badgeColor ?? tier.cardColor ?? '#5b788a' }}
                        />
                        <strong title={tier.iconName ?? 'star'} aria-label={tier.iconName ?? 'star'}>
                          {membershipIconSymbols[tier.iconName ?? 'star'] ?? membershipIconSymbols.star}
                        </strong>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`admin-status-pill${isActive ? ' is-active' : ' is-blocked'}`}
                      >
                        {isActive ? 'Hoạt động' : 'Tạm tắt'}
                      </span>
                    </td>
                    <td>
                      <div className="admin-row-actions">
                        <button
                          className="admin-link-button"
                          type="button"
                          disabled={!canManageLoyalty || !hasPersistedTier || actionLoading}
                          onClick={() => openEditDialog(tier)}
                        >
                          Sửa
                        </button>
                        <button
                          className={isActive ? 'admin-danger-link' : 'admin-link-button'}
                          type="button"
                          disabled={!canManageLoyalty || !hasPersistedTier || actionLoading}
                          onClick={() => openStatusDialog(tier, !isActive)}
                        >
                          {isActive ? 'Tắt' : 'Bật'}
                        </button>
                        <button
                          className="admin-danger-link"
                          type="button"
                          disabled={!canManageLoyalty || !hasPersistedTier || actionLoading}
                          onClick={() => openDeleteDialog(tier)}
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              }) : null}
            </tbody>
          </table>
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
                <button className="admin-link-button" type="button" onClick={() => void handleClearTierFilter()}>
                  Bỏ lọc
                </button>
              </div>
            ) : null}
            <form onSubmit={handleSearchLoyaltyUsers}>
              <label htmlFor="loyalty-user-keyword">Tìm khách hàng</label>
              <div>
                <input
                  id="loyalty-user-keyword"
                  value={userKeyword}
                  onChange={(event) => setUserKeyword(event.target.value)}
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
                  onClick={() => handleSelectLoyaltyUser(user)}
                >
                  <span>
                    <strong>{user.name}</strong>
                    <small>{user.email}{user.phone ? ` · ${user.phone}` : ''}</small>
                  </span>
                  <b>{formatNumber(user.loyaltyPoint)} điểm</b>
                </button>
              ))}
            </div>
          </div>

          <div className="admin-loyalty-point-detail">
            {!selectedLoyaltyUser ? (
              <div className="admin-loyalty-empty-state">
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

                <form className="admin-loyalty-adjust-form" onSubmit={handleAdjustPoints}>
                  <label>
                    <span>Điểm điều chỉnh</span>
                    <input
                      type="number"
                      value={adjustmentDelta}
                      onChange={(event) => setAdjustmentDelta(event.target.value)}
                      placeholder="Ví dụ: 500 hoặc -200"
                      min={-1000000}
                      max={1000000}
                      step={1}
                      required
                    />
                  </label>
                  <label>
                    <span>Lý do</span>
                    <input
                      value={adjustmentReason}
                      onChange={(event) => setAdjustmentReason(event.target.value)}
                      placeholder="Lý do hỗ trợ/điều chỉnh"
                      minLength={2}
                      maxLength={200}
                      required
                    />
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
                  <h3>Lịch sử điểm</h3>
                  {isLoadingHistory ? <p>Đang tải lịch sử...</p> : null}
                  {!isLoadingHistory && pointHistory.length === 0 ? <p>Chưa có giao dịch điểm.</p> : null}
                  {!isLoadingHistory && pointHistory.length > 0 ? (
                    <div className="admin-loyalty-history-list">
                      {pointHistory.map((history) => (
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
                  {historyPagination.totalPages > 1 ? (
                    <div className="admin-loyalty-pagination">
                      <button
                        className="admin-link-button"
                        type="button"
                        disabled={isLoadingHistory || historyPagination.page <= 1}
                        onClick={() => void loadPointHistory(selectedLoyaltyUser._id, historyPagination.page - 1)}
                      >
                        Trang trước
                      </button>
                      <span>{historyPagination.page}/{historyPagination.totalPages}</span>
                      <button
                        className="admin-link-button"
                        type="button"
                        disabled={isLoadingHistory || historyPagination.page >= historyPagination.totalPages}
                        onClick={() => void loadPointHistory(selectedLoyaltyUser._id, historyPagination.page + 1)}
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

      <LoyaltyRulesPanel currentUser={currentUser} />

      <section className="admin-loyalty-impact">
        <div className="admin-section-heading">
          <div>
            <p>Liên kết nghiệp vụ</p>
            <h2>Những nơi bị ảnh hưởng khi đổi loyalty</h2>
          </div>
        </div>

        <div className="admin-loyalty-impact-list">
          {integrationChecks.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </section>

      {dialog?.type === 'create' || dialog?.type === 'edit' ? (
        <div ref={dialogRef} tabIndex={-1} className="admin-confirm-layer" role="dialog" aria-modal="true" aria-labelledby="admin-tier-dialog-title">
          <form className="admin-account-dialog" onSubmit={handleSubmitTier}>
            <h2 id="admin-tier-dialog-title">
              {dialog.type === 'create' ? 'Thêm hạng thành viên' : 'Sửa hạng thành viên'}
            </h2>
            <div className="admin-account-form-grid">
              <label>
                <span>Tên hạng</span>
                <input
                  value={tierForm.name}
                  onChange={(event) => setTierForm((form) => ({ ...form, name: event.target.value }))}
                  required
                  minLength={2}
                  maxLength={30}
                />
              </label>
              <label>
                <span>Cấp hạng</span>
                <input
                  type="number"
                  value={tierForm.level}
                  onChange={(event) => setTierForm((form) => ({ ...form, level: event.target.value }))}
                  required
                  min={1}
                  max={20}
                />
              </label>
              <label>
                <span>Điểm tối thiểu</span>
                <input
                  type="number"
                  value={tierForm.minPoint}
                  onChange={(event) => setTierForm((form) => ({ ...form, minPoint: event.target.value }))}
                  required
                  min={0}
                  max={100000000}
                />
              </label>
              <label>
                <span>Điểm tối đa (tự tính)</span>
                <input
                  type="text"
                  value={tierForm.maxPoint || 'Theo mốc hạng kế tiếp'}
                  disabled
                />
              </label>
              <label>
                <span>Giảm giá (%)</span>
                <input
                  type="number"
                  value={tierForm.discountPercent}
                  onChange={(event) =>
                    setTierForm((form) => ({ ...form, discountPercent: event.target.value }))
                  }
                  required
                  min={0}
                  max={100}
                  step={0.1}
                />
              </label>
              <label>
                <span>Trạng thái</span>
                <select
                  value={tierForm.isActive ? 'active' : 'inactive'}
                  onChange={(event) =>
                    setTierForm((form) => ({ ...form, isActive: event.target.value === 'active' }))
                  }
                >
                  <option value="active">Hoạt động</option>
                  <option value="inactive">Tạm tắt</option>
                </select>
              </label>
              <label>
                <span>Màu thẻ</span>
                <input
                  type="color"
                  value={tierForm.cardColor}
                  onChange={(event) => setTierForm((form) => ({ ...form, cardColor: event.target.value }))}
                />
              </label>
              <label>
                <span>Màu chữ</span>
                <input
                  type="color"
                  value={tierForm.textColor}
                  onChange={(event) => setTierForm((form) => ({ ...form, textColor: event.target.value }))}
                />
              </label>
              <label>
                <span>Màu badge</span>
                <input
                  type="color"
                  value={tierForm.badgeColor}
                  onChange={(event) => setTierForm((form) => ({ ...form, badgeColor: event.target.value }))}
                />
              </label>
              <label>
                <span>Icon</span>
                <select
                  value={tierForm.iconName}
                  onChange={(event) => setTierForm((form) => ({ ...form, iconName: event.target.value }))}
                >
                  {iconOptions.map((icon) => (
                    <option key={icon.value} value={icon.value}>
                      {icon.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              <span>Quyền lợi</span>
              <textarea
                value={tierForm.benefitDescription}
                onChange={(event) =>
                  setTierForm((form) => ({ ...form, benefitDescription: event.target.value }))
                }
                required
                minLength={2}
                maxLength={200}
                rows={3}
              />
            </label>
            <div className="admin-dialog-actions">
              <button className="admin-secondary-button" type="button" disabled={actionLoading} onClick={closeDialog}>
                Hủy
              </button>
              <button className="admin-primary-button" type="submit" disabled={actionLoading}>
                {actionLoading ? 'Đang lưu...' : 'Lưu hạng'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {dialog?.type === 'status' ? (
        <div ref={dialogRef} tabIndex={-1} className="admin-confirm-layer" role="dialog" aria-modal="true" aria-labelledby="admin-tier-status-title">
          <div className="admin-confirm-box">
            <h2 id="admin-tier-status-title">
              {dialog.nextActive ? 'Bật lại hạng?' : 'Tạm tắt hạng?'}
            </h2>
            <p>
              Hạng {dialog.tier.name} sẽ {dialog.nextActive ? 'được bật lại cho khách hàng đủ điểm.' : 'ngừng áp dụng cho khách hàng và voucher tham chiếu hạng này.'}
            </p>
            <div className="admin-dialog-actions">
              <button className="admin-secondary-button" type="button" disabled={actionLoading} onClick={closeDialog}>
                Hủy
              </button>
              <button
                className={dialog.nextActive ? 'admin-primary-button' : 'admin-danger-button'}
                type="button"
                disabled={actionLoading}
                onClick={() => void handleConfirmStatusChange()}
              >
                {actionLoading ? 'Đang xử lý...' : dialog.nextActive ? 'Bật lại' : 'Tạm tắt'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {dialog?.type === 'delete' ? (
        <div ref={dialogRef} tabIndex={-1} className="admin-confirm-layer" role="dialog" aria-modal="true" aria-labelledby="admin-tier-delete-title">
          <div className="admin-confirm-box">
            <h2 id="admin-tier-delete-title">Xóa hạng thành viên?</h2>
            <p>
              Chỉ có thể xóa hạng {dialog.tier.name} khi đây không phải hạng cơ bản và chưa có
              thành viên đang thuộc hạng.
            </p>
            <div className="admin-dialog-actions">
              <button className="admin-secondary-button" type="button" disabled={actionLoading} onClick={closeDialog}>
                Hủy
              </button>
              <button
                className="admin-danger-button"
                type="button"
                disabled={actionLoading}
                onClick={() => void handleDeleteTier()}
              >
                {actionLoading ? 'Đang xử lý...' : 'Xóa hạng'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
