import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import type { AdminUser } from '../auth/adminSession'
import { useDialogAccessibility } from '../../hooks/useDialogAccessibility'
import {
  adjustLoyaltyPoints,
  createMembershipRanking,
  createMembershipRankingsBatch,
  deleteMembershipRanking,
  listLoyaltyPointHistory,
  listLoyaltyUsers,
  listMembershipRankings,
  reorderMembershipRankings,
  updateMembershipRanking,
  updateMembershipRankingStatus,
} from './loyalty.service'
import {
  emptyPagination,
  emptyTierForm,
  iconOptions,
  integrationChecks,
  membershipIconSymbols,
  policyCards,
  tierDraftKey,
  tierPalettePresets,
  tierTemplates,
} from './loyalty.constants'
import {
  formatHistoryDate,
  formatNumber,
  getContrastRatio,
  getErrorMessage,
  getHistoryActor,
  getSuggestedTierForm,
  toTierForm,
  toTierPayload,
  validateTierForm,
} from './loyalty.helpers'
import type {
  LoyaltyPagination,
  LoyaltyPointHistory,
  LoyaltyUser,
  MembershipRanking,
} from './loyalty.types'
import './loyalty.css'
import { LoyaltyKpiSummary } from './components/LoyaltyKpiSummary'
import { LoyaltyRulesPanel } from './components/LoyaltyRulesPanel'
import { LoyaltyPointsPanel } from './components/LoyaltyPointsPanel'
import { TierDialog, type TierFormState } from './components/TierDialog'
import { TierListPanel } from './components/TierListPanel'
import { useToast } from '../../notifications/notification-context'
import {
  Button,
  Modal,
} from '../../components/ui'

type LoyaltyPageProps = {
  currentUser: AdminUser
}

type Notice = {
  type: 'success' | 'error'
  message: string
}

type DialogState =
  | { type: 'create' }
  | { type: 'edit'; tier: MembershipRanking }
  | { type: 'status'; tier: MembershipRanking; nextActive: boolean }
  | { type: 'delete'; tier: MembershipRanking }
  | null

