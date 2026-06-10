import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import type { AdminUser } from '../adminSession'
import {
  createMembershipRanking,
  deleteMembershipRanking,
  listMembershipRankings,
  updateMembershipRanking,
  updateMembershipRankingStatus,
  type MembershipRanking,
  type MembershipRankingPayload,
} from './loyaltyAdminApi'

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
  | { type: 'delete'; tier: MembershipRanking }
  | null

const formatNumber = (value: number | null | undefined) =>
  typeof value === 'number' ? new Intl.NumberFormat('vi-VN').format(value) : 'Không giới hạn'

const defaultTiers: MembershipRanking[] = [
  {
    name: 'Member',
    level: 1,
    minPoint: 0,
    maxPoint: 1999,
    discountPercent: 0,
    benefitDescription: 'Tích điểm đổi quà/voucher',
    cardColor: '#5b788a',
    textColor: '#ffffff',
    badgeColor: '#5b788a',
    iconName: 'star',
    isActive: true,
  },
  {
    name: 'Silver',
    level: 2,
    minPoint: 2000,
    maxPoint: 4999,
    discountPercent: 5,
    benefitDescription: 'Giảm 5% trên mỗi hóa đơn',
    cardColor: '#8fa3ad',
    textColor: '#ffffff',
    badgeColor: '#8fa3ad',
    iconName: 'shield-star',
    isActive: true,
  },
  {
    name: 'Gold',
    level: 3,
    minPoint: 5000,
    maxPoint: 9999,
    discountPercent: 7,
    benefitDescription: 'Giảm 7% trên mỗi hóa đơn',
    cardColor: '#cf9f2e',
    textColor: '#ffffff',
    badgeColor: '#cf9f2e',
    iconName: 'crown',
    isActive: true,
  },
  {
    name: 'Platinum',
    level: 4,
    minPoint: 10000,
    maxPoint: null,
    discountPercent: 10,
    benefitDescription: 'Giảm 10% trên mỗi hóa đơn',
    cardColor: '#1c1c1c',
    textColor: '#e5e4e2',
    badgeColor: '#1c1c1c',
    iconName: 'diamond-stone',
    isActive: true,
  },
]

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

const toTierPayload = (form: TierFormState): MembershipRankingPayload => ({
  name: form.name.trim(),
  level: Number(form.level),
  minPoint: Number(form.minPoint),
  maxPoint: form.maxPoint.trim() ? Number(form.maxPoint) : null,
  discountPercent: Number(form.discountPercent),
  benefitDescription: form.benefitDescription.trim(),
  cardColor: form.cardColor,
  textColor: form.textColor,
  badgeColor: form.badgeColor,
  iconName: form.iconName,
  isActive: form.isActive,
})

export function LoyaltyPage({ currentUser }: LoyaltyPageProps) {
  const [tiers, setTiers] = useState<MembershipRanking[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [dialog, setDialog] = useState<DialogState>(null)
  const [tierForm, setTierForm] = useState<TierFormState>(emptyTierForm)

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
      setTiers(defaultTiers)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTiers()
  }, [loadTiers])

  const sortedTiers = useMemo(
    () => [...(tiers.length ? tiers : defaultTiers)].sort((a, b) => a.level - b.level),
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
      return
    }

    setActionLoading(true)
    setNotice(null)

    try {
      const updatedTier = await updateMembershipRankingStatus(tier._id, nextActive)
      replaceTier(updatedTier)
      setNotice({
        type: 'success',
        message: nextActive ? 'Đã bật lại hạng thành viên' : 'Đã tạm tắt hạng thành viên',
      })
    } catch (err) {
      setNotice({ type: 'error', message: getErrorMessage(err) })
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteTier = async () => {
    if (!dialog || dialog.type !== 'delete' || !dialog.tier._id) {
      return
    }

    setActionLoading(true)
    setNotice(null)

    try {
      const updatedTier = await deleteMembershipRanking(dialog.tier._id)
      replaceTier(updatedTier)
      setDialog(null)
      setNotice({ type: 'success', message: 'Đã ngưng sử dụng hạng thành viên' })
    } catch (err) {
      setNotice({ type: 'error', message: getErrorMessage(err) })
    } finally {
      setActionLoading(false)
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
          CRUD hạng thành viên đã đi qua API quản trị riêng. Quy tắc tích điểm và nhật ký thay đổi
          sẽ được nối thành bước riêng.
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
            {isLoading ? <span>Đang tải...</span> : null}
          </div>

          {error ? <div className="admin-notice is-error">{error}</div> : null}

          <table className="admin-table">
            <thead>
              <tr>
                <th>Hạng</th>
                <th>Điểm yêu cầu</th>
                <th>Giảm giá</th>
                <th>Quyền lợi</th>
                <th>Hiển thị</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {sortedTiers.map((tier) => {
                const hasPersistedTier = Boolean(tier._id)
                const isActive = tier.isActive !== false

                return (
                  <tr key={`${tier.level}-${tier.name}`}>
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
                        <strong>{tier.iconName ?? 'star'}</strong>
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
                          onClick={() => void handleStatusChange(tier, !isActive)}
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
              })}
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
        <div className="admin-confirm-layer" role="dialog" aria-modal="true" aria-labelledby="admin-tier-dialog-title">
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
                <span>Điểm tối đa</span>
                <input
                  type="number"
                  value={tierForm.maxPoint}
                  onChange={(event) => setTierForm((form) => ({ ...form, maxPoint: event.target.value }))}
                  min={0}
                  max={100000000}
                  placeholder="Để trống nếu không giới hạn"
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

      {dialog?.type === 'delete' ? (
        <div className="admin-confirm-layer" role="dialog" aria-modal="true" aria-labelledby="admin-tier-delete-title">
          <div className="admin-confirm-box">
            <h2 id="admin-tier-delete-title">Ngưng sử dụng hạng?</h2>
            <p>
              Hạng {dialog.tier.name} sẽ được chuyển sang trạng thái tạm tắt để không làm gãy dữ
              liệu khách hàng và coupon đã tham chiếu.
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
                {actionLoading ? 'Đang xử lý...' : 'Ngưng dùng'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
