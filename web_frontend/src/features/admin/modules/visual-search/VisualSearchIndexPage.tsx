import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Play,
  RefreshCw,
} from 'lucide-react'
import { hasPermission, type AdminUser } from '../auth/adminSession'
import { useToast } from '../../notifications/notification-context'
import {
  backfillVisualIndex,
  getVisualIndexStatus,
} from './visualSearch.service'
import type {
  VisualIndexBackfillResult,
  VisualIndexStatus,
} from './visualSearch.types'
import './visualSearch.css'

type VisualSearchIndexPageProps = {
  currentUser: AdminUser
}

const formatNumber = (value = 0) => new Intl.NumberFormat('vi-VN').format(value)

const formatPercent = (value = 0) =>
  `${(value * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`

function BackfillResultPanel({ result }: { result: VisualIndexBackfillResult }) {
  return (
    <section className={`admin-notice admin-visual-result ${result.failed ? 'is-warning' : 'is-success'}`}>
      <header>
        <div>
          <span>{result.dryRun ? 'Dry run' : 'Kết quả re-index'}</span>
          <strong>{result.failed ? 'Có ảnh chưa index được' : 'Hoàn tất re-index'}</strong>
        </div>
        {result.failed ? <AlertTriangle aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
      </header>
      <div className="admin-visual-result-grid">
        <span><strong>{formatNumber(result.productCount)}</strong>Sản phẩm</span>
        <span><strong>{formatNumber(result.imageCount)}</strong>Ảnh xử lý</span>
        <span><strong>{formatNumber(result.indexed)}</strong>Ảnh thành công</span>
        <span><strong>{formatNumber(result.staleDeactivated)}</strong>Mục cũ đã ẩn</span>
        <span><strong>{formatNumber(result.failed)}</strong>Lỗi embedding</span>
      </div>
      {result.failures.length ? (
        <div className="admin-visual-failure-list">
          {result.failures.slice(0, 8).map((failure) => (
            <article key={failure.galleryImageId}>
              <a href={failure.imageUrl} target="_blank" rel="noreferrer">{failure.galleryImageId}</a>
              <span>{failure.message}</span>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  )
}

export function VisualSearchIndexPage({ currentUser }: VisualSearchIndexPageProps) {
  const { showToast } = useToast()
  const canBackfill = hasPermission(currentUser, 'products.write')
  const [status, setStatus] = useState<VisualIndexStatus | null>(null)
  const [lastResult, setLastResult] = useState<VisualIndexBackfillResult | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [activeOnly, setActiveOnly] = useState(true)
  const [dryRun, setDryRun] = useState(false)
  const [limit, setLimit] = useState('')

  const loadStatus = useCallback(async () => {
    setLoadingStats(true)
    setError('')
    try {
      setStatus(await getVisualIndexStatus())
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể tải thống kê tìm kiếm hình ảnh.')
    } finally {
      setLoadingStats(false)
    }
  }, [])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  const summaryCards = useMemo(() => status ? [
    { label: 'Ảnh active', value: status.activeImageCount, detail: `${formatNumber(status.activeProductCount)} sản phẩm đang bán`, tone: 'info' },
    { label: 'Đã index', value: status.indexedImageCount, detail: `${formatPercent(status.coverageRate)} coverage`, tone: status.coverageRate >= 1 ? 'success' : 'warning' },
    { label: 'Thiếu index', value: status.missingImageCount, detail: 'Ảnh cần tạo embedding', tone: status.missingImageCount ? 'warning' : 'success' },
    { label: 'Mục cũ', value: status.staleActiveIndexCount, detail: 'Đang active nhưng lệch catalog', tone: status.staleActiveIndexCount ? 'warning' : 'success' },
  ] : [], [status])

  const runBackfill = async (event: FormEvent) => {
    event.preventDefault()
    if (!canBackfill || running) return

    const normalizedLimit = limit.trim()
    const limitValue = normalizedLimit ? Number(normalizedLimit) : undefined
    if (limitValue !== undefined && (!Number.isInteger(limitValue) || limitValue < 1)) {
      setError('Limit phải là số nguyên dương.')
      return
    }

    const confirmed = window.confirm(
      dryRun
        ? 'Chạy kiểm tra re-index ở chế độ dry run?'
        : 'Chạy re-index visual search ngay bây giờ? Thao tác này có thể mất một lúc.',
    )
    if (!confirmed) return

    setRunning(true)
    setError('')
    try {
      const result = await backfillVisualIndex({
        activeOnly,
        dryRun,
        ...(limitValue ? { limit: limitValue } : {}),
      })
      setLastResult(result)
      showToast(result.failed ? 'Re-index hoàn tất nhưng có ảnh lỗi.' : 'Đã chạy re-index visual search.', result.failed ? 'error' : 'success')
      await loadStatus()
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Không thể chạy re-index visual search.'
      setError(message)
      showToast(message, 'error')
    } finally {
      setRunning(false)
    }
  }

  return (
    <section className="admin-visual-page" aria-busy={loadingStats || running}>
      <header className="admin-page-heading admin-visual-heading">
        <div>
          <h1>Tìm kiếm hình ảnh</h1>
          <span>Chạy re-index ảnh sản phẩm khi catalog thay đổi.</span>
        </div>
        <button className="admin-secondary-button" type="button" disabled={loadingStats || running} onClick={() => void loadStatus()}>
          <RefreshCw aria-hidden="true" />
          Làm mới
        </button>
      </header>

      {error ? <div className="admin-notice is-error" role="alert">{error}</div> : null}

      {status ? (
        <section className="admin-visual-stats" aria-label="Thống kê tìm kiếm hình ảnh">
          {summaryCards.map((card) => (
            <article className={`admin-visual-stat is-${card.tone}`} key={card.label}>
              <span>{card.label}</span>
              <strong>{formatNumber(card.value)}</strong>
              <small>{card.detail}</small>
            </article>
          ))}
        </section>
      ) : null}

      <form className="admin-visual-section admin-visual-run-panel" onSubmit={runBackfill}>
        <header>
          <div>
            <span>Vận hành</span>
            <strong>Chạy re-index</strong>
          </div>
          <Play aria-hidden="true" />
        </header>
        <label className="admin-visual-toggle">
          <input type="checkbox" checked={activeOnly} disabled={running} onChange={(event) => setActiveOnly(event.target.checked)} />
          <span>Chỉ index sản phẩm đang bán</span>
        </label>
        <label className="admin-visual-toggle">
          <input type="checkbox" checked={dryRun} disabled={running} onChange={(event) => setDryRun(event.target.checked)} />
          <span>Dry run, không ghi dữ liệu</span>
        </label>
        <label className="admin-visual-limit">
          <span>Giới hạn sản phẩm</span>
          <input
            inputMode="numeric"
            min={1}
            type="number"
            value={limit}
            disabled={running}
            placeholder="Không giới hạn"
            onChange={(event) => setLimit(event.target.value)}
          />
        </label>
        <button className="admin-primary-button" disabled={!canBackfill || running} type="submit">
          <Play aria-hidden="true" />
          {running ? 'Đang chạy...' : dryRun ? 'Chạy dry run' : 'Re-index ngay'}
        </button>
        {!canBackfill ? <p className="admin-visual-permission-note">Cần quyền products.write để chạy re-index.</p> : null}
      </form>

      {lastResult ? <BackfillResultPanel result={lastResult} /> : null}
    </section>
  )
}
