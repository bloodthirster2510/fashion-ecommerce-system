import { useCallback, useEffect, useMemo, useState } from 'react'
import { hasPermission, type AdminUser } from '../auth/adminSession'
import {
  cancelVirtualTryOnJob,
  createVirtualTryOnPromptRule,
  deleteVirtualTryOnPromptRule,
  getVirtualTryOnSettings,
  getVirtualTryOnSummary,
  hideVirtualTryOnJob,
  listVirtualTryOnAccountLocks,
  listVirtualTryOnJobs,
  listVirtualTryOnPromptViolations,
  listVirtualTryOnPromptRules,
  lockVirtualTryOnAccount,
  retryVirtualTryOnJob,
  retryVirtualTryOnVideo,
  rollbackVirtualTryOnSettings,
  testVirtualTryOnPrompt,
  unlockVirtualTryOnAccount,
  updateVirtualTryOnPromptRule,
  updateVirtualTryOnSettings,
} from './virtualTryOn.service'
import type {
  AdminVirtualTryOnAccountLock,
  AdminVirtualTryOnAccountLockFilters,
  AdminVirtualTryOnAccountLockList,
  AdminVirtualTryOnFilters,
  AdminVirtualTryOnJob,
  AdminVirtualTryOnJobList,
  AdminVirtualTryOnPromptRule,
  AdminVirtualTryOnPromptRuleFilters,
  AdminVirtualTryOnPromptRuleList,
  AdminVirtualTryOnPromptViolationFilters,
  AdminVirtualTryOnPromptViolationList,
  AdminVirtualTryOnPromptTestResult,
  AdminVirtualTryOnSettings,
  AdminVirtualTryOnSettingsConfiguration,
  AdminVirtualTryOnSummary,
  PromptPolicyCategory,
  VirtualTryOnJobStatus,
} from './virtualTryOn.types'
import './virtualTryOn.css'

const initialFilters: AdminVirtualTryOnFilters = {
  page: 1,
  keyword: '',
  status: '',
  provider: '',
  dateFrom: '',
  dateTo: '',
}

const statusMeta: Record<VirtualTryOnJobStatus, { label: string; className: string }> = {
  queued: { label: 'Đang chờ', className: 'is-waiting' },
  processing: { label: 'Đang xử lý', className: 'is-processing' },
  succeeded: { label: 'Thành công', className: 'is-success' },
  failed: { label: 'Lỗi', className: 'is-danger' },
  canceled: { label: 'Đã hủy', className: 'is-muted' },
}

const contextLabels: Record<string, string> = {
  none: 'Không đổi nền',
  work: 'Đi làm',
  casual: 'Đi chơi',
  party: 'Dự tiệc',
  travel: 'Du lịch',
  sport: 'Thể thao',
  date: 'Hẹn hò',
  custom: 'Tự mô tả',
}

const outfitModeLabels: Record<AdminVirtualTryOnJob['outfitMode'], string> = {
  single: 'Một món',
  top_bottom: 'Áo + quần',
  full_set: 'Trọn bộ',
}

const outputModeLabels: Record<AdminVirtualTryOnJob['outputMode'], string> = {
  image: 'Ảnh',
  image_and_video: 'Ảnh + video',
}

const videoStatusLabels: Record<AdminVirtualTryOnJob['videoStatus'], string> = {
  not_requested: 'Không yêu cầu',
  queued: 'Đang chờ',
  processing: 'Đang sinh',
  succeeded: 'Thành công',
  failed: 'Lỗi',
  canceled: 'Đã hủy',
}

const processingStageLabels: Record<AdminVirtualTryOnJob['processingStage'], string> = {
  queued: 'Đang chờ',
  image_generation: 'Đang tạo ảnh',
  image_persisting: 'Đang lưu ảnh',
  video_generation: 'Đang tạo video',
  video_persisting: 'Đang lưu video',
  completed: 'Hoàn tất',
}

const itemRoleLabels: Record<string, string> = {
  top: 'Áo',
  bottom: 'Quần/váy',
  dress: 'Đầm',
  shoes: 'Giày',
  outerwear: 'Áo khoác',
  accessory: 'Phụ kiện',
}

const promptPolicyCategoryLabels: Record<PromptPolicyCategory, string> = {
  sexual_content: 'Nội dung nhạy cảm',
  violence: 'Bạo lực',
  prompt_injection: 'Can thiệp chỉ dẫn AI',
  personal_data: 'Dữ liệu cá nhân',
  hate_or_harassment: 'Thù ghét/quấy rối',
  unsafe_request: 'Yêu cầu không an toàn',
}

const promptPolicyCategoryOptions: PromptPolicyCategory[] = [
  'sexual_content',
  'violence',
  'prompt_injection',
  'personal_data',
  'hate_or_harassment',
  'unsafe_request',
]

type AdminTab = 'jobs' | 'promptViolations' | 'promptRules' | 'accountLocks' | 'settings'

const initialPromptViolationFilters: AdminVirtualTryOnPromptViolationFilters = {
  page: 1,
  keyword: '',
  category: '',
  action: '',
  dateFrom: '',
  dateTo: '',
}

const initialPromptRuleFilters: AdminVirtualTryOnPromptRuleFilters = {
  page: 1,
  keyword: '',
  category: '',
  enabled: '',
}

const initialAccountLockFilters: AdminVirtualTryOnAccountLockFilters = {
  page: 1,
  keyword: '',
  locked: 'true',
}

const formatDate = (value: string) => new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
}).format(new Date(value))

const formatPrice = (value: number) => `${Math.round(value).toLocaleString('vi-VN')}đ`

const getUserLabel = (job: AdminVirtualTryOnJob) => {
  if (!job.user) return 'Không rõ khách'
  return job.user.name || job.user.email
}

const getJobResultLabel = (job: AdminVirtualTryOnJob) => {
  if (job.generatedImageUrls?.length) return `${job.generatedImageUrls.length} ảnh kết quả`
  if (job.generatedImageUrl) return '1 ảnh kết quả'
  return 'Chưa có kết quả'
}

const getJobLeadImage = (job: AdminVirtualTryOnJob) =>
  job.generatedImageUrl || job.generatedImageUrls?.[0] || job.selectedItems[0]?.imageSnapshot || job.sourceImageUrl || ''

const getShortId = (value: string) => value.slice(-8)

const copyTextToClipboard = async (value: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  document.body.removeChild(textarea)
  if (!copied) throw new Error('Copy failed')
}

const getJobAgeMinutes = (job: AdminVirtualTryOnJob) =>
  Math.max(0, Math.round((Date.now() - new Date(job.createdAt).getTime()) / 60000))

