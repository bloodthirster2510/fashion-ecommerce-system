import { useCallback, useEffect, useMemo, useState } from 'react'
import { hasPermission, type AdminUser } from '../auth/adminSession'
import {
  cancelVirtualTryOnJob,
  getVirtualTryOnSettings,
  getVirtualTryOnSummary,
  hideVirtualTryOnJob,
  listVirtualTryOnJobs,
  retryVirtualTryOnJob,
  testVirtualTryOnPrompt,
} from './virtualTryOn.service'
import type {
  AdminVirtualTryOnFilters,
  AdminVirtualTryOnJob,
  AdminVirtualTryOnJobList,
  AdminVirtualTryOnPromptTestResult,
  AdminVirtualTryOnSettings,
  AdminVirtualTryOnSummary,
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
        message: error instanceof Error ? error.message : 'Khong the kiem tra prompt',
        maxLength: settings?.promptMaxLength ?? 200,
      })
    } finally {
      setPromptTesting(false)
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

  return (
    <section className="admin-vto-page">
      <header className="admin-page-heading admin-vto-heading">
        <div>
          <span>AI fitting room</span>
          <h1>Phối đồ ảo</h1>
          <p>Giám sát job tạo ảnh, lỗi provider và cấu hình vận hành.</p>
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

      <div className="admin-vto-stats">
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

      <div className="admin-vto-layout">
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
                              {job.generatedImageUrl ? (
                                <img src={job.generatedImageUrl} alt="" />
                              ) : job.selectedItems[0]?.imageSnapshot ? (
                                <img src={job.selectedItems[0].imageSnapshot} alt="" />
                              ) : (
                                <i />
                              )}
                            </span>
                            <span className="admin-vto-job-code">
                              <strong>{job._id.slice(-8)}</strong>
                              <span>{job.generatedImageUrl ? 'Có kết quả' : 'Chưa có kết quả'}</span>
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
              <div><dt>Giới hạn prompt/ngày</dt><dd>{settings?.promptViolationLimitPerDay ?? '-'}</dd></div>
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
                {selectedJob.generatedImageUrl ? (
                  <img src={selectedJob.generatedImageUrl} alt="Kết quả phối đồ" />
                ) : selectedJob.selectedItems[0]?.imageSnapshot ? (
                  <img src={selectedJob.selectedItems[0].imageSnapshot} alt="Sản phẩm phối đồ" />
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
            <section>
              <h3>Khách hàng</h3>
              <p>{getUserLabel(selectedJob)} · {selectedJob.user?.email ?? 'Không có email'}</p>
            </section>
            <section>
              <h3>Metadata</h3>
              <dl>
                <div><dt>Provider</dt><dd>{selectedJob.provider}</dd></div>
                <div><dt>Output</dt><dd>{outputModeLabels[selectedJob.outputMode]}</dd></div>
                <div><dt>Bối cảnh</dt><dd>{contextLabels[selectedJob.contextPreset] ?? selectedJob.contextPreset}</dd></div>
                <div><dt>Tiến trình</dt><dd>{selectedJob.progress}%</dd></div>
                <div><dt>Tạo lúc</dt><dd>{formatDate(selectedJob.createdAt)}</dd></div>
              </dl>
              {selectedJob.contextPrompt ? <p>{selectedJob.contextPrompt}</p> : null}
              {selectedJob.errorMessage ? <p className="admin-vto-error-text">{selectedJob.errorCode}: {selectedJob.errorMessage}</p> : null}
            </section>
            <section>
              <h3>Kết quả AI</h3>
              {selectedJob.generatedImageUrl || selectedJob.generatedVideoUrl ? (
                <div className="admin-vto-result-preview">
                  {selectedJob.generatedImageUrl ? <img src={selectedJob.generatedImageUrl} alt="Ket qua phoi do" /> : null}
                  {selectedJob.generatedVideoUrl ? <video src={selectedJob.generatedVideoUrl} controls /> : null}
                </div>
              ) : (
                <p>Job chua co anh hoac video ket qua.</p>
              )}
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
    </section>
  )
}
