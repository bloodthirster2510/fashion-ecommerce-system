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
import type {
  LoyaltyPagination,
  LoyaltyPointHistory,
  LoyaltyUser,
  MembershipRanking,
  MembershipRankingPayload,
} from './loyalty.types'
import './loyalty.css'
import { LoyaltyRulesPanel } from './components/LoyaltyRulesPanel'
import { useToast } from '../../notifications/notification-context'
import { AdminEmptyIllustration } from '../../components/AdminEmptyIllustration'

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
type TierFieldErrors = Partial<Record<keyof TierFormState, string>>
const tierDraftKey = 'fashionista.admin.tier-draft'

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

const tierTemplates: Array<{ label: string; values: Partial<TierFormState> }> = [
  { label: 'Đồng', values: { name: 'Đồng', level: '1', minPoint: '0', discountPercent: '0', cardColor: '#8f5b34', textColor: '#ffffff', badgeColor: '#d19a66', iconName: 'medal-outline', benefitDescription: 'Tích điểm và nhận ưu đãi dành cho thành viên.' } },
  { label: 'Bạc', values: { name: 'Bạc', level: '2', minPoint: '1000', discountPercent: '3', cardColor: '#59636e', textColor: '#ffffff', badgeColor: '#c0c7cf', iconName: 'shield-star', benefitDescription: 'Giảm 3%, ưu tiên nhận voucher và chương trình dành riêng.' } },
  { label: 'Vàng', values: { name: 'Vàng', level: '3', minPoint: '5000', discountPercent: '5', cardColor: '#6f5310', textColor: '#ffffff', badgeColor: '#d4af37', iconName: 'crown', benefitDescription: 'Giảm 5%, ưu tiên chăm sóc và nhận ưu đãi sinh nhật.' } },
  { label: 'Kim cương', values: { name: 'Kim cương', level: '4', minPoint: '20000', discountPercent: '10', cardColor: '#20546b', textColor: '#ffffff', badgeColor: '#8bd5ee', iconName: 'diamond-stone', benefitDescription: 'Giảm 10%, đặc quyền cao nhất và ưu tiên hỗ trợ.' } },
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

const validateTierForm = (form: TierFormState): TierFieldErrors => {
  const errors: TierFieldErrors = {}
  const level = Number(form.level)
  const minPoint = Number(form.minPoint)
  const discountPercent = Number(form.discountPercent)
  if (form.name.trim().length < 2) errors.name = 'Tên hạng cần ít nhất 2 ký tự.'
  if (!Number.isInteger(level) || level < 1 || level > 20) errors.level = 'Level phải là số nguyên từ 1 đến 20.'
  if (!Number.isInteger(minPoint) || minPoint < 0 || minPoint > 100000000) errors.minPoint = 'Điểm tối thiểu phải là số nguyên từ 0 đến 100.000.000.'
  if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) errors.discountPercent = 'Mức giảm phải nằm trong khoảng 0–100%.'
  if (form.benefitDescription.trim().length < 2) errors.benefitDescription = 'Quyền lợi cần ít nhất 2 ký tự.'
  if (!/^#[0-9a-f]{6}$/i.test(form.cardColor)) errors.cardColor = 'Màu thẻ không hợp lệ.'
  if (!/^#[0-9a-f]{6}$/i.test(form.textColor)) errors.textColor = 'Màu chữ không hợp lệ.'
  if (getContrastRatio(form.cardColor, form.textColor) < 4.5) errors.textColor = 'Màu chữ và nền cần độ tương phản tối thiểu 4.5:1.'
  return errors
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

  const activeTierCount = sortedTiers.filter((tier) => tier.isActive !== false).length
  const highestTier = sortedTiers[sortedTiers.length - 1]
  const tierContrastRatio = useMemo(
    () => getContrastRatio(tierForm.cardColor, tierForm.textColor),
    [tierForm.cardColor, tierForm.textColor],
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
  const suggestedMaxPoint = useMemo(() => {
    const minPoint = Number(tierForm.minPoint)
    if (!Number.isFinite(minPoint)) return null
    const nextTier = sortedTiers.find((tier) => tier.minPoint > minPoint)
    return nextTier ? Math.max(minPoint, nextTier.minPoint - 1) : null
  }, [sortedTiers, tierForm.minPoint])

  const replaceTier = (updatedTier: MembershipRanking) => {
    setTiers((currentTiers) =>
      currentTiers.map((tier) => (tier._id === updatedTier._id ? updatedTier : tier)),
    )
  }

  const openCreateDialog = () => {
    let nextForm = emptyTierForm
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
    setDialog({ type: 'create' })
  }

  const openEditDialog = (tier: MembershipRanking) => {
    const nextForm = toTierForm(tier)
    setTierForm(nextForm)
    setTierFormBaseline(JSON.stringify(nextForm))
    setNotice(null)
    setTierSubmitAttempted(false)
    setTierDraftRestored(false)
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

  const dialogRef = useDialogAccessibility(Boolean(dialog), closeDialog, !actionLoading)
  const tierDiscardDialogRef = useDialogAccessibility(tierDiscardRequested, () => setTierDiscardRequested(false), !actionLoading)

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
        <section className={`admin-table-shell admin-loyalty-table${isLoading && sortedTiers.length ? ' is-refreshing' : ''}`}>
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

          <div className="admin-loyalty-tier-filters">
            <label>
              <span>Tìm hạng</span>
              <input value={tierKeyword} onChange={(event) => setTierKeyword(event.target.value)} placeholder="Tên hoặc quyền lợi" />
            </label>
            <label>
              <span>Trạng thái</span>
              <select value={tierStatusFilter} onChange={(event) => setTierStatusFilter(event.target.value as typeof tierStatusFilter)}>
                <option value="all">Tất cả</option>
                <option value="active">Hoạt động</option>
                <option value="inactive">Tạm tắt</option>
              </select>
            </label>
          </div>
          {tierConfigurationWarnings.map((warning) => <p className="admin-smart-warning" key={warning}>{warning}</p>)}

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
              {isLoading && sortedTiers.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="admin-table-skeleton" aria-label="Đang tải hạng thành viên">{Array.from({ length: 5 }, (_, index) => <span key={index} />)}</div>
                  </td>
                </tr>
              ) : null}

              {!isLoading && !error && sortedTiers.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="admin-loyalty-empty-state">
                      <AdminEmptyIllustration variant="tier" />
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
                      <button className="admin-link-button" type="button" disabled={!canManageLoyalty || actionLoading} onClick={() => void createDefaultTierSet()}>
                        Tạo nhanh bộ hạng mẫu
                      </button>
                      {tierBatchProgress ? <small role="status">{tierBatchProgress}</small> : null}
                    </div>
                  </td>
                </tr>
              ) : null}

              {!isLoading && sortedTiers.length > 0 && visibleTiers.length === 0 ? (
                <tr><td colSpan={8}>Không có hạng phù hợp bộ lọc.</td></tr>
              ) : null}

              {visibleTiers.map((tier, index) => {
                const hasPersistedTier = Boolean(tier._id)
                const isActive = tier.isActive !== false

                return (
                  <tr className={selectedTierFilter?._id === tier._id ? 'is-tier-selected' : ''} key={tier._id ?? `${tier.level}-${tier.name}-${index}`}>
                    <td data-label="Hạng">
                      <strong>{tier.name}</strong>
                      <span>Level {tier.level}</span>
                    </td>
                    <td data-label="Điểm yêu cầu">
                      {formatNumber(tier.minPoint)} - {formatNumber(tier.maxPoint)}
                    </td>
                    <td data-label="Giảm giá">{tier.discountPercent}%</td>
                    <td data-label="Quyền lợi">{tier.benefitDescription || 'Chưa mô tả'}</td>
                    <td data-label="Thành viên">
                      <button
                        className="admin-link-button admin-loyalty-member-link"
                        type="button"
                        disabled={!hasPersistedTier}
                        onClick={() => void handleViewTierMembers(tier)}
                      >
                        {formatNumber(tier.memberCount ?? 0)}
                      </button>
                    </td>
                    <td data-label="Hiển thị">
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
                    <td data-label="Trạng thái">
                      <span
                        className={`admin-status-pill${isActive ? ' is-active' : ' is-blocked'}`}
                      >
                        {isActive ? 'Hoạt động' : 'Tạm tắt'}
                      </span>
                    </td>
                    <td data-label="Thao tác">
                      <div className="admin-row-actions">
                        <button
                          className="admin-link-button"
                          type="button"
                          disabled={!canManageLoyalty || !hasPersistedTier || actionLoading}
                          onClick={() => openEditDialog(tier)}
                        >
                          Sửa
                        </button>
                        <details className="admin-action-menu">
                          <summary aria-label={`Thao tác với hạng ${tier.name}`}>•••</summary>
                          <div>
                            <button type="button" disabled={!canManageLoyalty || sortedTiers.findIndex((item) => item._id === tier._id) === 0 || actionLoading} onClick={() => void moveTier(tier, -1)}>Đưa lên</button>
                            <button type="button" disabled={!canManageLoyalty || sortedTiers.findIndex((item) => item._id === tier._id) === sortedTiers.length - 1 || actionLoading} onClick={() => void moveTier(tier, 1)}>Đưa xuống</button>
                            <button type="button" disabled={!canManageLoyalty || !hasPersistedTier || actionLoading} onClick={() => openStatusDialog(tier, !isActive)}>{isActive ? 'Tắt' : 'Bật'}</button>
                            <button className="is-danger" type="button" disabled={!canManageLoyalty || !hasPersistedTier || actionLoading} onClick={() => openDeleteDialog(tier)}>Xóa</button>
                          </div>
                        </details>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {isLoading && sortedTiers.length ? <div className="admin-table-refresh-indicator" role="status">Đang cập nhật hạng...</div> : null}
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
                    <em>Hạng: {[...sortedTiers].reverse().find((tier) => user.loyaltyPoint >= tier.minPoint)?.name ?? 'Chưa xếp hạng'}</em>
                  </span>
                  <b>{formatNumber(user.loyaltyPoint)} điểm</b>
                </button>
              ))}
            </div>
            {userPagination.page < userPagination.totalPages ? (
              <button className="admin-secondary-button admin-loyalty-load-more" type="button" disabled={isSearchingUsers} onClick={() => void searchLoyaltyUsers(userKeyword, userPagination.page + 1, selectedTierFilter?._id, true)}>
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
                    {adjustmentDeltaError ? <small className="admin-field-error">{adjustmentDeltaError}</small> : null}
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
                      {(['all', 'earn', 'redeem', 'adjust'] as const).map((type) => <button key={type} type="button" className={historyTypeFilter === type ? 'is-active' : ''} onClick={() => setHistoryTypeFilter(type)}>{type === 'all' ? 'Tất cả' : type === 'earn' ? 'Cộng' : type === 'redeem' ? 'Đổi điểm' : 'Điều chỉnh'}</button>)}
                      <button type="button" disabled={isLoadingHistory || historyPagination.totalItems === 0} onClick={() => void exportPointHistoryCsv()}>Xuất CSV</button>
                    </div>
                  </div>
                  <div className="admin-loyalty-history-date-filters">
                    <label><span>Từ ngày</span><input type="date" value={historyDateFrom} max={historyDateTo || undefined} onChange={(event) => setHistoryDateFrom(event.target.value)} /></label>
                    <label><span>Đến ngày</span><input type="date" value={historyDateTo} min={historyDateFrom || undefined} onChange={(event) => setHistoryDateTo(event.target.value)} /></label>
                    {(historyDateFrom || historyDateTo) ? <button className="admin-link-button" type="button" onClick={() => { setHistoryDateFrom(''); setHistoryDateTo('') }}>Xóa ngày</button> : null}
                  </div>
                  <div className="admin-loyalty-history-summary"><span>Cộng <strong>+{formatNumber(pointHistorySummary.added)}</strong></span><span>Trừ <strong>-{formatNumber(pointHistorySummary.deducted)}</strong></span><small>Toàn bộ kết quả đã lọc</small></div>
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
                  {!isLoadingHistory && pointHistory.length > 0 && filteredPointHistory.length === 0 ? <p>Không có giao dịch thuộc bộ lọc này.</p> : null}
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
                      {visibleHistoryPages.map((pageNumber) => <button className={pageNumber === historyPagination.page ? 'is-active' : 'admin-link-button'} type="button" key={pageNumber} disabled={isLoadingHistory} aria-current={pageNumber === historyPagination.page ? 'page' : undefined} onClick={() => void loadPointHistory(selectedLoyaltyUser._id, pageNumber)}>{pageNumber}</button>)}
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
            <span key={item}><b aria-hidden="true">✓</b>{item}</span>
          ))}
        </div>
      </section>

      {dialog?.type === 'create' || dialog?.type === 'edit' ? (
        <div ref={dialogRef} tabIndex={-1} className="admin-confirm-layer" role="dialog" aria-modal="true" aria-labelledby="admin-tier-dialog-title">
          <form className="admin-account-dialog admin-tier-dialog" onSubmit={handleSubmitTier} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') event.currentTarget.requestSubmit() }}>
            <h2 id="admin-tier-dialog-title">
              {dialog.type === 'create' ? 'Thêm hạng thành viên' : 'Sửa hạng thành viên'}
            </h2>
            {notice ? <p className={`admin-notice is-${notice.type}`} role="status">{notice.message}</p> : null}
            {dialog.type === 'create' ? <div className="admin-tier-template-row"><span>Mẫu nhanh</span>{tierTemplates.map((template) => <button key={template.label} type="button" onClick={() => setTierForm((form) => ({ ...form, ...template.values }))}>{template.label}</button>)}</div> : null}
            {tierDraftRestored ? <div className="admin-tier-draft-notice"><span>Đã khôi phục bản nháp gần nhất.</span><button type="button" onClick={() => { window.localStorage.removeItem(tierDraftKey); setTierForm(emptyTierForm); setTierDraftRestored(false) }}>Bỏ bản nháp</button></div> : null}
            <div className="admin-tier-card-preview" style={{ backgroundColor: tierForm.cardColor, color: tierForm.textColor }}>
              <span style={{ backgroundColor: tierForm.badgeColor }}>{membershipIconSymbols[tierForm.iconName] ?? membershipIconSymbols.star}</span>
              <div><small>FASHIONISTA MEMBER</small><strong>{tierForm.name || 'Tên hạng'}</strong><p>Level {tierForm.level || '—'} · Giảm {tierForm.discountPercent || 0}%</p></div>
              <em>{tierForm.benefitDescription || 'Quyền lợi của thành viên sẽ hiển thị tại đây.'}</em>
            </div>
            <h3 className="admin-tier-form-section-title">Thông tin và quyền lợi</h3>
            <div className="admin-account-form-grid">
              <label>
                <span>Tên hạng</span>
                <input
                  className={(tierSubmitAttempted || tierForm.name.length > 0) && tierErrors.name ? 'is-invalid' : ''}
                  value={tierForm.name}
                  onChange={(event) => setTierForm((form) => ({ ...form, name: event.target.value }))}
                  required
                  minLength={2}
                  maxLength={30}
                />
                {(tierSubmitAttempted || tierForm.name.length > 0) && tierErrors.name ? <small className="admin-field-error">{tierErrors.name}</small> : null}
              </label>
              <label>
                <span>Cấp hạng</span>
                <input
                  className={(tierSubmitAttempted || tierForm.level.length > 0) && tierErrors.level ? 'is-invalid' : ''}
                  type="number"
                  value={tierForm.level}
                  onChange={(event) => setTierForm((form) => ({ ...form, level: event.target.value }))}
                  required
                  min={1}
                  max={20}
                />
                {(tierSubmitAttempted || tierForm.level.length > 0) && tierErrors.level ? <small className="admin-field-error">{tierErrors.level}</small> : null}
                <small className="admin-field-hint">Level càng cao tương ứng hạng càng cao.</small>
              </label>
              <label>
                <span>Điểm tối thiểu</span>
                <input
                  className={(tierSubmitAttempted || tierForm.minPoint.length > 0) && tierErrors.minPoint ? 'is-invalid' : ''}
                  type="number"
                  value={tierForm.minPoint}
                  onChange={(event) => setTierForm((form) => ({ ...form, minPoint: event.target.value }))}
                  required
                  min={0}
                  max={100000000}
                />
                {(tierSubmitAttempted || tierForm.minPoint.length > 0) && tierErrors.minPoint ? <small className="admin-field-error">{tierErrors.minPoint}</small> : null}
                <small className="admin-field-hint">Ví dụ 5.000 điểm tương ứng khoảng 5 triệu đồng chi tiêu với rule mặc định.</small>
              </label>
              <label>
                <span>Điểm tối đa (tự tính)</span>
                <input
                  type="text"
                  value={suggestedMaxPoint === null ? 'Không giới hạn (hạng cao nhất)' : formatNumber(suggestedMaxPoint)}
                  disabled
                />
                <small className="admin-field-hint">Tự động bằng điểm tối thiểu của hạng kế tiếp trừ 1.</small>
              </label>
              <label>
                <span>Giảm giá (%)</span>
                <input
                  className={(tierSubmitAttempted || tierForm.discountPercent.length > 0) && tierErrors.discountPercent ? 'is-invalid' : ''}
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
                {(tierSubmitAttempted || tierForm.discountPercent.length > 0) && tierErrors.discountPercent ? <small className="admin-field-error">{tierErrors.discountPercent}</small> : Number(tierForm.discountPercent) > 15 ? <small className="admin-field-error">Mức trên 15% có thể ảnh hưởng biên lợi nhuận.</small> : <small className="admin-field-hint">Gợi ý: Đồng 0%, Bạc 3%, Vàng 5%, Kim Cương 10%.</small>}
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
            </div>
            <h3 className="admin-tier-form-section-title">Giao diện thẻ</h3>
            <div className="admin-tier-palette-row" aria-label="Bảng màu gợi ý">
              {[
                { name: 'Đồng', card: '#8f5b34', text: '#ffffff', badge: '#d19a66' },
                { name: 'Bạc', card: '#59636e', text: '#ffffff', badge: '#c0c7cf' },
                { name: 'Vàng', card: '#6f5310', text: '#ffffff', badge: '#d4af37' },
                { name: 'Kim cương', card: '#20546b', text: '#ffffff', badge: '#8bd5ee' },
              ].map((palette) => <button key={palette.name} type="button" style={{ backgroundColor: palette.card, color: palette.text }} onClick={() => setTierForm((form) => ({ ...form, cardColor: palette.card, textColor: palette.text, badgeColor: palette.badge }))}>{palette.name}</button>)}
            </div>
            <div className="admin-account-form-grid">
              <label>
                <span>Màu thẻ</span>
                <input
                  className={tierErrors.cardColor ? 'is-invalid' : ''}
                  type="color"
                  value={tierForm.cardColor}
                  onChange={(event) => {
                    const cardColor = event.target.value
                    const textColor = getContrastRatio(cardColor, '#ffffff') >= getContrastRatio(cardColor, '#111827') ? '#ffffff' : '#111827'
                    setTierForm((form) => ({ ...form, cardColor, textColor }))
                  }}
                />
                {tierErrors.cardColor ? <small className="admin-field-error">{tierErrors.cardColor}</small> : null}
              </label>
              <label>
                <span>Màu chữ</span>
                <input
                  className={tierErrors.textColor ? 'is-invalid' : ''}
                  type="color"
                  value={tierForm.textColor}
                  onChange={(event) => setTierForm((form) => ({ ...form, textColor: event.target.value }))}
                />
                {tierErrors.textColor ? <small className="admin-field-error">{tierErrors.textColor}</small> : null}
              </label>
              <label>
                <span>Màu badge</span>
                <input
                  type="color"
                  value={tierForm.badgeColor}
                  onChange={(event) => setTierForm((form) => ({ ...form, badgeColor: event.target.value }))}
                />
              </label>
              <div className="admin-tier-icon-field">
                <span>Icon</span>
                <div className="admin-tier-icon-grid">
                  {iconOptions.map((icon) => <button key={icon.value} type="button" className={tierForm.iconName === icon.value ? 'is-selected' : ''} aria-label={icon.label} title={icon.label} onClick={() => setTierForm((form) => ({ ...form, iconName: icon.value }))}>{membershipIconSymbols[icon.value] ?? '●'}</button>)}
                </div>
              </div>
            </div>
            <p className={`admin-tier-contrast ${tierContrastRatio >= 4.5 ? 'is-valid' : 'is-invalid'}`}>Độ tương phản {tierContrastRatio.toFixed(2)}:1 · {tierContrastRatio >= 4.5 ? 'Đạt chuẩn dễ đọc' : 'Cần tối thiểu 4.5:1'}</p>
            <label>
              <span>Quyền lợi</span>
              <textarea
                className={(tierSubmitAttempted || tierForm.benefitDescription.length > 0) && tierErrors.benefitDescription ? 'is-invalid' : ''}
                value={tierForm.benefitDescription}
                onChange={(event) =>
                  setTierForm((form) => ({ ...form, benefitDescription: event.target.value }))
                }
                required
                minLength={2}
                maxLength={200}
                rows={3}
              />
              {(tierSubmitAttempted || tierForm.benefitDescription.length > 0) && tierErrors.benefitDescription ? <small className="admin-field-error">{tierErrors.benefitDescription}</small> : null}
              <small className="admin-character-count">{tierForm.benefitDescription.length}/200</small>
            </label>
            <div className="admin-dialog-actions">
              <button className="admin-secondary-button" type="button" disabled={actionLoading} onClick={closeDialog}>
                Hủy
              </button>
              <button className="admin-primary-button" type="submit" disabled={actionLoading || Object.keys(tierErrors).length > 0}>
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
      {tierDiscardRequested ? (
        <div ref={tierDiscardDialogRef} tabIndex={-1} className="admin-confirm-layer is-nested" role="dialog" aria-modal="true" aria-labelledby="admin-tier-discard-title">
          <div className="admin-confirm-box"><h2 id="admin-tier-discard-title">Bỏ thay đổi chưa lưu?</h2><p>Bản nháp hạng mới vẫn được giữ để bạn khôi phục lần sau.</p><div className="admin-dialog-actions"><button className="admin-secondary-button" type="button" onClick={() => setTierDiscardRequested(false)}>Tiếp tục chỉnh</button><button className="admin-danger-button" type="button" onClick={forceCloseTierDialog}>Bỏ thay đổi</button></div></div>
        </div>
      ) : null}
    </section>
  )
}
