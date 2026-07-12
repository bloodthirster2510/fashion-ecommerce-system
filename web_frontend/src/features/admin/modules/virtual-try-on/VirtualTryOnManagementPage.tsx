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
  listVirtualTryOnPromptRules,
  lockVirtualTryOnAccount,
  retryVirtualTryOnJob,
  testVirtualTryOnPrompt,
  unlockVirtualTryOnAccount,
  updateVirtualTryOnPromptRule,
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
  AdminVirtualTryOnPromptTestResult,
  AdminVirtualTryOnSettings,
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
  full_set: 'Full set',
}

const outputModeLabels: Record<AdminVirtualTryOnJob['outputMode'], string> = {
  image: 'Ảnh',
  image_and_video: 'Ảnh + video',
}

const promptPolicyCategoryLabels: Record<PromptPolicyCategory, string> = {
  sexual_content: 'Nội dung nhạy cảm',
  violence: 'Bạo lực',
  prompt_injection: 'Prompt injection',
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

type AdminTab = 'jobs' | 'promptRules' | 'accountLocks'

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

const getJobAgeMinutes = (job: AdminVirtualTryOnJob) =>
  Math.max(0, Math.round((Date.now() - new Date(job.createdAt).getTime()) / 60000))

const getAttentionReason = (job: AdminVirtualTryOnJob) => {
  if (job.status === 'failed') return job.errorCode || 'Provider lỗi'
  if (job.status === 'processing') return `Đang chạy ${job.progress}%`
  if (job.status === 'queued') return `Chờ ${getJobAgeMinutes(job)} phút`
  if (job.status === 'succeeded') return 'Cần kiểm duyệt ảnh'
  return 'Đã hủy'
}

export function VirtualTryOnManagementPage({ currentUser }: { currentUser: AdminUser }) {
  const [filters, setFilters] = useState(initialFilters)
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  const [data, setData] = useState<AdminVirtualTryOnJobList | null>(null)
  const [summary, setSummary] = useState<AdminVirtualTryOnSummary | null>(null)
  const [settings, setSettings] = useState<AdminVirtualTryOnSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [selectedJob, setSelectedJob] = useState<AdminVirtualTryOnJob | null>(null)
  const [promptInput, setPromptInput] = useState('')
  const [promptResult, setPromptResult] = useState<AdminVirtualTryOnPromptTestResult | null>(null)
  const [promptTesting, setPromptTesting] = useState(false)
  const [activeTab, setActiveTab] = useState<AdminTab>('jobs')
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
  const [accountLockFilters, setAccountLockFilters] = useState(initialAccountLockFilters)
  const [accountLockData, setAccountLockData] = useState<AdminVirtualTryOnAccountLockList | null>(null)
  const [accountLockLoading, setAccountLockLoading] = useState(false)
  const [lockForm, setLockForm] = useState<{ userId: string; reason: string }>({ userId: '', reason: '' })
  const [lockSaving, setLockSaving] = useState(false)
  const canManage = hasPermission(currentUser, 'virtual_try_on.manage')
  const canSettings = hasPermission(currentUser, 'virtual_try_on.settings')

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedKeyword(filters.keyword), 350)
    return () => window.clearTimeout(timer)
  }, [filters.keyword])

  const effectiveFilters = useMemo(() => ({
    ...filters,
    keyword: debouncedKeyword,
  }), [debouncedKeyword, filters])

  const loadPage = useCallback(async () => {
    setLoading(true)
    setNotice(null)
    try {
      const [jobs, nextSummary, nextSettings] = await Promise.all([
        listVirtualTryOnJobs(effectiveFilters),
        getVirtualTryOnSummary(),
        getVirtualTryOnSettings(),
      ])
      setData(jobs)
      setSummary(nextSummary)
      setSettings(nextSettings)
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Không thể tải phối đồ ảo' })
    } finally {
      setLoading(false)
    }
  }, [effectiveFilters])

  useEffect(() => { void loadPage() }, [loadPage])

  const updateFilter = (key: keyof AdminVirtualTryOnFilters, value: string | number) => {
    setFilters((current) => ({ ...current, [key]: value, ...(key !== 'page' ? { page: 1 } : {}) }))
  }

  const runAction = async (action: () => Promise<AdminVirtualTryOnJob>, successMessage: string) => {
    setActionLoading(true)
    setNotice(null)
    try {
      const updated = await action()
      setSelectedJob((current) => current?._id === updated._id ? updated : current)
      setNotice({ type: 'success', message: successMessage })
      await loadPage()
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Không thể xử lý job phối đồ' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleRetry = (job: AdminVirtualTryOnJob) =>
    runAction(() => retryVirtualTryOnJob(job._id), 'Đã đưa job vào hàng chờ xử lý lại.')

  const handleCancel = (job: AdminVirtualTryOnJob) =>
    runAction(() => cancelVirtualTryOnJob(job._id), 'Đã hủy job phối đồ.')

  const handleHide = (job: AdminVirtualTryOnJob) => {
    if (!window.confirm('Ẩn job này khỏi danh sách quản trị và lịch sử khách?')) return
    void runAction(() => hideVirtualTryOnJob(job._id), 'Đã ẩn job khỏi lịch sử.')
  }

  const handlePromptTest = async () => {
    setPromptTesting(true)
    setPromptResult(null)
    try {
      setPromptResult(await testVirtualTryOnPrompt(promptInput))
    } catch (error) {
      setPromptResult({
        allowed: false,
        normalizedPrompt: null,
        reasonCode: 'REQUEST_FAILED',
        message: error instanceof Error ? error.message : 'Không thể kiểm tra prompt',
        maxLength: settings?.promptMaxLength ?? 200,
      })
    } finally {
      setPromptTesting(false)
    }
  }

  const loadPromptRules = useCallback(async () => {
    setPromptRuleLoading(true)
    setNotice(null)
    try {
      setPromptRuleData(await listVirtualTryOnPromptRules(promptRuleFilters))
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Không thể tải danh sách từ khóa bị cấm' })
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
      setNotice({ type: 'error', message: 'Vui lòng nhập từ khóa bị cấm' })
      return
    }
    setPromptRuleSaving(true)
    setNotice(null)
    try {
      if (editingRuleId) {
        await updateVirtualTryOnPromptRule(editingRuleId, promptRuleForm)
        setNotice({ type: 'success', message: 'Đã cập nhật từ khóa bị cấm.' })
      } else {
        await createVirtualTryOnPromptRule(promptRuleForm)
        setNotice({ type: 'success', message: 'Đã thêm từ khóa bị cấm.' })
      }
      resetPromptRuleForm()
      await loadPromptRules()
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Không thể lưu từ khóa bị cấm' })
    } finally {
      setPromptRuleSaving(false)
    }
  }

  const handleTogglePromptRule = async (rule: AdminVirtualTryOnPromptRule) => {
    setNotice(null)
    try {
      await updateVirtualTryOnPromptRule(rule._id, { enabled: !rule.enabled })
      await loadPromptRules()
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Không thể đổi trạng thái từ khóa' })
    }
  }

  const handleDeletePromptRule = async (rule: AdminVirtualTryOnPromptRule) => {
    if (!window.confirm(`Xóa từ khóa "${rule.term}" khỏi danh sách cấm?`)) return
    setNotice(null)
    try {
      await deleteVirtualTryOnPromptRule(rule._id)
      if (editingRuleId === rule._id) resetPromptRuleForm()
      await loadPromptRules()
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Không thể xóa từ khóa bị cấm' })
    }
  }

  const loadAccountLocks = useCallback(async () => {
    setAccountLockLoading(true)
    setNotice(null)
    try {
      setAccountLockData(await listVirtualTryOnAccountLocks(accountLockFilters))
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Không thể tải danh sách khóa tài khoản' })
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

  const handleLockAccount = async () => {
    if (!lockForm.userId.trim()) {
      setNotice({ type: 'error', message: 'Vui lòng nhập user ID cần khóa' })
      return
    }
    setLockSaving(true)
    setNotice(null)
    try {
      await lockVirtualTryOnAccount({ userId: lockForm.userId.trim(), reason: lockForm.reason.trim() || undefined })
      setNotice({ type: 'success', message: 'Đã khóa tính năng phối đồ ảo của tài khoản.' })
      setLockForm({ userId: '', reason: '' })
      await loadAccountLocks()
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Không thể khóa tài khoản' })
    } finally {
      setLockSaving(false)
    }
  }

  const handleUnlockAccount = async (lock: AdminVirtualTryOnAccountLock) => {
    if (!window.confirm(`Mở khóa phối đồ ảo cho ${lock.user.name || lock.user.email}?`)) return
    setNotice(null)
    try {
      await unlockVirtualTryOnAccount(lock.user._id)
      setNotice({ type: 'success', message: 'Đã mở khóa tài khoản.' })
      await loadAccountLocks()
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Không thể mở khóa tài khoản' })
    }
  }

  const handleLockAccountById = async (userId: string) => {
    setLockSaving(true)
    setNotice(null)
    try {
      await lockVirtualTryOnAccount({ userId })
      setNotice({ type: 'success', message: 'Đã khóa tính năng phối đồ ảo của tài khoản.' })
      await loadAccountLocks()
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Không thể khóa tài khoản' })
    } finally {
      setLockSaving(false)
    }
  }

  const pagination = data?.pagination
  const jobs = data?.items ?? []
  const activeJobCount = (summary?.queued ?? 0) + (summary?.processing ?? 0)
  const finishedJobCount = (summary?.succeeded ?? 0) + (summary?.failed ?? 0) + (summary?.canceled ?? 0)
  const statusOverview = Object.entries(statusMeta).map(([status, meta]) => ({
    status: status as VirtualTryOnJobStatus,
    ...meta,
    count: summary?.[status as VirtualTryOnJobStatus] ?? 0,
  }))
  const attentionJobs = [
    ...(summary?.latestFailedJobs ?? []),
    ...jobs.filter((job) => ['queued', 'processing'].includes(job.status)),
  ].filter((job, index, list) => list.findIndex((item) => item._id === job._id) === index).slice(0, 4)
  const reviewJobs = jobs.filter((job) => job.status === 'succeeded' && (job.generatedImageUrl || job.generatedImageUrls?.length)).slice(0, 4)
  const productInsightMap = new Map<string, { name: string; count: number; value: number }>()
  jobs.forEach((job) => {
    job.selectedItems.forEach((item) => {
      const current = productInsightMap.get(item.productId) ?? { name: item.nameSnapshot, count: 0, value: 0 }
      current.count += 1
      current.value += item.finalPriceSnapshot
      productInsightMap.set(item.productId, current)
    })
  })
  const productInsights = Array.from(productInsightMap.values())
    .sort((a, b) => b.count - a.count || b.value - a.value)
    .slice(0, 4)
  const promptBlockRatio = settings?.promptViolationLimitPerDay
    ? Math.min(100, Math.round(((summary?.promptBlocksToday ?? 0) / settings.promptViolationLimitPerDay) * 100))
    : 0
  const generatedImages = selectedJob?.generatedImageUrls?.length
    ? selectedJob.generatedImageUrls
    : selectedJob?.generatedImageUrl
      ? [selectedJob.generatedImageUrl]
      : []

  return (
    <section className="admin-vto-page">
      <header className="admin-vto-ops-bar">
        <div>
          <span>AI fitting room</span>
          <strong>Luồng vận hành hôm nay</strong>
          <p>Ưu tiên job lỗi, ảnh mới cần kiểm duyệt và quota provider.</p>
        </div>
        <button type="button" onClick={() => void loadPage()} disabled={loading}>
          {loading ? 'Đang tải...' : 'Làm mới'}
        </button>
      </header>

      {notice ? (
        <div className={`admin-vto-notice ${notice.type === 'error' ? 'is-error' : 'is-success'}`} role="alert">
          {notice.message}
        </div>
      ) : null}

      <nav className="admin-vto-tabs" aria-label="Tab quản trị phối đồ ảo">
        <button type="button" className={activeTab === 'jobs' ? 'is-active' : ''} onClick={() => setActiveTab('jobs')}>
          Lượt phối đồ
        </button>
        <button type="button" className={activeTab === 'promptRules' ? 'is-active' : ''} onClick={() => setActiveTab('promptRules')}>
          Từ khóa bị cấm
        </button>
        <button type="button" className={activeTab === 'accountLocks' ? 'is-active' : ''} onClick={() => setActiveTab('accountLocks')}>
          Khóa tài khoản
        </button>
      </nav>

      <div className="admin-vto-stats" style={{ display: activeTab === 'jobs' ? undefined : 'none' }}>
        <div className="is-primary">
          <span>Job hôm nay</span>
          <strong>{summary?.today ?? 0}</strong>
          <em>{summary?.total ?? 0} job toàn hệ thống</em>
        </div>
        <div>
          <span>Đang xử lý</span>
          <strong>{activeJobCount}</strong>
          <em>{summary?.queued ?? 0} chờ · {summary?.processing ?? 0} chạy</em>
        </div>
        <div className="is-success">
          <span>Tỷ lệ thành công</span>
          <strong>{summary?.successRate ?? 0}%</strong>
          <em>{summary?.succeeded ?? 0}/{finishedJobCount || 0} job đã kết thúc</em>
        </div>
        <div className="is-danger">
          <span>Job lỗi</span>
          <strong>{summary?.failed ?? 0}</strong>
          <em>{summary?.latestFailedJobs.length ?? 0} lỗi gần đây · {summary?.promptBlocksToday ?? 0} khóa prompt</em>
        </div>
      </div>

      {activeTab === 'jobs' ? (
        <>
        <div className="admin-vto-command-grid" aria-label="Bảng điều hành phòng phối đồ ảo">
        <section className="admin-vto-command-card is-attention">
          <div>
            <span>Việc cần xử lý</span>
            <strong>{(summary?.failed ?? 0) + activeJobCount}</strong>
          </div>
          {attentionJobs.length ? (
            <div className="admin-vto-mini-list">
              {attentionJobs.map((job) => (
                <button type="button" key={job._id} onClick={() => setSelectedJob(job)}>
                  <span>{job._id.slice(-8)}</span>
                  <strong>{getAttentionReason(job)}</strong>
                </button>
              ))}
            </div>
          ) : (
            <p>Không có job lỗi hoặc đang treo.</p>
          )}
          <div className="admin-vto-command-actions">
            <button type="button" onClick={() => updateFilter('status', 'failed')}>Xem lỗi</button>
            <button type="button" onClick={() => updateFilter('status', 'processing')}>Đang chạy</button>
          </div>
        </section>

        <section className="admin-vto-command-card is-review">
          <div>
            <span>Kiểm duyệt kết quả</span>
            <strong>{reviewJobs.length}</strong>
          </div>
          {reviewJobs.length ? (
            <div className="admin-vto-review-strip">
              {reviewJobs.map((job) => (
                <button type="button" key={job._id} onClick={() => setSelectedJob(job)} aria-label={`Mở job ${job._id.slice(-8)}`}>
                  <img src={getJobLeadImage(job)} alt="" />
                </button>
              ))}
            </div>
          ) : (
            <p>Trang hiện tại chưa có ảnh thành công để kiểm duyệt.</p>
          )}
          <div className="admin-vto-command-actions">
            <button type="button" onClick={() => updateFilter('status', 'succeeded')}>Xem ảnh mới</button>
          </div>
        </section>

        <section className="admin-vto-command-card is-products">
          <div>
            <span>Sản phẩm được thử nhiều</span>
            <strong>{productInsights.length}</strong>
          </div>
          {productInsights.length ? (
            <div className="admin-vto-product-insights">
              {productInsights.map((item) => (
                <div key={item.name}>
                  <span>{item.name}</span>
                  <strong>{item.count} lượt · {formatPrice(item.value)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p>Chưa đủ dữ liệu trong trang hiện tại.</p>
          )}
        </section>

        <section className="admin-vto-command-card is-policy">
          <div>
            <span>Quota & policy</span>
            <strong>{settings?.enabled ? 'Bật' : 'Tắt'}</strong>
          </div>
          <dl className="admin-vto-policy-list">
            <div><dt>Provider</dt><dd>{settings?.provider ?? '-'}</dd></div>
            <div><dt>Món tối đa</dt><dd>{settings?.maxSelectedItems ?? '-'}</dd></div>
            <div><dt>Đồng thời/user</dt><dd>{settings?.maxConcurrentJobsPerUser ?? '-'}</dd></div>
            <div><dt>Ngưỡng khóa/user</dt><dd>{summary?.promptBlocksToday ?? 0}/{settings?.promptViolationLimitPerDay ?? '-'}</dd></div>
          </dl>
          <span className="admin-vto-policy-meter" aria-label={`Ngưỡng khóa prompt ${promptBlockRatio}%`}>
            <i style={{ width: `${promptBlockRatio}%` }} />
          </span>
        </section>
      </div>

      <div className="admin-vto-layout" style={{ display: activeTab === 'jobs' ? undefined : 'none' }}>
        <section className="admin-vto-main">
          <div className="admin-vto-status-board" aria-label="Tổng quan trạng thái job">
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
              placeholder="Tìm job, khách, sản phẩm, lỗi..."
            />
            <input
              value={filters.provider}
              onChange={(event) => updateFilter('provider', event.target.value)}
              placeholder="Provider"
            />
            <input type="date" value={filters.dateFrom} onChange={(event) => updateFilter('dateFrom', event.target.value)} />
            <input type="date" value={filters.dateTo} onChange={(event) => updateFilter('dateTo', event.target.value)} />
          </div>

          <div className="admin-vto-table-shell">
            {loading ? (
              <div className="admin-table-skeleton">
                <span /><span /><span /><span />
              </div>
            ) : jobs.length ? (
              <table className="admin-vto-table">
                <thead>
                  <tr>
                    <th>Job</th>
                    <th>Khách</th>
                    <th>Trạng thái</th>
                    <th>Set đồ</th>
                    <th>Bối cảnh</th>
                    <th>Provider</th>
                    <th>Thời gian</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => {
                    const status = statusMeta[job.status]
                    return (
                      <tr key={job._id} className={job.status === 'failed' ? 'needs-attention' : undefined}>
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
                              <strong>{job._id.slice(-8)}</strong>
                              <span>{getJobResultLabel(job)}</span>
                              <span>{outputModeLabels[job.outputMode]} · {outfitModeLabels[job.outfitMode]}</span>
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
                          <span className={`admin-vto-status ${status.className}`}>{status.label}</span>
                          <span className="admin-vto-progress" aria-label={`Tiến trình ${job.progress}%`}>
                            <i style={{ width: `${Math.max(0, Math.min(job.progress, 100))}%` }} />
                          </span>
                          <small>{job.progress}%</small>
                        </td>
                        <td>
                          <div className="admin-vto-products">
                            {job.selectedItems.slice(0, 2).map((item) => (
                              <span key={`${job._id}-${item.productId}-${item.nameSnapshot}`}>{item.nameSnapshot}</span>
                            ))}
                            {job.selectedItems.length > 2 ? <em>+{job.selectedItems.length - 2} món</em> : null}
                            <strong>{formatPrice(job.totalFinalPrice)}</strong>
                          </div>
                        </td>
                        <td>
                          <div className="admin-vto-context-cell">
                            <strong>{contextLabels[job.contextPreset] ?? job.contextPreset}</strong>
                            {job.contextPrompt ? <span>{job.contextPrompt}</span> : null}
                          </div>
                        </td>
                        <td>{job.provider}</td>
                        <td>
                          <div className="admin-vto-date">
                            <span>{formatDate(job.createdAt)}</span>
                            {job.completedAt ? <small>Xong {formatDate(job.completedAt)}</small> : null}
                          </div>
                        </td>
                        <td>
                          <div className="admin-vto-actions">
                            <button type="button" onClick={() => setSelectedJob(job)}>Chi tiết</button>
                            {canManage && ['failed', 'canceled'].includes(job.status) ? (
                              <button type="button" disabled={actionLoading} onClick={() => void handleRetry(job)}>Retry</button>
                            ) : null}
                            {canManage && ['queued', 'processing'].includes(job.status) ? (
                              <button type="button" disabled={actionLoading} onClick={() => void handleCancel(job)}>Hủy</button>
                            ) : null}
                            {canManage ? (
                              <button type="button" className="is-danger" disabled={actionLoading} onClick={() => handleHide(job)}>Ẩn</button>
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
                <strong>Chưa có job phối đồ</strong>
                <span>Khi khách tạo ảnh thử đồ, job sẽ xuất hiện tại đây.</span>
              </div>
            )}
          </div>

          {pagination && pagination.totalPages > 1 ? (
            <footer className="admin-table-footer">
              <span>Trang {pagination.page}/{pagination.totalPages} · {pagination.totalItems} job</span>
              <div>
                <button type="button" disabled={pagination.page <= 1} onClick={() => updateFilter('page', pagination.page - 1)}>Trước</button>
                <button type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => updateFilter('page', pagination.page + 1)}>Sau</button>
              </div>
            </footer>
          ) : null}
        </section>

        <aside className="admin-vto-side">
          <section className="admin-vto-panel admin-vto-prompt-panel">
            <h2>Kiểm tra prompt</h2>
            <textarea
              value={promptInput}
              maxLength={settings?.promptMaxLength ?? 200}
              onChange={(event) => setPromptInput(event.target.value)}
              placeholder="Nhập mô tả bối cảnh để kiểm tra"
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
                <strong>{promptResult.allowed ? 'Hợp lệ' : 'Bị chặn'}</strong>
                <span>{promptResult.message || promptResult.reasonCode || promptResult.normalizedPrompt || 'Prompt có thể sử dụng'}</span>
                {promptResult.matchedRule ? <code>{promptResult.matchedRule}</code> : null}
              </div>
            ) : null}
          </section>

          <section className="admin-vto-panel">
            <h2>Cấu hình hiện tại</h2>
            <dl>
              <div><dt>Provider</dt><dd>{settings?.provider ?? '-'}</dd></div>
              <div><dt>Trạng thái</dt><dd>{settings?.enabled ? 'Đang bật' : 'Đang tắt'}</dd></div>
              <div><dt>Video</dt><dd>{settings?.videoEnabled ? 'Bật' : 'Tắt'}</dd></div>
              <div><dt>Số món tối đa</dt><dd>{settings?.maxSelectedItems ?? '-'}</dd></div>
              <div><dt>Job đồng thời/user</dt><dd>{settings?.maxConcurrentJobsPerUser ?? '-'}</dd></div>
              <div><dt>Prompt vi phạm hôm nay</dt><dd>{summary?.promptViolationsToday ?? 0}</dd></div>
              <div><dt>Khóa sau số lần vi phạm/user/ngày</dt><dd>{settings?.promptViolationLimitPerDay ?? '-'}</dd></div>
            </dl>
            {!canSettings ? <p>Chỉ admin có quyền cấu hình mới chỉnh được provider/quota.</p> : null}
          </section>

          <section className="admin-vto-panel">
            <h2>Job lỗi gần đây</h2>
            {summary?.latestFailedJobs.length ? (
              <div className="admin-vto-failed-list">
                {summary.latestFailedJobs.map((job) => (
                  <button type="button" key={job._id} onClick={() => setSelectedJob(job)}>
                    <strong>{job.errorCode || 'UNKNOWN'}</strong>
                    <span>{job.errorMessage || job._id}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p>Chưa có job lỗi gần đây.</p>
            )}
          </section>
        </aside>
      </div>

      {selectedJob ? (
        <div className="admin-vto-drawer-backdrop" role="presentation" onMouseDown={() => setSelectedJob(null)}>
          <aside className="admin-vto-drawer" aria-label="Chi tiết job phối đồ" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <span>Job #{selectedJob._id.slice(-8)}</span>
                <h2>{statusMeta[selectedJob.status].label}</h2>
              </div>
              <button type="button" onClick={() => setSelectedJob(null)}>Đóng</button>
            </header>
            <section className="admin-vto-drawer-hero">
              <div className="admin-vto-drawer-preview">
                {getJobLeadImage(selectedJob) ? (
                  <img src={getJobLeadImage(selectedJob)} alt="Ảnh đại diện job phối đồ" />
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
              <section className="admin-vto-drawer-actions" aria-label="Thao tác quản trị job">
                {['failed', 'canceled'].includes(selectedJob.status) ? (
                  <button type="button" disabled={actionLoading} onClick={() => void handleRetry(selectedJob)}>Retry job</button>
                ) : null}
                {['queued', 'processing'].includes(selectedJob.status) ? (
                  <button type="button" disabled={actionLoading} onClick={() => void handleCancel(selectedJob)}>Hủy job</button>
                ) : null}
                <button type="button" className="is-danger" disabled={actionLoading} onClick={() => handleHide(selectedJob)}>
                  Ẩn khỏi lịch sử
                </button>
              </section>
            ) : null}
            <section>
              <h3>Khách hàng</h3>
              <p>{getUserLabel(selectedJob)} · {selectedJob.user?.email ?? 'Không có email'}</p>
            </section>
            <section>
              <h3>Metadata</h3>
              <dl>
                <div><dt>Provider</dt><dd>{selectedJob.provider}</dd></div>
                <div><dt>Provider job</dt><dd>{selectedJob.providerJobId ?? '-'}</dd></div>
                <div><dt>Output</dt><dd>{outputModeLabels[selectedJob.outputMode]}</dd></div>
                <div><dt>Bối cảnh</dt><dd>{contextLabels[selectedJob.contextPreset] ?? selectedJob.contextPreset}</dd></div>
                <div><dt>Tiến trình</dt><dd>{selectedJob.progress}%</dd></div>
                <div><dt>Tạo lúc</dt><dd>{formatDate(selectedJob.createdAt)}</dd></div>
              </dl>
              {selectedJob.contextPrompt ? <p>{selectedJob.contextPrompt}</p> : null}
              {selectedJob.errorMessage ? <p className="admin-vto-error-text">{selectedJob.errorCode}: {selectedJob.errorMessage}</p> : null}
            </section>
            <section>
              <h3>Kiểm duyệt ảnh</h3>
              <div className="admin-vto-moderation-grid">
                <article>
                  <span>Ảnh gốc của khách</span>
                  {selectedJob.sourceImageUrl ? (
                    <img src={selectedJob.sourceImageUrl} alt="Ảnh gốc khách tải lên" />
                  ) : (
                    <p>Không có ảnh gốc.</p>
                  )}
                </article>
                <article>
                  <span>Kết quả AI</span>
                  {generatedImages.length ? (
                    <div className="admin-vto-generated-grid">
                      {generatedImages.map((imageUrl, index) => (
                        <img key={`${imageUrl}-${index}`} src={imageUrl} alt={`Kết quả phối đồ ${index + 1}`} />
                      ))}
                    </div>
                  ) : (
                    <p>Job chưa có ảnh kết quả.</p>
                  )}
                </article>
              </div>
              {selectedJob.generatedVideoUrl ? (
                <div className="admin-vto-result-preview">
                  {selectedJob.generatedVideoUrl ? <video src={selectedJob.generatedVideoUrl} controls /> : null}
                </div>
              ) : null}
            </section>
            <section>
              <h3>Sản phẩm đã chọn</h3>
              <div className="admin-vto-drawer-items">
                {selectedJob.selectedItems.map((item) => (
                  <article key={`${item.productId}-${item.nameSnapshot}`}>
                    <img src={item.imageSnapshot} alt="" />
                    <div>
                      <strong>{item.nameSnapshot}</strong>
                      <span>{item.role} · {item.colorSnapshot || 'Màu mặc định'}</span>
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

      {activeTab === 'promptRules' ? (
        <section className="admin-vto-tab-panel">
          <div className="admin-vto-tab-head">
            <h2>{editingRuleId ? 'Sửa từ khóa bị cấm' : 'Thêm từ khóa bị cấm'}</h2>
            {editingRuleId ? (
              <button type="button" onClick={resetPromptRuleForm}>Hủy sửa</button>
            ) : null}
          </div>
          <div className="admin-vto-form-row">
            <input
              value={promptRuleForm.term}
              onChange={(event) => setPromptRuleForm((current) => ({ ...current, term: event.target.value }))}
              placeholder="Từ khóa bị cấm (vd: tên người nổi tiếng, từ nhạy cảm)"
              maxLength={120}
            />
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
            <input
              value={promptRuleForm.reasonCode}
              onChange={(event) => setPromptRuleForm((current) => ({ ...current, reasonCode: event.target.value }))}
              placeholder="Mã lý do (để trống dùng mặc định)"
              maxLength={80}
            />
            <label className="admin-vto-checkbox">
              <input
                type="checkbox"
                checked={promptRuleForm.enabled}
                onChange={(event) => setPromptRuleForm((current) => ({ ...current, enabled: event.target.checked }))}
              />
              <span>Đang bật</span>
            </label>
            {canManage ? (
              <button type="button" disabled={promptRuleSaving} onClick={() => void handleSavePromptRule()}>
                {promptRuleSaving ? 'Đang lưu...' : editingRuleId ? 'Cập nhật' : 'Thêm'}
              </button>
            ) : null}
          </div>

          <div className="admin-vto-toolbar">
            <input
              value={promptRuleFilters.keyword}
              onChange={(event) => updatePromptRuleFilter('keyword', event.target.value)}
              placeholder="Tìm từ khóa..."
            />
            <select
              value={promptRuleFilters.category}
              onChange={(event) => updatePromptRuleFilter('category', event.target.value)}
            >
              <option value="">Tất cả nhóm</option>
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
                    <th>Từ khóa</th>
                    <th>Nhóm</th>
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
                          {canManage ? (
                            <button type="button" onClick={() => startEditPromptRule(rule)}>Sửa</button>
                          ) : null}
                          {canManage ? (
                            <button type="button" onClick={() => void handleTogglePromptRule(rule)}>
                              {rule.enabled ? 'Tắt' : 'Bật'}
                            </button>
                          ) : null}
                          {canManage ? (
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
                <strong>Chưa có từ khóa bị cấm</strong>
                <span>Thêm từ khóa ở trên để chặn prompt vi phạm khi khách tạo ảnh phối đồ.</span>
              </div>
            )}
          </div>

          {promptRuleData?.pagination && promptRuleData.pagination.totalPages > 1 ? (
            <footer className="admin-table-footer">
              <span>Trang {promptRuleData.pagination.page}/{promptRuleData.pagination.totalPages} · {promptRuleData.pagination.totalItems} từ khóa</span>
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
          <div className="admin-vto-tab-head">
            <h2>Khóa tính năng phối đồ ảo</h2>
          </div>
          <p className="admin-vto-tab-desc">
            Tài khoản bị khóa sẽ không thể tải ảnh, kiểm tra ảnh hoặc tạo job phối đồ ảo cho đến khi được mở khóa.
          </p>
          {canManage ? (
            <div className="admin-vto-form-row">
              <input
                value={lockForm.userId}
                onChange={(event) => setLockForm((current) => ({ ...current, userId: event.target.value }))}
                placeholder="User ID cần khóa"
              />
              <input
                value={lockForm.reason}
                onChange={(event) => setLockForm((current) => ({ ...current, reason: event.target.value }))}
                placeholder="Lý do khóa (tùy chọn)"
                maxLength={240}
              />
              <button type="button" disabled={lockSaving} onClick={() => void handleLockAccount()}>
                {lockSaving ? 'Đang khóa...' : 'Khóa tài khoản'}
              </button>
            </div>
          ) : null}

          <div className="admin-vto-toolbar">
            <input
              value={accountLockFilters.keyword}
              onChange={(event) => updateAccountLockFilter('keyword', event.target.value)}
              placeholder="Tìm theo tên hoặc email..."
            />
            <select
              value={accountLockFilters.locked}
              onChange={(event) => updateAccountLockFilter('locked', event.target.value)}
            >
              <option value="true">Đang khóa</option>
              <option value="false">Đã mở khóa</option>
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
                    <th>Người khóa</th>
                    <th>Thời gian</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {accountLockData.items.map((lock) => (
                    <tr key={lock.user._id} className={lock.isLocked ? 'needs-attention' : undefined}>
                      <td>
                        <div className="admin-vto-user">
                          <strong>{lock.user.name || lock.user.email || 'Không rõ'}</strong>
                          <span>{lock.user.email || lock.user._id}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`admin-vto-status ${lock.isLocked ? 'is-danger' : 'is-success'}`}>
                          {lock.isLocked ? 'Đang khóa' : 'Đã mở'}
                        </span>
                      </td>
                      <td>{lock.reason || '-'}</td>
                      <td>{lock.lockedBy?.name || lock.lockedBy?.email || '-'}</td>
                      <td>
                        <div className="admin-vto-date">
                          {lock.lockedAt ? <span>Khóa: {formatDate(lock.lockedAt)}</span> : null}
                          {lock.unlockedAt ? <small>Mở: {formatDate(lock.unlockedAt)}</small> : null}
                        </div>
                      </td>
                      <td>
                        <div className="admin-vto-actions">
                          {canManage && lock.isLocked ? (
                            <button type="button" onClick={() => void handleUnlockAccount(lock)}>Mở khóa</button>
                          ) : canManage && !lock.isLocked ? (
                            <button type="button" onClick={() => void handleLockAccountById(lock.user._id)}>Khóa lại</button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="admin-vto-empty">
                <strong>Chưa có tài khoản bị khóa</strong>
                <span>Nhập user ID ở trên để khóa tài khoản vi phạm chính sách phối đồ ảo.</span>
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