const getJobAgeLabel = (job: AdminVirtualTryOnJob) => {
  const minutes = getJobAgeMinutes(job)
  if (minutes < 60) return `${minutes} phút trước`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} giờ trước`
  return `${Math.floor(hours / 24)} ngày trước`
}

const isPolicyClosedJob = (job: AdminVirtualTryOnJob) =>
  job.errorCode === 'PROVIDER_SAFETY_BLOCKED'

const isPolicyClosedVideo = (job: AdminVirtualTryOnJob) =>
  job.videoErrorCode === 'VIDEO_PROVIDER_SAFETY_BLOCKED'

const needsAdminAttention = (job: AdminVirtualTryOnJob) => (
  job.status === 'failed'
  || job.videoStatus === 'failed'
  || (job.status === 'queued' && getJobAgeMinutes(job) >= 5)
  || (job.status === 'processing' && getJobAgeMinutes(job) >= 15)
)

const getJobPriority = (job: AdminVirtualTryOnJob) => {
  if (job.status === 'failed' || job.videoStatus === 'failed') return 0
  if (job.status === 'processing' && getJobAgeMinutes(job) >= 15) return 1
  if (job.status === 'queued' && getJobAgeMinutes(job) >= 5) return 2
  if (job.status === 'processing') return 3
  if (job.status === 'queued') return 4
  if (job.status === 'succeeded') return 5
  return 6
}

const toSettingsConfiguration = (
  settings: AdminVirtualTryOnSettings,
): AdminVirtualTryOnSettingsConfiguration => ({
  runtimeEnabled: settings.runtimeEnabled,
  maxConcurrentJobsPerUser: settings.maxConcurrentJobsPerUser,
  maxVideoJobsPerUserPerDay: settings.maxVideoJobsPerUserPerDay,
  maxConcurrentVideoJobsPerUser: settings.maxConcurrentVideoJobsPerUser,
  promptMaxLength: settings.promptMaxLength,
  promptViolationLimitPerDay: settings.promptViolationLimitPerDay,
})

export function VirtualTryOnManagementPage({ currentUser }: { currentUser: AdminUser }) {
  const canRead = hasPermission(currentUser, 'virtual_try_on.read')
  const canManage = hasPermission(currentUser, 'virtual_try_on.manage')
  const canSettings = hasPermission(currentUser, 'virtual_try_on.settings')
  const [filters, setFilters] = useState(initialFilters)
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  const [data, setData] = useState<AdminVirtualTryOnJobList | null>(null)
  const [summary, setSummary] = useState<AdminVirtualTryOnSummary | null>(null)
  const [settings, setSettings] = useState<AdminVirtualTryOnSettings | null>(null)
  const [settingsDraft, setSettingsDraft] = useState<AdminVirtualTryOnSettingsConfiguration | null>(null)
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [rollbackVersion, setRollbackVersion] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [selectedJob, setSelectedJob] = useState<AdminVirtualTryOnJob | null>(null)
  const [promptInput, setPromptInput] = useState('')
  const [promptResult, setPromptResult] = useState<AdminVirtualTryOnPromptTestResult | null>(null)
  const [promptTesting, setPromptTesting] = useState(false)
  const [activeTab, setActiveTab] = useState<AdminTab>(() => (
    canRead ? 'jobs' : canManage ? 'promptViolations' : 'settings'
  ))
  const [promptRuleFilters, setPromptRuleFilters] = useState(initialPromptRuleFilters)
  const [promptRuleData, setPromptRuleData] = useState<AdminVirtualTryOnPromptRuleList | null>(null)
  const [promptRuleLoading, setPromptRuleLoading] = useState(false)
  const [promptRuleForm, setPromptRuleForm] = useState<{ term: string; category: PromptPolicyCategory; reasonCode: string; enabled: boolean }>({
    term: '',
    category: 'sexual_content',
    reasonCode: '',
    enabled: true,
  })
  const [promptRuleSaving, setPromptRuleSaving] = useState(false)
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)
  const [promptViolationFilters, setPromptViolationFilters] = useState(initialPromptViolationFilters)
  const [promptViolationData, setPromptViolationData] = useState<AdminVirtualTryOnPromptViolationList | null>(null)
  const [promptViolationLoading, setPromptViolationLoading] = useState(false)
  const [accountLockFilters, setAccountLockFilters] = useState(initialAccountLockFilters)
  const [accountLockData, setAccountLockData] = useState<AdminVirtualTryOnAccountLockList | null>(null)
  const [accountLockLoading, setAccountLockLoading] = useState(false)
  const [lockForm, setLockForm] = useState<{ userId: string; reason: string }>({ userId: '', reason: '' })
  const [lockSaving, setLockSaving] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedKeyword(filters.keyword), 350)
    return () => window.clearTimeout(timer)
  }, [filters.keyword])

  const effectiveFilters = useMemo(() => ({
    ...filters,
    keyword: debouncedKeyword,
  }), [debouncedKeyword, filters])

  const loadJobs = useCallback(async (silent = false) => {
    if (!canRead) {
      setLoading(false)
      return
    }
    if (!silent) setLoading(true)
    try {
      setData(await listVirtualTryOnJobs(effectiveFilters))
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Không thể tải lượt phối đồ' })
    } finally {
      if (!silent) setLoading(false)
    }
  }, [canRead, effectiveFilters])

  const loadSummary = useCallback(async () => {
    if (!canRead) return
    try {
      setSummary(await getVirtualTryOnSummary())
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Không thể tải tổng quan phối đồ ảo' })
    }
  }, [canRead])

  const loadSettings = useCallback(async () => {
    if (!canSettings) return
    setSettingsLoading(true)
    try {
      const nextSettings = await getVirtualTryOnSettings()
      setSettings(nextSettings)
      setSettingsDraft(toSettingsConfiguration(nextSettings))
      setRollbackVersion('')
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Không thể tải cấu hình phối đồ ảo' })
    } finally {
      setSettingsLoading(false)
    }
  }, [canSettings])

  useEffect(() => { void loadJobs() }, [loadJobs])
  useEffect(() => { void loadSummary() }, [loadSummary])
  useEffect(() => { if (canSettings) void loadSettings() }, [canSettings, loadSettings])

  useEffect(() => {
    if (!autoRefreshEnabled || activeTab !== 'jobs' || !canRead) return undefined
    const timer = window.setInterval(() => {
      void Promise.all([loadJobs(true), loadSummary()])
    }, 30_000)
    return () => window.clearInterval(timer)
  }, [activeTab, autoRefreshEnabled, canRead, loadJobs, loadSummary])

  useEffect(() => {
    if (!selectedJob) return undefined
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedJob(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [selectedJob])

  const updateFilter = (key: keyof AdminVirtualTryOnFilters, value: string | number) => {
    setFilters((current) => ({ ...current, [key]: value, ...(key !== 'page' ? { page: 1 } : {}) }))
  }

  const runAction = async (action: () => Promise<AdminVirtualTryOnJob>, successMessage: string) => {
    setActionLoading(true)
    setNotice(null)
    try {
      const updated = await action()
      setSelectedJob((current) => current?._id === updated._id ? updated : current)
      await Promise.all([loadJobs(), loadSummary()])
      setNotice({ type: 'success', message: successMessage })
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Không thể xử lý lượt phối đồ' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleRetry = (job: AdminVirtualTryOnJob) =>
    runAction(() => retryVirtualTryOnJob(job._id), 'Đã đưa lượt xử lý vào hàng chờ.')

  const handleRetryVideo = (job: AdminVirtualTryOnJob) =>
    runAction(() => retryVirtualTryOnVideo(job._id), 'Đã đưa bước tạo video vào hàng chờ.')

  const handleCancel = (job: AdminVirtualTryOnJob) => {
    if (!window.confirm(`Hủy lượt phối đồ #${getShortId(job._id)}?`)) return
    void runAction(() => cancelVirtualTryOnJob(job._id), 'Đã hủy lượt phối đồ.')
  }

  const handleHide = (job: AdminVirtualTryOnJob) => {
    if (!window.confirm('Ẩn lượt này khỏi danh sách quản trị và lịch sử khách hàng? Hiện chưa có thao tác khôi phục trên giao diện.')) return
    void runAction(() => hideVirtualTryOnJob(job._id), 'Đã ẩn lượt phối đồ khỏi lịch sử.')
  }

  const handlePromptTest = async () => {
    if (!promptInput.trim()) {
      setPromptResult({
        allowed: false,
        normalizedPrompt: null,
        reasonCode: 'PROMPT_REQUIRED',
        message: 'Vui lòng nhập mô tả cần kiểm tra.',
        maxLength: settings?.promptMaxLength ?? 200,
      })
      return
    }
    setPromptTesting(true)
    setPromptResult(null)
    try {
      setPromptResult(await testVirtualTryOnPrompt(promptInput))
    } catch (error) {
      setPromptResult({
        allowed: false,
        normalizedPrompt: null,
        reasonCode: 'REQUEST_FAILED',
        message: error instanceof Error ? error.message : 'Không thể kiểm tra mô tả',
        maxLength: settings?.promptMaxLength ?? 200,
      })
    } finally {
      setPromptTesting(false)
    }
  }

  const handleSaveSettings = async () => {
    if (!settings || !settingsDraft) return
    setSettingsSaving(true)
    setNotice(null)
    try {
      const updated = await updateVirtualTryOnSettings(settings.version, settingsDraft)
      setSettings(updated)
      setSettingsDraft(toSettingsConfiguration(updated))
      setRollbackVersion('')
      await loadSummary()
      setNotice({ type: 'success', message: 'Đã cập nhật cấu hình phối đồ ảo.' })
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Không thể cập nhật cấu hình phối đồ ảo' })
    } finally {
      setSettingsSaving(false)
    }
  }

  const handleRollbackSettings = async () => {
    if (!settings || !rollbackVersion) return
    const targetVersion = Number(rollbackVersion)
    if (!window.confirm(`Khôi phục cấu hình từ phiên bản v${targetVersion}? Hệ thống sẽ lưu thành một phiên bản mới.`)) return
    setSettingsSaving(true)
    setNotice(null)
    try {
      const updated = await rollbackVirtualTryOnSettings(settings.version, targetVersion)
      setSettings(updated)
      setSettingsDraft(toSettingsConfiguration(updated))
      setRollbackVersion('')
      await loadSummary()
      setNotice({ type: 'success', message: `Đã khôi phục cấu hình từ v${targetVersion}.` })
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Không thể khôi phục cấu hình phối đồ ảo' })
    } finally {
      setSettingsSaving(false)
    }
  }

  const loadPromptRules = useCallback(async () => {
    setPromptRuleLoading(true)
    try {
      setPromptRuleData(await listVirtualTryOnPromptRules(promptRuleFilters))
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Không thể tải quy tắc nội dung' })
    } finally {
      setPromptRuleLoading(false)
    }
  }, [promptRuleFilters])

  useEffect(() => {
    if (activeTab === 'promptRules') void loadPromptRules()
  }, [activeTab, loadPromptRules])

  const updatePromptRuleFilter = (key: keyof AdminVirtualTryOnPromptRuleFilters, value: string) => {
    setPromptRuleFilters((current) => ({ ...current, [key]: value, ...(key !== 'page' ? { page: 1 } : {}) }))
  }

  const resetPromptRuleForm = () => {
    setEditingRuleId(null)
    setPromptRuleForm({ term: '', category: 'sexual_content', reasonCode: '', enabled: true })
  }

  const startEditPromptRule = (rule: AdminVirtualTryOnPromptRule) => {
    setEditingRuleId(rule._id)
    setPromptRuleForm({ term: rule.term, category: rule.category, reasonCode: rule.reasonCode, enabled: rule.enabled })
  }

  const handleSavePromptRule = async () => {
    if (!promptRuleForm.term.trim()) {
      setNotice({ type: 'error', message: 'Vui lòng nhập cụm từ cần chặn' })
      return
    }
    setPromptRuleSaving(true)
    setNotice(null)
    try {
      if (editingRuleId) {
        await updateVirtualTryOnPromptRule(editingRuleId, promptRuleForm)
        await loadPromptRules()
        setNotice({ type: 'success', message: 'Đã cập nhật quy tắc nội dung.' })
      } else {
        await createVirtualTryOnPromptRule(promptRuleForm)
        await loadPromptRules()
        setNotice({ type: 'success', message: 'Đã thêm quy tắc nội dung.' })
      }
      resetPromptRuleForm()
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Không thể lưu quy tắc nội dung' })
    } finally {
      setPromptRuleSaving(false)
    }
  }

  const handleTogglePromptRule = async (rule: AdminVirtualTryOnPromptRule) => {
    setNotice(null)
    try {
      await updateVirtualTryOnPromptRule(rule._id, { enabled: !rule.enabled })
      await loadPromptRules()
      setNotice({ type: 'success', message: rule.enabled ? 'Đã tắt quy tắc.' : 'Đã bật quy tắc.' })
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Không thể đổi trạng thái quy tắc' })
    }
  }

  const handleDeletePromptRule = async (rule: AdminVirtualTryOnPromptRule) => {
    if (!window.confirm(`Xóa quy tắc chặn "${rule.term}"?`)) return
    setNotice(null)
    try {
      await deleteVirtualTryOnPromptRule(rule._id)
      if (editingRuleId === rule._id) resetPromptRuleForm()
      await loadPromptRules()
      setNotice({ type: 'success', message: 'Đã xóa quy tắc nội dung.' })
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Không thể xóa quy tắc nội dung' })
    }
  }

  const loadPromptViolations = useCallback(async () => {
    setPromptViolationLoading(true)
    try {
      setPromptViolationData(await listVirtualTryOnPromptViolations(promptViolationFilters))
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Không thể tải lịch sử vi phạm nội dung' })
    } finally {
      setPromptViolationLoading(false)
    }
  }, [promptViolationFilters])

  useEffect(() => {
    if (activeTab === 'promptViolations') void loadPromptViolations()
  }, [activeTab, loadPromptViolations])

  const updatePromptViolationFilter = (key: keyof AdminVirtualTryOnPromptViolationFilters, value: string) => {
    setPromptViolationFilters((current) => ({
      ...current,
      [key]: key === 'page' ? Number(value) : value,
      ...(key !== 'page' ? { page: 1 } : {}),
    }))
  }

  const loadAccountLocks = useCallback(async () => {
    setAccountLockLoading(true)
    try {
      setAccountLockData(await listVirtualTryOnAccountLocks(accountLockFilters))
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Không thể tải danh sách tài khoản hạn chế' })
    } finally {
      setAccountLockLoading(false)
    }
  }, [accountLockFilters])

  useEffect(() => {
    if (activeTab === 'accountLocks') void loadAccountLocks()
  }, [activeTab, loadAccountLocks])

  const updateAccountLockFilter = (key: keyof AdminVirtualTryOnAccountLockFilters, value: string) => {
    setAccountLockFilters((current) => ({ ...current, [key]: value, ...(key !== 'page' ? { page: 1 } : {}) }))
  }

  const handleCopyValue = async (value: string | null | undefined, label: string, copyKey = value ?? '') => {
    if (!value) return
    try {
      await copyTextToClipboard(value)
      setCopiedKey(copyKey)
      window.setTimeout(() => {
        setCopiedKey((current) => (current === copyKey ? null : current))
      }, 1200)
    } catch {
      setNotice({ type: 'error', message: `Không thể sao chép ${label}.` })
    }
  }

  const handleLockAccount = async () => {
    if (!lockForm.userId.trim()) {
      setNotice({ type: 'error', message: 'Vui lòng nhập email hoặc mã khách hàng' })
      return
    }
    if (lockForm.reason.trim().length < 3) {
      setNotice({ type: 'error', message: 'Vui lòng nhập lý do hạn chế từ 3 ký tự' })
      return
    }
    setLockSaving(true)
    setNotice(null)
    try {
      await lockVirtualTryOnAccount({ userId: lockForm.userId.trim(), reason: lockForm.reason.trim() })
      setLockForm({ userId: '', reason: '' })
      await loadAccountLocks()
      setNotice({ type: 'success', message: 'Đã hạn chế tính năng phối đồ ảo của khách hàng.' })
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Không thể hạn chế tính năng phối đồ ảo' })
    } finally {
      setLockSaving(false)
    }
  }

  const handleUnlockAccount = async (lock: AdminVirtualTryOnAccountLock) => {
    if (!window.confirm(`Gỡ hạn chế phối đồ ảo cho ${lock.user.name || lock.user.email}?`)) return
    setNotice(null)
    try {
      await unlockVirtualTryOnAccount(lock.user._id)
      await loadAccountLocks()
      setNotice({ type: 'success', message: 'Đã gỡ hạn chế phối đồ ảo.' })
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Không thể gỡ hạn chế phối đồ ảo' })
    }
  }

  const handleLockAccountById = (userId: string, userLabel?: string, reason = '') => {
    setLockForm({ userId, reason })
    setSelectedJob(null)
    setActiveTab('accountLocks')
    setNotice({
      type: 'success',
      message: reason
        ? `Đã chọn ${userLabel || userId}. Kiểm tra lý do rồi xác nhận hạn chế.`
        : `Đã chọn ${userLabel || userId}. Nhập lý do để xác nhận hạn chế.`,
    })
  }

  const refreshActiveTab = async () => {
    setNotice(null)
    if (activeTab === 'jobs') {
      await Promise.all([loadJobs(), loadSummary()])
      return
    }
    if (activeTab === 'promptRules') {
      await loadPromptRules()
      return
    }
    if (activeTab === 'promptViolations') {
      await loadPromptViolations()
      return
    }
    if (activeTab === 'accountLocks') {
      await loadAccountLocks()
      return
    }
    await loadSettings()
  }

  const pagination = data?.pagination
  const jobs = data?.items ?? []
  const orderedJobs = [...jobs].sort((left, right) => {
    const priorityDifference = getJobPriority(left) - getJobPriority(right)
    if (priorityDifference) return priorityDifference
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  })
  const activeJobCount = summary ? summary.queued + summary.processing : '—'
  const statusOverview = Object.entries(statusMeta).map(([status, meta]) => ({
    status: status as VirtualTryOnJobStatus,
    ...meta,
    count: summary ? summary[status as VirtualTryOnJobStatus] : '—',
  }))
  const hasActiveFilters = Boolean(filters.keyword || filters.status || filters.provider || filters.dateFrom || filters.dateTo)
  const isActiveTabLoading = loading
    || settingsLoading
    || promptRuleLoading
    || promptViolationLoading
    || accountLockLoading
  const generatedImages = selectedJob?.generatedImageUrls?.length
    ? selectedJob.generatedImageUrls
    : selectedJob?.generatedImageUrl
      ? [selectedJob.generatedImageUrl]
      : []

  return (
    <section className="admin-vto-page">
      <header className="admin-vto-ops-bar">
        <div className="admin-vto-ops-copy">
          <span>Phối đồ ảo</span>
          <strong>Vận hành và kiểm soát</strong>
          <p>Theo dõi lượt tạo, kết quả, nội dung và giới hạn sử dụng.</p>
        </div>
        <div className="admin-vto-ops-actions">
          {activeTab === 'jobs' ? (
            <label className="admin-vto-auto-refresh">
              <input
                type="checkbox"
                checked={autoRefreshEnabled}
                onChange={(event) => setAutoRefreshEnabled(event.target.checked)}
              />
              <span>Tự làm mới 30 giây</span>
            </label>
          ) : null}
          <button type="button" onClick={() => void refreshActiveTab()} disabled={isActiveTabLoading}>
            {isActiveTabLoading ? 'Đang tải...' : 'Làm mới'}
          </button>
        </div>
      </header>

      {notice ? (
        <div className={`admin-vto-notice ${notice.type === 'error' ? 'is-error' : 'is-success'}`} role="alert">
          {notice.message}
        </div>
      ) : null}

      <nav className="admin-vto-tabs" aria-label="Khu vực quản trị phối đồ ảo" role="tablist">
        {canRead ? (
          <button type="button" role="tab" aria-selected={activeTab === 'jobs'} className={activeTab === 'jobs' ? 'is-active' : ''} onClick={() => setActiveTab('jobs')}>
            Lượt phối đồ
          </button>
        ) : null}
        {canManage ? (
          <button type="button" role="tab" aria-selected={activeTab === 'promptViolations'} className={activeTab === 'promptViolations' ? 'is-active' : ''} onClick={() => setActiveTab('promptViolations')}>
            Vi phạm nội dung
          </button>
        ) : null}
        {canSettings ? (
          <button type="button" role="tab" aria-selected={activeTab === 'promptRules'} className={activeTab === 'promptRules' ? 'is-active' : ''} onClick={() => setActiveTab('promptRules')}>
            Quy tắc nội dung
          </button>
        ) : null}
        {canManage ? (
          <button type="button" role="tab" aria-selected={activeTab === 'accountLocks'} className={activeTab === 'accountLocks' ? 'is-active' : ''} onClick={() => setActiveTab('accountLocks')}>
            Tài khoản hạn chế
          </button>
        ) : null}
        {canSettings ? (
          <button type="button" role="tab" aria-selected={activeTab === 'settings'} className={activeTab === 'settings' ? 'is-active' : ''} onClick={() => setActiveTab('settings')}>
            Cấu hình
          </button>
        ) : null}
      </nav>

      {activeTab === 'jobs' || activeTab === 'settings' ? (
        <>
      <div className="admin-vto-layout">
        <section className="admin-vto-main" style={{ display: activeTab === 'jobs' ? undefined : 'none' }}>
          <div className="admin-vto-queue-summary">
            <div>
              <span>Hàng chờ vận hành</span>
              <strong>{activeJobCount} lượt đang hoạt động</strong>
            </div>
            <p>
              Hôm nay {summary?.today ?? '—'} lượt · {summary?.todaySucceeded ?? '—'} thành công · {summary?.todayFailed ?? '—'} lỗi
            </p>
          </div>
          <div className="admin-vto-status-board" aria-label="Tổng quan trạng thái lượt phối đồ">
            <button
              type="button"
              className={`admin-vto-status-card is-overall ${filters.status ? '' : 'is-active'}`}
              onClick={() => updateFilter('status', '')}
            >
              <span>Tất cả</span>
              <strong>{summary?.total ?? 0}</strong>
            </button>
            {statusOverview.map((item) => (
              <button
                type="button"
                key={item.status}
                className={`admin-vto-status-card ${item.className} ${filters.status === item.status ? 'is-active' : ''}`}
                onClick={() => updateFilter('status', filters.status === item.status ? '' : item.status)}
              >
                <span>{item.label}</span>
                <strong>{item.count}</strong>
              </button>
            ))}
          </div>

          <div className="admin-vto-toolbar">
            <input
              value={filters.keyword}
              onChange={(event) => updateFilter('keyword', event.target.value)}
              placeholder="Tìm mã lượt, khách hàng, sản phẩm hoặc lỗi..."
              aria-label="Tìm lượt phối đồ"
            />
            <input
              value={filters.provider}
              onChange={(event) => updateFilter('provider', event.target.value)}
              placeholder="Dịch vụ AI"
              aria-label="Lọc theo dịch vụ AI"
            />
            <input type="date" aria-label="Từ ngày" value={filters.dateFrom} onChange={(event) => updateFilter('dateFrom', event.target.value)} />
            <input type="date" aria-label="Đến ngày" value={filters.dateTo} onChange={(event) => updateFilter('dateTo', event.target.value)} />
            <button
              type="button"
              className="admin-vto-filter-reset"
              disabled={!hasActiveFilters}
              onClick={() => setFilters(initialFilters)}
            >
              Xóa lọc
            </button>
          </div>

          <div className="admin-vto-table-shell">
            {loading ? (
              <div className="admin-table-skeleton">
                <span /><span /><span /><span />
              </div>
            ) : orderedJobs.length ? (
              <table className="admin-vto-table">
                <thead>
                  <tr>
                    <th>Lượt xử lý</th>
                    <th>Khách hàng</th>
                    <th>Yêu cầu</th>
                    <th>Trạng thái</th>
                    <th>Thời gian</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {orderedJobs.map((job) => {
                    const status = statusMeta[job.status]
                    return (
                      <tr key={job._id} className={needsAdminAttention(job) ? 'needs-attention' : undefined}>
                        <td>
                          <button className="admin-vto-job-link" type="button" onClick={() => setSelectedJob(job)}>
                            <span className="admin-vto-job-preview" aria-hidden="true">
                              {getJobLeadImage(job) ? (
                                <img src={getJobLeadImage(job)} alt="" />
                              ) : (
                                <i />
                              )}
                            </span>
                            <span className="admin-vto-job-code">
                              <strong>{getShortId(job._id)}</strong>
                              <span>{getJobResultLabel(job)}</span>
                              <span>{getJobAgeLabel(job)}</span>
                            </span>
                          </button>
                        </td>
                        <td>
                          <div className="admin-vto-user">
                            <strong>{getUserLabel(job)}</strong>
                            <span>{job.user?.email ?? 'Không có email'}</span>
                          </div>
                        </td>
                        <td>
                          <div className="admin-vto-products">
                            {job.selectedItems.slice(0, 2).map((item) => (
                              <span key={`${job._id}-${item.productId}-${item.nameSnapshot}`}>{item.nameSnapshot}</span>
                            ))}
                            {job.selectedItems.length > 2 ? <em>+{job.selectedItems.length - 2} món</em> : null}
                            <em>{outputModeLabels[job.outputMode]} · {outfitModeLabels[job.outfitMode]}</em>
                            <strong>{contextLabels[job.contextPreset] ?? job.contextPreset}</strong>
                          </div>
                        </td>
                        <td>
                          <span className={`admin-vto-status ${status.className}`}>{status.label}</span>
                          <span className="admin-vto-progress" aria-label={`Tiến trình ${job.progress}%`}>
                            <i style={{ width: `${Math.max(0, Math.min(job.progress, 100))}%` }} />
                          </span>
                          <small>{processingStageLabels[job.processingStage]} · {job.progress}%</small>
                          {job.errorCode ? <small className="admin-vto-table-error">{job.errorCode}</small> : null}
                        </td>
                        <td>
                          <div className="admin-vto-date">
                            <span>{formatDate(job.createdAt)}</span>
                            {job.completedAt ? <small>Xong {formatDate(job.completedAt)}</small> : null}
                          </div>
                        </td>
                        <td>
                          <div className="admin-vto-actions">
                            <button type="button" className="is-primary" onClick={() => setSelectedJob(job)}>
                              Xem & xử lý
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <div className="admin-vto-empty">
                <strong>Chưa có lượt phối đồ</strong>
                <span>Lượt tạo ảnh hoặc video của khách hàng sẽ xuất hiện tại đây.</span>
              </div>
            )}
          </div>

          {pagination && pagination.totalPages > 1 ? (
            <footer className="admin-table-footer">
              <span>Trang {pagination.page}/{pagination.totalPages} · {pagination.totalItems} lượt</span>
              <div>
                <button type="button" disabled={pagination.page <= 1} onClick={() => updateFilter('page', pagination.page - 1)}>Trước</button>
                <button type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => updateFilter('page', pagination.page + 1)}>Sau</button>
              </div>
            </footer>
          ) : null}
        </section>

        <aside className="admin-vto-side" style={{ display: activeTab === 'settings' ? undefined : 'none' }}>
          <section className="admin-vto-panel admin-vto-settings-panel">
            <div className="admin-vto-settings-head">
              <div>
                <h2>Cấu hình và trạng thái dịch vụ</h2>
                <p>
                  {settings
                    ? settings.persisted ? `Phiên bản v${settings.version}` : 'Đang dùng cấu hình mặc định'
                    : settingsLoading ? 'Đang tải cấu hình...' : 'Chưa có dữ liệu cấu hình'}
                  {settings?.updatedAt ? ` · cập nhật ${formatDate(settings.updatedAt)}` : ''}
                </p>
              </div>
              <span className={settings ? (settings.enabled ? 'is-ready' : 'is-offline') : undefined}>
                {settings ? (settings.enabled ? 'Đang phục vụ' : 'Đang tắt') : 'Chưa có dữ liệu'}
              </span>
            </div>
            <div className="admin-vto-config-grid">
              <section className="admin-vto-config-group is-image">
                <h3>Tạo ảnh</h3>
                <dl>
                  <div><dt>Trạng thái</dt><dd>{settings ? (settings.image.enabled ? 'Đang bật' : 'Đang tắt') : '-'}</dd></div>
                  <div><dt>Dịch vụ AI</dt><dd>{settings?.image.provider ?? '-'}</dd></div>
                  <div><dt>Mô hình AI</dt><dd>{settings?.image.model ?? '-'}</dd></div>
                  <div><dt>Đầu ra ảnh</dt><dd>{settings ? `${settings.image.outputCount} ảnh · ${settings.image.aspectRatio} · ${settings.image.resolution}` : '-'}</dd></div>
                  <div><dt>Số món tối đa</dt><dd>{settings?.maxSelectedItems ?? '-'}</dd></div>
                  <div><dt>Lượt đồng thời mỗi khách</dt><dd>{settings?.maxConcurrentJobsPerUser ?? '-'}</dd></div>
                  <div><dt>Ảnh nguồn tối đa</dt><dd>{settings ? `${settings.sourceImageMaxMb} MB` : '-'}</dd></div>
                </dl>
              </section>

              <section className="admin-vto-config-group is-video">
                <h3>Tạo video</h3>
                <dl>
                  <div>
                    <dt>Trạng thái</dt>
                    <dd>
                      {settings
                        ? settings.videoEnabled
                          ? 'Sẵn sàng'
                          : settings.video.enabled
                            ? `Chưa sẵn sàng (${settings.video.reasonCode || 'thiếu cấu hình'})`
                            : 'Đang tắt'
                        : '-'}
                    </dd>
                  </div>
                  <div><dt>Dịch vụ AI</dt><dd>{settings?.video.provider ?? '-'}</dd></div>
                  <div><dt>Mô hình AI</dt><dd>{settings?.video.model ?? '-'}</dd></div>
                  <div>
                    <dt>Đầu ra video</dt>
                    <dd>
                      {settings
                        ? `Mặc định ${settings.video.durationSeconds} giây · ${settings.video.minDurationSeconds}–${settings.video.maxDurationSeconds} giây · ${settings.video.resolution}`
                        : '-'}
                    </dd>
                  </div>
                  <div><dt>Video mỗi khách/ngày</dt><dd>{settings?.maxVideoJobsPerUserPerDay ?? '-'}</dd></div>
                  <div><dt>Video đồng thời mỗi khách</dt><dd>{settings?.maxConcurrentVideoJobsPerUser ?? '-'}</dd></div>
                </dl>
              </section>

              <section className="admin-vto-config-group is-validation">
                <h3>Kiểm tra ảnh nguồn</h3>
                <dl>
                  <div>
                    <dt>Trạng thái</dt>
                    <dd>{settings ? (settings.imageValidation.available ? 'Sẵn sàng' : 'Không sẵn sàng') : '-'}</dd>
                  </div>
                  <div>
                    <dt>Dịch vụ kiểm tra</dt>
                    <dd>{settings?.imageValidation.provider ?? '-'}</dd>
                  </div>
                  <div>
                    <dt>Cơ chế dự phòng</dt>
                    <dd>
                      {settings?.imageValidation.fallback
                        ? 'Dữ liệu mô phỏng'
                        : settings?.imageValidation.requestedProvider ?? '-'}
                    </dd>
                  </div>
                  <div>
                    <dt>Khi dịch vụ lỗi</dt>
                    <dd>{settings ? (settings.imageValidation.failOpen ? 'Cho phép tiếp tục' : 'Tạm dừng yêu cầu') : '-'}</dd>
                  </div>
                  <div>
                    <dt>Phản hồi gần nhất</dt>
                    <dd>
                      {settings?.imageValidation.available
                        ? `${settings.imageValidation.latencyMs ?? 0} ms`
                        : settings?.imageValidation.reasonCode ?? '-'}
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="admin-vto-config-group is-policy">
                <h3>Mô tả & an toàn</h3>
                <dl>
                  <div><dt>Độ dài mô tả tối đa</dt><dd>{settings?.promptMaxLength ?? '-'}</dd></div>
                  <div><dt>Vi phạm hôm nay</dt><dd>{summary?.promptViolationsToday ?? '-'}</dd></div>
                  <div><dt>Tạm chặn hôm nay</dt><dd>{summary?.promptBlocksToday ?? '-'}</dd></div>
                  <div><dt>Ngưỡng mỗi khách/ngày</dt><dd>{settings?.promptViolationLimitPerDay ?? '-'}</dd></div>
                </dl>
              </section>
            </div>
            <section className="admin-vto-secret-status">
              <strong>Kết nối hệ thống</strong>
              <span className={settings ? (settings.secretStatus.providerApiKeyConfigured ? 'is-ready' : 'is-offline') : undefined}>
                Khóa API: {settings ? (settings.secretStatus.providerApiKeyConfigured ? 'đã cấu hình' : 'chưa cấu hình') : 'chưa có dữ liệu'}
              </span>
              <span className={settings ? (settings.secretStatus.imageEndpointConfigured ? 'is-ready' : 'is-offline') : undefined}>
                Endpoint ảnh: {settings ? (settings.secretStatus.imageEndpointConfigured ? 'đã cấu hình' : 'chưa cấu hình') : 'chưa có dữ liệu'}
              </span>
              <span className={settings ? (settings.secretStatus.videoWorkflowConfigured ? 'is-ready' : 'is-offline') : undefined}>
                Workflow video: {settings ? (settings.secretStatus.videoWorkflowConfigured ? 'đã cấu hình' : 'chưa cấu hình') : 'chưa có dữ liệu'}
              </span>
            </section>

            {canSettings && settings && settingsDraft ? (
              <form
                className="admin-vto-settings-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  void handleSaveSettings()
                }}
              >
                <label className="admin-vto-settings-switch">
                  <input
                    type="checkbox"
                    checked={settingsDraft.runtimeEnabled}
                    onChange={(event) => setSettingsDraft((current) => current
                      ? { ...current, runtimeEnabled: event.target.checked }
                      : current)}
                  />
                  <span>Cho phép tạo lượt phối đồ mới</span>
                </label>
                <div className="admin-vto-settings-fields">
                  <label>
                    <span>Lượt đồng thời mỗi khách</span>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      required
                      value={settingsDraft.maxConcurrentJobsPerUser}
                      onChange={(event) => setSettingsDraft((current) => current
                        ? { ...current, maxConcurrentJobsPerUser: Number(event.target.value) }
                        : current)}
                    />
                  </label>
                  <label>
                    <span>Video mỗi khách/ngày</span>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      required
                      value={settingsDraft.maxVideoJobsPerUserPerDay}
                      onChange={(event) => setSettingsDraft((current) => current
                        ? { ...current, maxVideoJobsPerUserPerDay: Number(event.target.value) }
                        : current)}
                    />
                  </label>
                  <label>
                    <span>Video đồng thời mỗi khách</span>
                    <input
                      type="number"
                      min="1"
                      max="5"
                      required
                      value={settingsDraft.maxConcurrentVideoJobsPerUser}
                      onChange={(event) => setSettingsDraft((current) => current
                        ? { ...current, maxConcurrentVideoJobsPerUser: Number(event.target.value) }
                        : current)}
                    />
                  </label>
                  <label>
                    <span>Độ dài mô tả tối đa</span>
                    <input
                      type="number"
                      min="50"
                      max="500"
                      required
                      value={settingsDraft.promptMaxLength}
                      onChange={(event) => setSettingsDraft((current) => current
                        ? { ...current, promptMaxLength: Number(event.target.value) }
                        : current)}
                    />
                  </label>
                  <label>
                    <span>Vi phạm mỗi khách/ngày</span>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      required
                      value={settingsDraft.promptViolationLimitPerDay}
                      onChange={(event) => setSettingsDraft((current) => current
                        ? { ...current, promptViolationLimitPerDay: Number(event.target.value) }
                        : current)}
                    />
                  </label>
                </div>
                <div className="admin-vto-settings-actions">
                  <button type="submit" disabled={settingsSaving}>
                    {settingsSaving ? 'Đang lưu...' : 'Lưu cấu hình'}
                  </button>
                  <select
                    value={rollbackVersion}
                    onChange={(event) => setRollbackVersion(event.target.value)}
                    disabled={settingsSaving || !settings.historyVersions.length}
                    aria-label="Phiên bản cấu hình cần khôi phục"
                  >
                    <option value="">Chọn phiên bản để khôi phục</option>
                    {settings.historyVersions.map((version) => (
                      <option key={version} value={version}>Phiên bản v{version}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="is-secondary"
                    disabled={settingsSaving || !rollbackVersion}
                    onClick={() => void handleRollbackSettings()}
                  >
                    Khôi phục
                  </button>
                </div>
                <p>Dịch vụ AI, endpoint, workflow và khóa API được quản lý trong cấu hình triển khai.</p>
              </form>
            ) : (
              <p>{settingsLoading ? 'Đang tải cấu hình...' : 'Chưa tải được cấu hình. Hãy làm mới khi dịch vụ API sẵn sàng.'}</p>
            )}
          </section>

        </aside>
      </div>

      {selectedJob && activeTab === 'jobs' ? (
        <div className="admin-vto-drawer-backdrop" role="presentation" onMouseDown={() => setSelectedJob(null)}>
          <aside className="admin-vto-drawer" role="dialog" aria-modal="true" aria-label="Chi tiết lượt phối đồ" tabIndex={-1} onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <span>Lượt #{getShortId(selectedJob._id)}</span>
                <h2>{statusMeta[selectedJob.status].label}</h2>
              </div>
              <button type="button" onClick={() => setSelectedJob(null)}>Đóng</button>
            </header>
            <section className="admin-vto-drawer-hero">
              <div className="admin-vto-drawer-preview">
                {getJobLeadImage(selectedJob) ? (
                  <img src={getJobLeadImage(selectedJob)} alt="Ảnh đại diện lượt phối đồ" />
                ) : null}
              </div>
              <div>
                <span className={`admin-vto-status ${statusMeta[selectedJob.status].className}`}>
                  {statusMeta[selectedJob.status].label}
                </span>
                <strong>{outputModeLabels[selectedJob.outputMode]} · {outfitModeLabels[selectedJob.outfitMode]}</strong>
                <p>{selectedJob.progress}% hoàn tất · {formatPrice(selectedJob.totalFinalPrice)}</p>
              </div>
            </section>
            {canManage ? (
              <section className="admin-vto-drawer-actions" aria-label="Thao tác vận hành lượt phối đồ">
                {['failed', 'canceled'].includes(selectedJob.status) && !isPolicyClosedJob(selectedJob) ? (
                  <button type="button" disabled={actionLoading} onClick={() => void handleRetry(selectedJob)}>Chạy lại</button>
                ) : null}
                {['failed', 'canceled'].includes(selectedJob.videoStatus) && generatedImages.length && !isPolicyClosedVideo(selectedJob) ? (
                  <button type="button" disabled={actionLoading} onClick={() => void handleRetryVideo(selectedJob)}>
                    Chạy lại video
                  </button>
                ) : null}
                {['queued', 'processing'].includes(selectedJob.status) ? (
                  <button type="button" disabled={actionLoading} onClick={() => void handleCancel(selectedJob)}>Hủy lượt</button>
                ) : null}
                <button type="button" className="is-danger" disabled={actionLoading} onClick={() => handleHide(selectedJob)}>
                  Ẩn khỏi lịch sử
                </button>
                {selectedJob.user ? (
                  <button
                    type="button"
                    className="is-danger"
                    disabled={lockSaving}
                    onClick={() => {
                      if (selectedJob.user) handleLockAccountById(selectedJob.user._id, getUserLabel(selectedJob))
                    }}
                  >
                    Hạn chế tài khoản
                  </button>
                ) : null}
              </section>
            ) : null}
            <section className="admin-vto-drawer-customer">
              <h3>Khách hàng</h3>
              <div className="admin-vto-identity-block">
                <p>{getUserLabel(selectedJob)} · {selectedJob.user?.email ?? 'Không có email'}</p>
                {selectedJob.user ? (
                  <div className="admin-vto-copy-grid">
                    <button type="button" onClick={() => void handleCopyValue(selectedJob.user?._id, 'mã khách hàng', 'drawer-user-id')}>
                      <span>{copiedKey === 'drawer-user-id' ? 'Đã sao chép' : 'Mã khách hàng'}</span>
                      <strong>{selectedJob.user._id}</strong>
                    </button>
                    {selectedJob.user.email ? (
                      <button type="button" onClick={() => void handleCopyValue(selectedJob.user?.email, 'email khách hàng', 'drawer-user-email')}>
                        <span>{copiedKey === 'drawer-user-email' ? 'Đã sao chép' : 'Email'}</span>
                        <strong>{selectedJob.user.email}</strong>
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </section>
            <details className="admin-vto-drawer-technical">
              <summary>Thông tin kỹ thuật</summary>
              <dl>
                <div>
                  <dt>Mã lượt</dt>
                  <dd>
                    <button type="button" className="admin-vto-copy-inline" onClick={() => void handleCopyValue(selectedJob._id, 'mã lượt', 'drawer-job-id')}>
                      {copiedKey === 'drawer-job-id' ? 'Đã sao chép' : selectedJob._id}
                    </button>
                  </dd>
                </div>
                <div>
                  <dt>Mã rút gọn</dt>
                  <dd>
                    <button type="button" className="admin-vto-copy-inline" onClick={() => void handleCopyValue(getShortId(selectedJob._id), 'mã lượt rút gọn', 'drawer-short-job-id')}>
                      {copiedKey === 'drawer-short-job-id' ? 'Đã sao chép' : getShortId(selectedJob._id)}
                    </button>
                  </dd>
                </div>
                <div><dt>Dịch vụ AI</dt><dd>{selectedJob.provider}</dd></div>
                <div>
                  <dt>Mã xử lý AI</dt>
                  <dd>
                    {selectedJob.providerJobId ? (
                      <button
                        type="button"
                        className="admin-vto-copy-inline"
                        onClick={() => void handleCopyValue(selectedJob.providerJobId, 'mã xử lý AI', 'drawer-provider-job-id')}
                      >
                        {copiedKey === 'drawer-provider-job-id' ? 'Đã sao chép' : selectedJob.providerJobId}
                      </button>
                    ) : '-'}
                  </dd>
                </div>
                <div><dt>Đầu ra</dt><dd>{outputModeLabels[selectedJob.outputMode]}</dd></div>
                {selectedJob.outputMode === 'image_and_video' ? (
                  <div><dt>Thời lượng video</dt><dd>{selectedJob.videoDurationSeconds ?? '-'} giây</dd></div>
                ) : null}
                <div><dt>Bối cảnh</dt><dd>{contextLabels[selectedJob.contextPreset] ?? selectedJob.contextPreset}</dd></div>
                <div><dt>Tiến trình</dt><dd>{selectedJob.progress}%</dd></div>
                <div><dt>Giai đoạn</dt><dd>{processingStageLabels[selectedJob.processingStage]}</dd></div>
                <div><dt>Trạng thái video</dt><dd>{videoStatusLabels[selectedJob.videoStatus]} · {selectedJob.videoProgress}%</dd></div>
                <div><dt>Dịch vụ video</dt><dd>{selectedJob.videoProvider || '-'}</dd></div>
                <div>
                  <dt>Mã xử lý video</dt>
                  <dd>{selectedJob.videoProviderJobId || '-'}</dd>
                </div>
                <div><dt>Tạo lúc</dt><dd>{formatDate(selectedJob.createdAt)}</dd></div>
              </dl>
              {selectedJob.contextPrompt ? <p>{selectedJob.contextPrompt}</p> : null}
              {selectedJob.errorMessage ? <p className="admin-vto-error-text">{selectedJob.errorCode}: {selectedJob.errorMessage}</p> : null}
              {selectedJob.videoErrorMessage ? <p className="admin-vto-error-text">{selectedJob.videoErrorCode}: {selectedJob.videoErrorMessage}</p> : null}
            </details>
            <section className="admin-vto-drawer-comparison">
              <h3>So sánh kết quả</h3>
              <div className="admin-vto-moderation-grid">
                <article>
                  <span>Ảnh gốc của khách</span>
                  {selectedJob.sourceImageUrl ? (
                    <a href={selectedJob.sourceImageUrl} target="_blank" rel="noreferrer" aria-label="Mở ảnh gốc kích thước đầy đủ">
                      <img src={selectedJob.sourceImageUrl} alt="Ảnh gốc khách tải lên" />
                    </a>
                  ) : (
                    <p>Không có ảnh gốc.</p>
                  )}
                </article>
                <article>
                  <span>Kết quả AI</span>
                  {generatedImages.length ? (
                    <div className="admin-vto-generated-grid">
                      {generatedImages.map((imageUrl, index) => (
                        <a key={`${imageUrl}-${index}`} href={imageUrl} target="_blank" rel="noreferrer" aria-label={`Mở kết quả ${index + 1} kích thước đầy đủ`}>
                          <img src={imageUrl} alt={`Kết quả phối đồ ${index + 1}`} />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p>Lượt này chưa có ảnh kết quả.</p>
                  )}
                </article>
              </div>
              {selectedJob.generatedVideoUrl ? (
                <div className="admin-vto-result-preview">
                  {selectedJob.generatedVideoUrl ? <video src={selectedJob.generatedVideoUrl} controls /> : null}
                </div>
              ) : selectedJob.outputMode === 'image_and_video' ? (
                <p>Video: {videoStatusLabels[selectedJob.videoStatus]}{selectedJob.videoErrorMessage ? ` — ${selectedJob.videoErrorMessage}` : ''}</p>
              ) : null}
            </section>
            <section className="admin-vto-drawer-products-section">
              <h3>Sản phẩm đã chọn</h3>
              <div className="admin-vto-drawer-items">
                {selectedJob.selectedItems.map((item) => (
                  <article key={`${item.productId}-${item.nameSnapshot}`}>
                    <img src={item.imageSnapshot} alt="" />
                    <div>
                      <strong>{item.nameSnapshot}</strong>
                      <span>{itemRoleLabels[item.role] ?? item.role} · {item.colorSnapshot || 'Màu mặc định'}</span>
                    </div>
                    <em>{formatPrice(item.finalPriceSnapshot)}</em>
                  </article>
                ))}
              </div>
            </section>
          </aside>
        </div>
      ) : null}
      </>
      ) : null}

      {activeTab === 'promptViolations' ? (
        <section className="admin-vto-tab-panel">
          <div className="admin-vto-editor-card">
            <div className="admin-vto-tab-head">
              <h2>Vi phạm nội dung</h2>
            </div>
            <p className="admin-vto-tab-desc">
              Lịch sử được lưu tối đa 90 ngày. Dữ liệu cá nhân đã được che; bản ghi không thể sửa hoặc xóa thủ công.
            </p>
          </div>

          <div className="admin-vto-toolbar admin-vto-toolbar--violations">
            <input
              value={promptViolationFilters.keyword}
              onChange={(event) => updatePromptViolationFilter('keyword', event.target.value)}
              placeholder="Tìm khách hàng, nội dung hoặc mã lý do..."
              aria-label="Tìm vi phạm nội dung"
              maxLength={100}
            />
            <select
              value={promptViolationFilters.category}
              onChange={(event) => updatePromptViolationFilter('category', event.target.value)}
              aria-label="Lọc loại vi phạm"
            >
              <option value="">Tất cả loại</option>
              {promptPolicyCategoryOptions.map((category) => (
                <option key={category} value={category}>{promptPolicyCategoryLabels[category]}</option>
              ))}
            </select>
            <select
              value={promptViolationFilters.action}
              onChange={(event) => updatePromptViolationFilter('action', event.target.value)}
              aria-label="Lọc mức xử lý"
            >
              <option value="">Tất cả xử lý</option>
              <option value="warn">Đã cảnh báo</option>
              <option value="temporary_block">Tạm chặn</option>
            </select>
            <input
              type="date"
              value={promptViolationFilters.dateFrom}
              onChange={(event) => updatePromptViolationFilter('dateFrom', event.target.value)}
              aria-label="Vi phạm từ ngày"
            />
            <input
              type="date"
              value={promptViolationFilters.dateTo}
              onChange={(event) => updatePromptViolationFilter('dateTo', event.target.value)}
              aria-label="Vi phạm đến ngày"
            />
            <button
              type="button"
              className="admin-vto-filter-reset"
              disabled={!promptViolationFilters.keyword
                && !promptViolationFilters.category
                && !promptViolationFilters.action
                && !promptViolationFilters.dateFrom
                && !promptViolationFilters.dateTo}
              onClick={() => setPromptViolationFilters(initialPromptViolationFilters)}
            >
              Xóa lọc
            </button>
          </div>

          <div className="admin-vto-table-shell">
            {promptViolationLoading ? (
              <div className="admin-table-skeleton"><span /><span /><span /></div>
            ) : promptViolationData?.items.length ? (
              <table className="admin-vto-table admin-vto-violation-table">
                <thead>
                  <tr>
                    <th>Thời gian</th>
                    <th>Khách hàng</th>
                    <th>Nội dung đã che</th>
                    <th>Vi phạm</th>
                    <th>Xử lý</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {promptViolationData.items.map((violation) => (
                    <tr key={violation._id} className={violation.isActiveBlock ? 'needs-attention' : undefined}>
                      <td>
                        <div className="admin-vto-date">
                          <span>{formatDate(violation.createdAt)}</span>
                          <small>Lần {violation.violationCount} trong ngày</small>
                        </div>
                      </td>
                      <td>
                        {violation.user ? (
                          <div className="admin-vto-user">
                            <strong>{violation.user.name || violation.user.email || 'Không rõ'}</strong>
                            <span>{violation.user.email || 'Không có email'}</span>
                            <button
                              type="button"
                              className="admin-vto-copy-token"
                              onClick={() => void handleCopyValue(
                                violation.user?._id,
                                'mã khách hàng',
                                `violation-user-${violation._id}`,
                              )}
                            >
                              {copiedKey === `violation-user-${violation._id}`
                                ? 'Đã sao chép'
                                : `Mã ${getShortId(violation.user._id)}`}
                            </button>
                          </div>
                        ) : (
                          <span className="admin-vto-muted-text">Tài khoản không còn tồn tại</span>
                        )}
                      </td>
                      <td>
                        <div className="admin-vto-prompt-preview">
                          <p>{violation.promptPreview}</p>
                          <code>{violation.reasonCode}</code>
                        </div>
                      </td>
                      <td>
                        <strong>
                          {violation.matchedCategory
                            ? promptPolicyCategoryLabels[violation.matchedCategory]
                            : 'Không xác định'}
                        </strong>
                      </td>
                      <td>
                        <span className={`admin-vto-status ${violation.action === 'warn'
                          ? 'is-waiting'
                          : violation.isActiveBlock ? 'is-danger' : 'is-muted'}`}>
                          {violation.action === 'warn' ? 'Cảnh báo' : 'Tạm chặn'}
                        </span>
                        {violation.action === 'temporary_block' ? (
                          <small>
                            {violation.isActiveBlock && violation.blockedUntil
                              ? `Đến ${formatDate(violation.blockedUntil)}`
                              : 'Đã hết hạn'}
                          </small>
                        ) : null}
                      </td>
                      <td>
                        <div className="admin-vto-actions">
                          {canManage && violation.user ? (
                            <button
                              type="button"
                              onClick={() => handleLockAccountById(
                                violation.user!._id,
                                violation.user!.name || violation.user!.email,
                                `Vi phạm nội dung phối đồ ảo nhiều lần (${violation.reasonCode})`,
                              )}
                            >
                              Hạn chế tài khoản
                            </button>
                          ) : <span>—</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="admin-vto-empty">
                <strong>Không có vi phạm phù hợp</strong>
                <span>Thử đổi bộ lọc hoặc khoảng thời gian.</span>
              </div>
            )}
          </div>

          {promptViolationData?.pagination && promptViolationData.pagination.totalPages > 1 ? (
            <footer className="admin-table-footer">
              <span>Trang {promptViolationData.pagination.page}/{promptViolationData.pagination.totalPages} · {promptViolationData.pagination.totalItems} vi phạm</span>
              <div>
                <button type="button" disabled={promptViolationData.pagination.page <= 1} onClick={() => updatePromptViolationFilter('page', String(promptViolationData.pagination.page - 1))}>Trước</button>
                <button type="button" disabled={promptViolationData.pagination.page >= promptViolationData.pagination.totalPages} onClick={() => updatePromptViolationFilter('page', String(promptViolationData.pagination.page + 1))}>Sau</button>
              </div>
            </footer>
          ) : null}
        </section>
      ) : null}

      {activeTab === 'promptRules' ? (
        <section className="admin-vto-tab-panel">
          <div className="admin-vto-rule-tools">
            <div className="admin-vto-editor-card">
            <div className="admin-vto-tab-head">
              <h2>{editingRuleId ? 'Sửa quy tắc nội dung' : 'Thêm quy tắc nội dung'}</h2>
              {editingRuleId ? (
                <button type="button" onClick={resetPromptRuleForm}>Hủy sửa</button>
              ) : null}
            </div>
            <p className="admin-vto-tab-desc">
              Quy tắc được kiểm tra tại máy chủ và không hiển thị cho khách hàng.
            </p>
            <div className="admin-vto-form-row admin-vto-form-row--stacked admin-vto-rule-editor">
              <label className="admin-vto-field admin-vto-field--wide">
                <span>Cụm từ cần chặn</span>
                <input
                  value={promptRuleForm.term}
                  onChange={(event) => setPromptRuleForm((current) => ({ ...current, term: event.target.value }))}
                  placeholder="VD: cụm từ nhạy cảm hoặc yêu cầu không phù hợp"
                  maxLength={120}
                />
              </label>
              <label className="admin-vto-field">
                <span>Loại vi phạm</span>
                <select
                  value={promptRuleForm.category}
                  onChange={(event) => setPromptRuleForm((current) => ({
                    ...current,
                    category: event.target.value as PromptPolicyCategory,
                    reasonCode: '',
                  }))}
                >
                  {promptPolicyCategoryOptions.map((category) => (
                    <option key={category} value={category}>{promptPolicyCategoryLabels[category]}</option>
                  ))}
                </select>
              </label>
              <label className="admin-vto-field">
                <span>Mã lý do (tùy chọn)</span>
                <input
                  value={promptRuleForm.reasonCode}
                  onChange={(event) => setPromptRuleForm((current) => ({ ...current, reasonCode: event.target.value }))}
                  placeholder="VD: PROMPT_UNSAFE_REQUEST"
                  maxLength={80}
                />
              </label>
              <label className="admin-vto-checkbox admin-vto-switch">
                <input
                  type="checkbox"
                  checked={promptRuleForm.enabled}
                  onChange={(event) => setPromptRuleForm((current) => ({ ...current, enabled: event.target.checked }))}
                />
                <span>Đang áp dụng</span>
              </label>
              {canSettings ? (
                <button type="button" disabled={promptRuleSaving} onClick={() => void handleSavePromptRule()}>
                  {promptRuleSaving ? 'Đang lưu...' : editingRuleId ? 'Cập nhật quy tắc' : 'Thêm quy tắc'}
                </button>
              ) : null}
            </div>
          </div>

            <section className="admin-vto-panel admin-vto-prompt-panel">
              <h2>Kiểm tra mô tả khách nhập</h2>
              <p>Kiểm tra theo chính sách và các quy tắc đang áp dụng.</p>
              <textarea
                value={promptInput}
                maxLength={settings?.promptMaxLength ?? 200}
                onChange={(event) => setPromptInput(event.target.value)}
                placeholder="Nhập mô tả khách hàng có thể gửi"
                rows={4}
              />
              <div className="admin-vto-prompt-actions">
                <span>{promptInput.length}/{settings?.promptMaxLength ?? 200}</span>
                <button type="button" disabled={promptTesting} onClick={() => void handlePromptTest()}>
                  {promptTesting ? 'Đang kiểm tra...' : 'Kiểm tra'}
                </button>
              </div>
              {promptResult ? (
                <div className={`admin-vto-prompt-result ${promptResult.allowed ? 'is-success' : 'is-error'}`}>
                  <strong>
                    {promptResult.allowed
                      ? 'Hợp lệ'
                      : ['PROMPT_REQUIRED', 'REQUEST_FAILED'].includes(promptResult.reasonCode ?? '')
                        ? 'Chưa thể kiểm tra'
                        : 'Bị chặn'}
                  </strong>
                  <span>{promptResult.message || promptResult.normalizedPrompt || 'Mô tả có thể sử dụng'}</span>
                  {!promptResult.allowed
                    && !['PROMPT_REQUIRED', 'REQUEST_FAILED'].includes(promptResult.reasonCode ?? '')
                    && (promptResult.matchedCategory || promptResult.reasonCode) ? (
                    <code>
                      {promptResult.matchedCategory ? promptPolicyCategoryLabels[promptResult.matchedCategory] : 'Nội dung không phù hợp'}
                      {promptResult.reasonCode ? ` · ${promptResult.reasonCode}` : ''}
                    </code>
                  ) : null}
                </div>
              ) : null}
            </section>
          </div>

          <div className="admin-vto-toolbar admin-vto-toolbar--compact">
            <input
              value={promptRuleFilters.keyword}
              onChange={(event) => updatePromptRuleFilter('keyword', event.target.value)}
              placeholder="Tìm cụm từ..."
              aria-label="Tìm cụm từ cần chặn"
            />
            <select
              value={promptRuleFilters.category}
              onChange={(event) => updatePromptRuleFilter('category', event.target.value)}
            >
              <option value="">Tất cả loại</option>
              {promptPolicyCategoryOptions.map((category) => (
                <option key={category} value={category}>{promptPolicyCategoryLabels[category]}</option>
              ))}
            </select>
            <select
              value={promptRuleFilters.enabled}
              onChange={(event) => updatePromptRuleFilter('enabled', event.target.value)}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="true">Đang bật</option>
              <option value="false">Đang tắt</option>
            </select>
          </div>

          <div className="admin-vto-table-shell">
            {promptRuleLoading ? (
              <div className="admin-table-skeleton"><span /><span /><span /></div>
            ) : promptRuleData?.items.length ? (
              <table className="admin-vto-table admin-vto-rule-table">
                <thead>
                  <tr>
                    <th>Cụm từ</th>
                    <th>Loại</th>
                    <th>Mã lý do</th>
                    <th>Trạng thái</th>
                    <th>Cập nhật</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {promptRuleData.items.map((rule) => (
                    <tr key={rule._id} className={rule.enabled ? undefined : 'is-muted-row'}>
                      <td><strong>{rule.term}</strong></td>
                      <td>{promptPolicyCategoryLabels[rule.category]}</td>
                      <td><code>{rule.reasonCode}</code></td>
                      <td>
                        <span className={`admin-vto-status ${rule.enabled ? 'is-success' : 'is-muted'}`}>
                          {rule.enabled ? 'Bật' : 'Tắt'}
                        </span>
                      </td>
                      <td>{formatDate(rule.updatedAt)}</td>
                      <td>
                        <div className="admin-vto-actions">
                          {canSettings ? (
                            <button type="button" onClick={() => startEditPromptRule(rule)}>Sửa</button>
                          ) : null}
                          {canSettings ? (
                            <button type="button" onClick={() => void handleTogglePromptRule(rule)}>
                              {rule.enabled ? 'Tắt' : 'Bật'}
                            </button>
                          ) : null}
                          {canSettings ? (
                            <button type="button" className="is-danger" onClick={() => void handleDeletePromptRule(rule)}>Xóa</button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="admin-vto-empty">
                <strong>Chưa có quy tắc nội dung</strong>
                <span>Thêm cụm từ cần chặn để bổ sung cho chính sách mặc định.</span>
              </div>
            )}
          </div>

          {promptRuleData?.pagination && promptRuleData.pagination.totalPages > 1 ? (
            <footer className="admin-table-footer">
              <span>Trang {promptRuleData.pagination.page}/{promptRuleData.pagination.totalPages} · {promptRuleData.pagination.totalItems} quy tắc</span>
              <div>
                <button type="button" disabled={promptRuleData.pagination.page <= 1} onClick={() => updatePromptRuleFilter('page', String(promptRuleData.pagination.page - 1))}>Trước</button>
                <button type="button" disabled={promptRuleData.pagination.page >= promptRuleData.pagination.totalPages} onClick={() => updatePromptRuleFilter('page', String(promptRuleData.pagination.page + 1))}>Sau</button>
              </div>
            </footer>
          ) : null}
        </section>
      ) : null}

      {activeTab === 'accountLocks' ? (
        <section className="admin-vto-tab-panel">
          <div className="admin-vto-editor-card">
            <div className="admin-vto-tab-head">
              <h2>Hạn chế tài khoản</h2>
            </div>
            <p className="admin-vto-tab-desc">
              Khách hàng vẫn đăng nhập và mua sắm, nhưng không thể tải ảnh hoặc tạo lượt phối đồ cho đến khi được gỡ hạn chế.
            </p>
            {canManage ? (
              <div className="admin-vto-form-row admin-vto-form-row--stacked admin-vto-lock-editor">
                <label className="admin-vto-field admin-vto-field--wide">
                  <span>Email hoặc mã khách hàng</span>
                  <input
                    value={lockForm.userId}
                    onChange={(event) => setLockForm((current) => ({ ...current, userId: event.target.value }))}
                    placeholder="VD: customer@example.com hoặc 64f..."
                  />
                </label>
                <label className="admin-vto-field admin-vto-field--wide">
                  <span>Lý do hạn chế (bắt buộc)</span>
                  <input
                    value={lockForm.reason}
                    onChange={(event) => setLockForm((current) => ({ ...current, reason: event.target.value }))}
                    placeholder="VD: Gửi nội dung vi phạm nhiều lần"
                    required
                    minLength={3}
                    maxLength={240}
                  />
                </label>
                <button type="button" disabled={lockSaving} onClick={() => void handleLockAccount()}>
                  {lockSaving ? 'Đang lưu...' : 'Hạn chế tài khoản'}
                </button>
              </div>
            ) : null}
          </div>

          <div className="admin-vto-toolbar admin-vto-toolbar--account-locks">
            <input
              value={accountLockFilters.keyword}
              onChange={(event) => updateAccountLockFilter('keyword', event.target.value)}
              placeholder="Tìm tên, email hoặc mã khách hàng..."
              aria-label="Tìm tài khoản hạn chế"
            />
            <select
              value={accountLockFilters.locked}
              onChange={(event) => updateAccountLockFilter('locked', event.target.value)}
            >
              <option value="true">Đang hạn chế</option>
              <option value="false">Đã gỡ hạn chế</option>
              <option value="">Tất cả</option>
            </select>
          </div>

          <div className="admin-vto-table-shell">
            {accountLockLoading ? (
              <div className="admin-table-skeleton"><span /><span /><span /></div>
            ) : accountLockData?.items.length ? (
              <table className="admin-vto-table admin-vto-lock-table">
                <thead>
                  <tr>
                    <th>Khách hàng</th>
                    <th>Trạng thái</th>
                    <th>Lý do</th>
                    <th>Người thực hiện</th>
                    <th>Thời gian</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {accountLockData.items.map((lock) => {
                    const copyKey = 'lock-user-' + lock.user._id
                    return (
                      <tr key={lock.user._id} className={lock.isLocked ? 'needs-attention' : undefined}>
                        <td>
                          <div className="admin-vto-user">
                            <strong>{lock.user.name || lock.user.email || 'Không rõ'}</strong>
                            <span>{lock.user.email || 'Không có email'}</span>
                            <button
                              type="button"
                              className="admin-vto-copy-token"
                              onClick={() => void handleCopyValue(lock.user._id, 'mã khách hàng', copyKey)}
                            >
                              {copiedKey === copyKey ? 'Đã sao chép' : 'Mã ' + getShortId(lock.user._id)}
                            </button>
                          </div>
                        </td>
                        <td>
                          <span className={'admin-vto-status ' + (lock.isLocked ? 'is-danger' : 'is-success')}>
                            {lock.isLocked ? 'Đang hạn chế' : 'Đã gỡ'}
                          </span>
                        </td>
                        <td>{lock.reason || '-'}</td>
                        <td>{lock.lockedBy?.name || lock.lockedBy?.email || '-'}</td>
                        <td>
                          <div className="admin-vto-date">
                            {lock.lockedAt ? <span>Hạn chế: {formatDate(lock.lockedAt)}</span> : null}
                            {lock.unlockedAt ? <small>Gỡ: {formatDate(lock.unlockedAt)}</small> : null}
                          </div>
                        </td>
                        <td>
                          <div className="admin-vto-actions">
                            {canManage && lock.isLocked ? (
                              <button type="button" onClick={() => void handleUnlockAccount(lock)}>Gỡ hạn chế</button>
                            ) : canManage && !lock.isLocked ? (
                              <button type="button" onClick={() => handleLockAccountById(lock.user._id, lock.user.name || lock.user.email)}>Hạn chế lại</button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <div className="admin-vto-empty">
                <strong>Chưa có tài khoản trong danh sách</strong>
                <span>Nhập email hoặc mã khách hàng ở trên, hoặc chọn từ chi tiết lượt phối đồ.</span>
              </div>
            )}
          </div>

          {accountLockData?.pagination && accountLockData.pagination.totalPages > 1 ? (
            <footer className="admin-table-footer">
              <span>Trang {accountLockData.pagination.page}/{accountLockData.pagination.totalPages} · {accountLockData.pagination.totalItems} tài khoản</span>
              <div>
                <button type="button" disabled={accountLockData.pagination.page <= 1} onClick={() => updateAccountLockFilter('page', String(accountLockData.pagination.page - 1))}>Trước</button>
                <button type="button" disabled={accountLockData.pagination.page >= accountLockData.pagination.totalPages} onClick={() => updateAccountLockFilter('page', String(accountLockData.pagination.page + 1))}>Sau</button>
              </div>
            </footer>
          ) : null}
        </section>
      ) : null}
    </section>
  )
}