export function LoyaltyPage({ currentUser }: LoyaltyPageProps) {
  const { showToast } = useToast()
  const [tiers, setTiers] = useState<MembershipRanking[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [dialog, setDialog] = useState<DialogState>(null)
  const [tierForm, setTierForm] = useState<TierFormState>(emptyTierForm)
  const [tierDraftRestored, setTierDraftRestored] = useState(false)
  const [tierSubmitAttempted, setTierSubmitAttempted] = useState(false)
  const [tierFormBaseline, setTierFormBaseline] = useState('')
  const [tierDiscardRequested, setTierDiscardRequested] = useState(false)
  const [showTierAdvancedOptions, setShowTierAdvancedOptions] = useState(false)
  const [tierBatchProgress, setTierBatchProgress] = useState('')
  const [tierKeyword, setTierKeyword] = useState('')
  const [tierStatusFilter, setTierStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [userKeyword, setUserKeyword] = useState('')
  const [loyaltyUsers, setLoyaltyUsers] = useState<LoyaltyUser[]>([])
  const [userPagination, setUserPagination] = useState<LoyaltyPagination>(emptyPagination)
  const [isSearchingUsers, setIsSearchingUsers] = useState(false)
  const [selectedTierFilter, setSelectedTierFilter] = useState<MembershipRanking | null>(null)
  const [selectedLoyaltyUser, setSelectedLoyaltyUser] = useState<LoyaltyUser | null>(null)
  const [pointHistory, setPointHistory] = useState<LoyaltyPointHistory[]>([])
  const [historyPagination, setHistoryPagination] = useState<LoyaltyPagination>(emptyPagination)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [adjustmentDelta, setAdjustmentDelta] = useState('')
  const [adjustmentReason, setAdjustmentReason] = useState('')
  const [isAdjustingPoints, setIsAdjustingPoints] = useState(false)
  const [historyTypeFilter, setHistoryTypeFilter] = useState<'all' | LoyaltyPointHistory['type']>('all')
  const [historyDateFrom, setHistoryDateFrom] = useState('')
  const [historyDateTo, setHistoryDateTo] = useState('')
  const [historySummary, setHistorySummary] = useState({ added: 0, deducted: 0 })

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
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTiers()
  }, [loadTiers])

  useEffect(() => {
    if (dialog?.type !== 'create') return
    if (!tierForm.name.trim() && !tierForm.benefitDescription.trim()) {
      window.localStorage.removeItem(tierDraftKey)
      return
    }
    const handle = window.setTimeout(() => window.localStorage.setItem(tierDraftKey, JSON.stringify(tierForm)), 400)
    return () => window.clearTimeout(handle)
  }, [dialog?.type, tierForm])

  useEffect(() => {
    if (!notice) {
      return
    }

    showToast(notice.message, notice.type)
    const handle = window.setTimeout(() => setNotice(null), 5000)
    return () => window.clearTimeout(handle)
  }, [notice, showToast])

  const sortedTiers = useMemo(
    () => [...tiers].sort((a, b) => a.level - b.level),
    [tiers],
  )
  const tierErrors = useMemo(() => validateTierForm(tierForm), [tierForm])
  const visibleTiers = useMemo(() => {
    const keyword = tierKeyword.trim().toLocaleLowerCase('vi')
    return sortedTiers.filter((tier) => {
      const matchesKeyword = !keyword || `${tier.name} ${tier.benefitDescription ?? ''}`.toLocaleLowerCase('vi').includes(keyword)
      const matchesStatus = tierStatusFilter === 'all'
        || (tierStatusFilter === 'active' ? tier.isActive !== false : tier.isActive === false)
      return matchesKeyword && matchesStatus
    })
  }, [sortedTiers, tierKeyword, tierStatusFilter])
  const tierConfigurationWarnings = useMemo(() => {
    const warnings: string[] = []
    sortedTiers.forEach((tier, index) => {
      const previous = sortedTiers[index - 1]
      if (!previous) {
        if (tier.level !== 1 || tier.minPoint !== 0) warnings.push('Hạng đầu tiên nên là level 1 và bắt đầu từ 0 điểm.')
        return
      }
      if (tier.level !== previous.level + 1) warnings.push(`Thiếu level giữa ${previous.name} và ${tier.name}.`)
      if (tier.minPoint <= previous.minPoint) warnings.push(`Mốc điểm của ${tier.name} phải cao hơn ${previous.name}.`)
      if (previous.minPoint > 0 && tier.minPoint / previous.minPoint >= 10) warnings.push(`Khoảng điểm từ ${previous.name} đến ${tier.name} đang tăng trên 10 lần.`)
    })
    return warnings
  }, [sortedTiers])
  const editingTierId = dialog?.type === 'edit' ? dialog.tier._id : undefined
  const suggestedMaxPoint = useMemo(() => {
    const minPoint = Number(tierForm.minPoint)
    if (!Number.isFinite(minPoint)) return null
    const nextTier = sortedTiers
      .filter((tier) => tier._id !== editingTierId)
      .find((tier) => tier.minPoint > minPoint)
    return nextTier ? Math.max(minPoint, nextTier.minPoint - 1) : null
  }, [editingTierId, sortedTiers, tierForm.minPoint])
  const replaceTier = (updatedTier: MembershipRanking) => {
    setTiers((currentTiers) =>
      currentTiers.map((tier) => (tier._id === updatedTier._id ? updatedTier : tier)),
    )
  }

  const openCreateDialog = () => {
    let nextForm = getSuggestedTierForm(sortedTiers)
    const rawDraft = window.localStorage.getItem(tierDraftKey)
    if (rawDraft) {
      try {
        nextForm = { ...emptyTierForm, ...(JSON.parse(rawDraft) as Partial<TierFormState>) }
        setTierDraftRestored(true)
      } catch {
        window.localStorage.removeItem(tierDraftKey)
        setTierDraftRestored(false)
      }
    } else {
      setTierDraftRestored(false)
    }
    setTierForm(nextForm)
    setTierFormBaseline(JSON.stringify(nextForm))
    setNotice(null)
    setTierSubmitAttempted(false)
    setShowTierAdvancedOptions(false)
    setDialog({ type: 'create' })
  }

  const openEditDialog = (tier: MembershipRanking) => {
    const nextForm = toTierForm(tier)
    setTierForm(nextForm)
    setTierFormBaseline(JSON.stringify(nextForm))
    setNotice(null)
    setTierSubmitAttempted(false)
    setTierDraftRestored(false)
    setShowTierAdvancedOptions(true)
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
    if (actionLoading) return
    if ((dialog?.type === 'create' || dialog?.type === 'edit') && JSON.stringify(tierForm) !== tierFormBaseline) {
      setTierDiscardRequested(true)
      return
    }
    setDialog(null)
  }
  const forceCloseTierDialog = () => {
    setTierDiscardRequested(false)
    setDialog(null)
  }

  const handleSubmitTier = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!dialog || (dialog.type !== 'create' && dialog.type !== 'edit')) {
      return
    }

    setTierSubmitAttempted(true)
    if (Object.keys(tierErrors).length) {
      setNotice({ type: 'error', message: 'Kiểm tra lại các trường được đánh dấu.' })
      return
    }

    setActionLoading(true)
    setNotice(null)

    try {
      const payload = toTierPayload(tierForm)

      if (dialog.type === 'create') {
        await createMembershipRanking(payload)
        window.localStorage.removeItem(tierDraftKey)
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

  const createDefaultTierSet = async () => {
    setActionLoading(true)
    setNotice(null)
    setTierBatchProgress(`Đang kiểm tra ${tierTemplates.length} hạng mẫu...`)
    try {
      const payloads = tierTemplates.map((template) => toTierPayload({ ...emptyTierForm, ...template.values }))
      setTierBatchProgress(`Đang tạo ${payloads.length}/${payloads.length} hạng trong một giao dịch...`)
      await createMembershipRankingsBatch(payloads)
      await loadTiers()
      setNotice({ type: 'success', message: `Đã tạo ${tierTemplates.length} hạng mẫu; bạn có thể chỉnh lại tên, điểm và quyền lợi.` })
    } catch (err) {
      setNotice({ type: 'error', message: `Không tạo bộ hạng: ${getErrorMessage(err)}. Không có hạng nào được ghi.` })
    } finally {
      setTierBatchProgress('')
      setActionLoading(false)
    }
  }

  const moveTier = async (tier: MembershipRanking, direction: -1 | 1) => {
    if (!tier._id) return
    const currentIndex = sortedTiers.findIndex((item) => item._id === tier._id)
    const targetIndex = currentIndex + direction
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= sortedTiers.length) return
    const orderedIds = sortedTiers.map((item) => item._id).filter((id): id is string => Boolean(id))
    ;[orderedIds[currentIndex], orderedIds[targetIndex]] = [orderedIds[targetIndex], orderedIds[currentIndex]]
    setActionLoading(true)
    setNotice(null)
    try {
      setTiers(await reorderMembershipRankings(orderedIds))
      setNotice({ type: 'success', message: 'Đã đổi thứ tự hạng và giữ nguyên các mốc điểm theo vị trí.' })
    } catch (err) {
      setNotice({ type: 'error', message: getErrorMessage(err) })
    } finally {
      setActionLoading(false)
    }
  }

  const isTierFormDialogOpen = dialog?.type === 'create' || dialog?.type === 'edit'
  const dialogRef = useDialogAccessibility(isTierFormDialogOpen, closeDialog, !actionLoading)

  const loadPointHistory = useCallback(async (userId: string, page = 1) => {
    setIsLoadingHistory(true)

    try {
      const result = await listLoyaltyPointHistory(userId, page, 10, {
        type: historyTypeFilter === 'all' ? undefined : historyTypeFilter,
        dateFrom: historyDateFrom || undefined,
        dateTo: historyDateTo || undefined,
      })
      setPointHistory(result.items)
      setHistoryPagination(result.pagination)
      setHistorySummary(result.summary)
    } catch (err) {
      setNotice({ type: 'error', message: getErrorMessage(err) })
      setPointHistory([])
      setHistoryPagination(emptyPagination)
      setHistorySummary({ added: 0, deducted: 0 })
    } finally {
      setIsLoadingHistory(false)
    }
  }, [historyDateFrom, historyDateTo, historyTypeFilter])

  const searchLoyaltyUsers = useCallback(async (keyword: string, page = 1, tierId?: string, append = false) => {
    setIsSearchingUsers(true)
    setNotice(null)

    try {
      const result = await listLoyaltyUsers(keyword, page, 10, tierId)
      setLoyaltyUsers((users) => append ? [...users, ...result.items.filter((item) => !users.some((user) => user._id === item._id))] : result.items)
      setUserPagination(result.pagination)
    } catch (err) {
      setNotice({ type: 'error', message: getErrorMessage(err) })
      if (!append) setLoyaltyUsers([])
    } finally {
      setIsSearchingUsers(false)
    }
  }, [])

  const handleSearchLoyaltyUsers = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void searchLoyaltyUsers(userKeyword, 1, selectedTierFilter?._id)
  }

  useEffect(() => {
    if (!userKeyword.trim() && !selectedTierFilter?._id) {
      setLoyaltyUsers([])
      setUserPagination(emptyPagination)
      return
    }
    const handle = window.setTimeout(() => {
      void searchLoyaltyUsers(userKeyword, 1, selectedTierFilter?._id)
    }, 350)
    return () => window.clearTimeout(handle)
  }, [searchLoyaltyUsers, selectedTierFilter?._id, userKeyword])

  const handleViewTierMembers = async (tier: MembershipRanking) => {
    if (!tier._id) {
      return
    }

    setSelectedTierFilter(tier)
    setUserKeyword('')
    setIsSearchingUsers(true)
    setNotice(null)

    try {
      await searchLoyaltyUsers('', 1, tier._id)
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
      if (userKeyword.trim()) await searchLoyaltyUsers(userKeyword)
      else {
        setLoyaltyUsers([])
        setUserPagination(emptyPagination)
      }
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
    setHistoryTypeFilter('all')
    void loadPointHistory(user._id)
  }

  useEffect(() => {
    if (!selectedLoyaltyUser) return
    const handle = window.setTimeout(() => void loadPointHistory(selectedLoyaltyUser._id, 1), 250)
    return () => window.clearTimeout(handle)
  }, [historyDateFrom, historyDateTo, historyTypeFilter, loadPointHistory, selectedLoyaltyUser])

  const adjustmentDeltaError = adjustmentDelta && (!Number.isInteger(Number(adjustmentDelta)) || Number(adjustmentDelta) === 0 || Math.abs(Number(adjustmentDelta)) > 1000000)
    ? 'Nhập số nguyên khác 0, tối đa 1.000.000 điểm.'
    : ''
  const adjustmentReasonError = adjustmentReason && (adjustmentReason.trim().length < 2 || adjustmentReason.trim().length > 200)
    ? 'Lý do cần từ 2 đến 200 ký tự.'
    : ''
  const filteredPointHistory = pointHistory
  const pointHistorySummary = historySummary
  const visibleHistoryPages = useMemo(() => {
    const totalPages = historyPagination.totalPages
    const firstPage = Math.max(1, Math.min(historyPagination.page - 2, totalPages - 4))
    const lastPage = Math.min(totalPages, firstPage + 4)
    return Array.from({ length: Math.max(0, lastPage - firstPage + 1) }, (_, index) => firstPage + index)
  }, [historyPagination.page, historyPagination.totalPages])

  const exportPointHistoryCsv = async () => {
    if (!selectedLoyaltyUser) return
    setIsLoadingHistory(true)
    try {
      let exportPage = 1
      let totalPages = 1
      let allItems: LoyaltyPointHistory[] = []
      do {
        const result = await listLoyaltyPointHistory(selectedLoyaltyUser._id, exportPage, 50, {
          type: historyTypeFilter === 'all' ? undefined : historyTypeFilter,
          dateFrom: historyDateFrom || undefined,
          dateTo: historyDateTo || undefined,
        })
        allItems = [...allItems, ...result.items]
        totalPages = result.pagination.totalPages
        exportPage += 1
      } while (exportPage <= totalPages)
      const rows = [
        ['Khách hàng', 'Loại', 'Điểm thay đổi', 'Số dư sau', 'Lý do', 'Người thực hiện', 'Thời gian'],
        ...allItems.map((history) => [selectedLoyaltyUser.email, history.type, history.delta, history.balanceAfter, history.reason, getHistoryActor(history), history.createdAt]),
      ]
      const csv = `\uFEFF${rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')}`
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `loyalty-history-${selectedLoyaltyUser._id}.csv`
      link.click()
      URL.revokeObjectURL(url)
      setNotice({ type: 'success', message: `Đã xuất ${allItems.length} giao dịch điểm.` })
    } catch (err) {
      setNotice({ type: 'error', message: getErrorMessage(err) })
    } finally {
      setIsLoadingHistory(false)
    }
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
      <header className="admin-page-heading">
        <div>
          <p>Khách hàng / Thành viên</p>
          <h1>Chương trình thành viên</h1>
          <span className="admin-product-heading-copy">
            Quản lý hạng thành viên, mốc điểm, quyền lợi và điều chỉnh điểm tích lũy cho khách hàng.
          </span>
        </div>
        <div className="admin-loyalty-heading-actions">
          <details className="admin-loyalty-rule-popover">
            <summary>Quy định xếp hạng</summary>
            <div className="admin-loyalty-policy-list" aria-label="Quy định xếp hạng thành viên">
              {policyCards.map((item) => (
                <div key={item.title}>
                  <span>{item.title}</span>
                  <strong>{item.value}</strong>
                  <p>{item.note}</p>
                </div>
              ))}
            </div>
          </details>
          <details className="admin-loyalty-rule-popover">
            <summary>Liên kết nghiệp vụ</summary>
            <div className="admin-loyalty-policy-list" aria-label="Các màn hình bị ảnh hưởng bởi chương trình thành viên">
              {integrationChecks.map((item) => (
                <div key={item}>
                  <p>{item}</p>
                </div>
              ))}
            </div>
          </details>
          <button
            className="admin-primary-button"
            type="button"
            disabled={!canManageLoyalty}
            onClick={openCreateDialog}
          >
            + Thêm hạng
          </button>
        </div>
      </header>

      <LoyaltyKpiSummary tiers={sortedTiers} formatNumber={formatNumber} />

      <TierListPanel
        sortedTiers={sortedTiers}
        visibleTiers={visibleTiers}
        tierKeyword={tierKeyword}
        tierStatusFilter={tierStatusFilter}
        warnings={tierConfigurationWarnings}
        iconSymbols={membershipIconSymbols}
        isLoading={isLoading}
        actionLoading={actionLoading}
        error={error}
        canManageLoyalty={canManageLoyalty}
        tierBatchProgress={tierBatchProgress}
        formatNumber={formatNumber}
        onKeywordChange={setTierKeyword}
        onStatusFilterChange={setTierStatusFilter}
        onReload={() => void loadTiers()}
        onCreate={openCreateDialog}
        onCreateDefaultSet={() => void createDefaultTierSet()}
        onViewMembers={(tier) => void handleViewTierMembers(tier)}
        onEdit={openEditDialog}
        onMove={(tier, direction) => void moveTier(tier, direction)}
        onStatusChange={openStatusDialog}
        onDelete={openDeleteDialog}
      />

      <LoyaltyRulesPanel currentUser={currentUser} />

      <LoyaltyPointsPanel
        selectedTierFilter={selectedTierFilter}
        loyaltyUsers={loyaltyUsers}
        selectedLoyaltyUser={selectedLoyaltyUser}
        sortedTiers={sortedTiers}
        userKeyword={userKeyword}
        userPagination={userPagination}
        isSearchingUsers={isSearchingUsers}
        adjustmentDelta={adjustmentDelta}
        adjustmentReason={adjustmentReason}
        adjustmentDeltaError={adjustmentDeltaError}
        adjustmentReasonError={adjustmentReasonError}
        canManageLoyalty={canManageLoyalty}
        isAdjustingPoints={isAdjustingPoints}
        historyTypeFilter={historyTypeFilter}
        historyDateFrom={historyDateFrom}
        historyDateTo={historyDateTo}
        pointHistory={pointHistory}
        filteredPointHistory={filteredPointHistory}
        pointHistorySummary={pointHistorySummary}
        isLoadingHistory={isLoadingHistory}
        historyPagination={historyPagination}
        visibleHistoryPages={visibleHistoryPages}
        formatNumber={formatNumber}
        formatHistoryDate={formatHistoryDate}
        getHistoryActor={getHistoryActor}
        onClearTierFilter={() => void handleClearTierFilter()}
        onSearchSubmit={handleSearchLoyaltyUsers}
        onUserKeywordChange={setUserKeyword}
        onSelectUser={handleSelectLoyaltyUser}
        onLoadMoreUsers={() => void searchLoyaltyUsers(userKeyword, userPagination.page + 1, selectedTierFilter?._id, true)}
        onAdjustSubmit={handleAdjustPoints}
        onAdjustmentDeltaChange={setAdjustmentDelta}
        onAdjustmentReasonChange={setAdjustmentReason}
        onHistoryTypeChange={setHistoryTypeFilter}
        onHistoryDateFromChange={setHistoryDateFrom}
        onHistoryDateToChange={setHistoryDateTo}
        onClearHistoryDates={() => {
          setHistoryDateFrom('')
          setHistoryDateTo('')
        }}
        onExportHistory={() => void exportPointHistoryCsv()}
        onLoadHistoryPage={(page) => {
          if (selectedLoyaltyUser) void loadPointHistory(selectedLoyaltyUser._id, page)
        }}
      />

      {dialog?.type === 'create' || dialog?.type === 'edit' ? (
        <TierDialog
          mode={dialog.type}
          dialogRef={dialogRef}
          form={tierForm}
          errors={tierErrors}
          submitAttempted={tierSubmitAttempted}
          actionLoading={actionLoading}
          notice={notice}
          draftRestored={tierDraftRestored}
          showAdvancedOptions={showTierAdvancedOptions}
          suggestedMaxPoint={suggestedMaxPoint}
          templates={tierTemplates}
          palettePresets={tierPalettePresets}
          iconOptions={iconOptions}
          iconSymbols={membershipIconSymbols}
          setForm={setTierForm}
          formatNumber={formatNumber}
          getContrastRatio={getContrastRatio}
          onSubmit={handleSubmitTier}
          onClose={closeDialog}
          onClearDraft={() => {
            window.localStorage.removeItem(tierDraftKey)
            setTierForm(emptyTierForm)
            setTierDraftRestored(false)
          }}
          onToggleAdvancedOptions={() => setShowTierAdvancedOptions((visible) => !visible)}
        />
      ) : null}

      <Modal
        isOpen={dialog?.type === 'status'}
        title={dialog?.type === 'status' ? (dialog.nextActive ? 'Bật lại hạng?' : 'Tạm tắt hạng?') : ''}
        description={dialog?.type === 'status'
          ? `Hạng ${dialog.tier.name} sẽ ${dialog.nextActive ? 'được bật lại cho khách hàng đủ điểm.' : 'ngừng áp dụng cho khách hàng và voucher tham chiếu hạng này.'}`
          : undefined}
        onClose={closeDialog}
        actions={dialog?.type === 'status' ? (
          <>
            <Button variant="secondary" disabled={actionLoading} onClick={closeDialog}>
              Hủy
            </Button>
            <Button
              variant={dialog.nextActive ? 'primary' : 'danger'}
              disabled={actionLoading}
              onClick={() => void handleConfirmStatusChange()}
            >
              {actionLoading ? 'Đang xử lý...' : dialog.nextActive ? 'Bật lại' : 'Tạm tắt'}
            </Button>
          </>
        ) : null}
      />

      <Modal
        isOpen={dialog?.type === 'delete'}
        title="Xóa hạng thành viên?"
        description={dialog?.type === 'delete'
          ? `Chỉ có thể xóa hạng ${dialog.tier.name} khi đây không phải hạng cơ bản và chưa có thành viên đang thuộc hạng.`
          : undefined}
        onClose={closeDialog}
        actions={dialog?.type === 'delete' ? (
          <>
            <Button variant="secondary" disabled={actionLoading} onClick={closeDialog}>
              Hủy
            </Button>
            <Button variant="danger" disabled={actionLoading} onClick={() => void handleDeleteTier()}>
              {actionLoading ? 'Đang xử lý...' : 'Xóa hạng'}
            </Button>
          </>
        ) : null}
      />

      <Modal
        isOpen={tierDiscardRequested}
        title="Bỏ thay đổi chưa lưu?"
        description="Bản nháp hạng mới vẫn được giữ để bạn khôi phục lần sau."
        onClose={() => setTierDiscardRequested(false)}
        actions={(
          <>
            <Button variant="secondary" onClick={() => setTierDiscardRequested(false)}>
              Tiếp tục chỉnh
            </Button>
            <Button variant="danger" onClick={forceCloseTierDialog}>
              Bỏ thay đổi
            </Button>
          </>
        )}
      />
    </section>
  )
}
