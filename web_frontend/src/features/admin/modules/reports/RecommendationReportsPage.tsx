import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  Boxes,
  Gauge,
  Layers3,
  MousePointerClick,
  RefreshCcw,
  Search,
  SearchX,
  Target,
} from 'lucide-react'
import {
  Button,
  MetricLineChart,
  PageHeader,
  Tabs,
} from '../../components/ui'
import {
  buildDefaultRecommendationAnalyticsFilters,
  getBestRecommendationSegment,
  getRecommendationAnalytics,
  type RecommendationAnalyticsFilters,
} from './recommendationAnalytics.service'
import type {
  RecommendationAnalytics,
  RecommendationContext,
  RecommendationCoverageGroup,
  RecommendationCoverageItem,
  RecommendationMetricSnapshot,
  RecommendationSegment,
} from './recommendationAnalytics.types'
import { hasPermission, type AdminUser } from '../auth/adminSession'
import { RecommendationMerchandisingPanel } from './RecommendationMerchandisingPanel'
import './recommendationReports.css'

type MetricKey = keyof Pick<
  RecommendationMetricSnapshot,
  'requests' | 'impressions' | 'clicks' | 'addToCarts' | 'ordersCreated' | 'paymentsCompleted' | 'netAttributedRevenue'
>

type CssVars = CSSProperties & Record<`--${string}`, string>

type ReportTab = 'search' | 'recommendations' | 'merchandising'

const reportTabs: Array<{ value: ReportTab; label: string }> = [
  { value: 'search', label: 'Tìm kiếm' },
  { value: 'recommendations', label: 'Đề xuất sản phẩm' },
  { value: 'merchandising', label: 'Điều phối gợi ý' },
]

const contextLabels: Record<RecommendationContext, string> = {
  home: 'Trang chủ',
  product_detail_similar: 'Chi tiết sản phẩm',
  cart: 'Giỏ hàng',
}

const toDateInput = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

const formatNumber = (value = 0) => new Intl.NumberFormat('vi-VN').format(value)

const formatCurrency = (value = 0) => new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
}).format(value)

const formatPercent = (value = 0, maximumFractionDigits = 1) =>
  `${(value * 100).toLocaleString('vi-VN', { maximumFractionDigits })}%`

const formatChange = (value: number | null | undefined) => {
  if (value === null || value === undefined) return 'Mới'
  return `${value > 0 ? '+' : ''}${value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`
}

const formatDate = (value: string) => new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
}).format(new Date(value))

const formatDateTime = (value: string) => new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
}).format(new Date(value))

const widthStyle = (value: number): CssVars => ({
  '--width': `${Math.max(3, Math.min(100, Math.round(value * 100)))}%`,
})

const getMetricChange = (
  analytics: RecommendationAnalytics,
  key: MetricKey,
) => {
  const changeKey = `${key}Percent` as keyof RecommendationAnalytics['comparison']
  return analytics.comparison[changeKey]
}

const getInsightItems = (analytics: RecommendationAnalytics, bestSegment: RecommendationSegment | null) => {
  const items: Array<{
    title: string
    detail: string
    tone: 'good' | 'warn' | 'info'
    actionLabel: string
    href: string
  }> = []

  const currentVersionImpressions = analytics.segments
    .filter((segment) => segment.algorithmVersion === analytics.currentAlgorithmVersion)
    .reduce((total, segment) => total + segment.metrics.impressions, 0)

  if (!analytics.filters.algorithmVersion && currentVersionImpressions < 100) {
    items.push({
      title: 'Dữ liệu thuật toán hiện tại còn ít',
      detail: `${analytics.currentAlgorithmVersion} mới có ${formatNumber(currentVersionImpressions)} lượt hiển thị; chưa nên dùng CTR của phiên bản cũ để kết luận hiệu quả.`,
      tone: 'warn',
      actionLabel: 'Xem so sánh phiên bản',
      href: '#rec-model-health',
    })
  }

  if (bestSegment) {
    items.push({
      title: `${contextLabels[bestSegment.context]} nổi bật`,
      detail: `${bestSegment.algorithmVersion} đạt CTR ${formatPercent(bestSegment.metrics.ctr)} trên ${formatNumber(bestSegment.metrics.impressions)} lượt hiển thị.`,
      tone: 'good',
      actionLabel: 'So sánh phiên bản',
      href: '#rec-model-health',
    })
  }

  if (analytics.summary.fallbackRate >= 0.15 && analytics.summary.requests >= 50) {
    items.push({
      title: 'Tỷ lệ dự phòng cần theo dõi',
      detail: `${formatPercent(analytics.summary.fallbackRate)} yêu cầu đang dùng kết quả dự phòng; nên xem lại dữ liệu hành vi hoặc danh mục sản phẩm thiếu tín hiệu.`,
      tone: 'warn',
      actionLabel: 'Kiểm tra mô hình',
      href: '#rec-model-health',
    })
  }

  if (analytics.diversity.averageCategoryDiversityAt10 < 0.45 && analytics.diversity.requestsSampled >= 20) {
    items.push({
      title: 'Độ đa dạng danh mục thấp',
      detail: `Mười vị trí đầu trung bình chỉ đạt ${formatPercent(analytics.diversity.averageCategoryDiversityAt10)} danh mục khác nhau trên mỗi sản phẩm.`,
      tone: 'warn',
      actionLabel: 'Xem độ đa dạng',
      href: '#rec-model-health',
    })
  }

  if (analytics.search.zeroResultRate >= 0.2 && analytics.search.totalSearches >= 50) {
    items.push({
      title: 'Nhiều truy vấn không có kết quả',
      detail: `${formatPercent(analytics.search.zeroResultRate)} lượt tìm kiếm không có kết quả; hãy ưu tiên từ đồng nghĩa và khoảng trống sản phẩm.`,
      tone: 'warn',
      actionLabel: 'Xem từ khóa',
      href: '#rec-search',
    })
  }

  if (analytics.summary.clicks > 0 && analytics.summary.addToCarts === 0) {
    items.push({
      title: 'Lượt nhấp chưa chuyển sang giỏ',
      detail: 'Có lượt nhấp đề xuất nhưng chưa ghi nhận sản phẩm được thêm vào giỏ trong kỳ này.',
      tone: 'info',
      actionLabel: 'Xem phễu chuyển đổi',
      href: '#rec-performance',
    })
  }

  if (
    analytics.comparison.netAttributedRevenuePercent !== null &&
    analytics.comparison.netAttributedRevenuePercent < -15 &&
    analytics.summary.paymentsCompleted >= 5
  ) {
    items.push({
      title: 'Doanh thu từ gợi ý đang giảm',
      detail: `Doanh thu ghi nhận qua đề xuất giảm ${Math.abs(analytics.comparison.netAttributedRevenuePercent).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}% so với kỳ trước.`,
      tone: 'warn',
      actionLabel: 'Xem điểm rơi',
      href: '#rec-performance',
    })
  }

  return items.slice(0, 4)
}

function MiniDelta({ value }: { value: number | null | undefined }) {
  const className = value === null || value === undefined
    ? 'is-neutral'
    : value > 0
      ? 'is-up'
      : value < 0
        ? 'is-down'
        : 'is-neutral'

  return <span className={`admin-rec-delta ${className}`}>{formatChange(value)} kỳ trước</span>
}

function FunnelPanel({ summary }: { summary: RecommendationMetricSnapshot }) {
  const rows = [
    { label: 'Hiển thị', count: summary.impressions, rate: 1, helper: 'Sản phẩm thực sự được nhìn thấy' },
    { label: 'Nhấp xem', count: summary.clicks, rate: summary.ctr, helper: 'Từ hiển thị sang nhấp' },
    { label: 'Thêm vào giỏ', count: summary.addToCarts, rate: summary.clickToCartRate, helper: 'Từ nhấp sang giỏ hàng' },
    { label: 'Tạo đơn', count: summary.ordersCreated, rate: summary.cartToOrderRate, helper: 'Từ giỏ sang tạo đơn' },
    { label: 'Thanh toán', count: summary.paymentsCompleted, rate: summary.orderToPaymentRate, helper: 'Từ đơn sang thanh toán thành công' },
  ]

  return (
    <section className="admin-rec-panel admin-rec-funnel-panel">
      <header>
        <div>
          <span>Phễu đề xuất sản phẩm</span>
          <strong>Điểm rơi chuyển đổi</strong>
        </div>
        <Target aria-hidden="true" />
      </header>
      <div className="admin-rec-funnel">
        {rows.map((row, index) => (
          <article key={row.label}>
            <div>
              <strong>{row.label}</strong>
              <span>{row.helper}</span>
            </div>
            <b>{formatNumber(row.count)}</b>
            <i aria-hidden="true"><em style={widthStyle(index === 0 ? 1 : row.rate)} /></i>
            <small>{index === 0 ? '100%' : formatPercent(row.rate)}</small>
          </article>
        ))}
      </div>
    </section>
  )
}

function TrendPanel({ analytics }: { analytics: RecommendationAnalytics }) {
  const [metric, setMetric] = useState<'ctr' | 'impressions' | 'paymentsCompleted'>('ctr')
  const metricConfig = {
    ctr: { label: 'CTR', format: (value: number) => formatPercent(value) },
    impressions: { label: 'Lượt hiển thị', format: (value: number) => formatNumber(Math.round(value)) },
    paymentsCompleted: { label: 'Đơn thanh toán', format: (value: number) => formatNumber(Math.round(value)) },
  }[metric]
  const points = analytics.trend.map((point) => ({
    label: formatDate(point.date),
    value: point[metric],
  }))

  return (
    <section className="admin-rec-panel admin-rec-trend-panel">
      <header className="admin-rec-trend-heading">
        <div>
          <span>Hiệu suất theo ngày</span>
          <strong>Xu hướng hiệu quả theo ngày</strong>
        </div>
        <div className="admin-rec-metric-switch" role="group" aria-label="Chọn chỉ số xu hướng">
          <button type="button" className={metric === 'ctr' ? 'is-active' : ''} onClick={() => setMetric('ctr')}>CTR</button>
          <button type="button" className={metric === 'impressions' ? 'is-active' : ''} onClick={() => setMetric('impressions')}>Hiển thị</button>
          <button type="button" className={metric === 'paymentsCompleted' ? 'is-active' : ''} onClick={() => setMetric('paymentsCompleted')}>Thanh toán</button>
        </div>
      </header>
      <div className="admin-rec-trend-summary">
        <strong>{metricConfig.format(analytics.summary[metric])}</strong>
        <span>{metricConfig.label} trong kỳ đã chọn</span>
      </div>
      <div className="admin-rec-chart-scroll">
        <MetricLineChart points={points} ariaLabel={`${metricConfig.label} từ đề xuất theo ngày`} formatValue={metricConfig.format} />
      </div>
    </section>
  )
}

function SearchTrendPanel({ analytics }: { analytics: RecommendationAnalytics }) {
  const [metric, setMetric] = useState<'searches' | 'zeroResultRate'>('searches')
  const metricConfig = {
    searches: { label: 'Lượt tìm kiếm', format: (value: number) => formatNumber(Math.round(value)) },
    zeroResultRate: { label: 'Tỷ lệ không kết quả', format: (value: number) => formatPercent(value) },
  }[metric]
  const points = analytics.search.trend.map((point) => ({
    label: formatDate(point.date),
    value: point[metric],
  }))
  const summaryValue = metric === 'searches'
    ? analytics.search.totalSearches
    : analytics.search.zeroResultRate

  return (
    <section className="admin-rec-panel admin-rec-trend-panel">
      <header className="admin-rec-trend-heading">
        <div>
          <span>Xu hướng tìm kiếm</span>
          <strong>Nhu cầu theo ngày</strong>
        </div>
        <div className="admin-rec-metric-switch" role="group" aria-label="Chọn chỉ số tìm kiếm">
          <button type="button" className={metric === 'searches' ? 'is-active' : ''} onClick={() => setMetric('searches')}>Lượt tìm</button>
          <button type="button" className={metric === 'zeroResultRate' ? 'is-active' : ''} onClick={() => setMetric('zeroResultRate')}>Không kết quả</button>
        </div>
      </header>
      <div className="admin-rec-trend-summary">
        <strong>{metricConfig.format(summaryValue)}</strong>
        <span>{metricConfig.label} trong kỳ đã chọn</span>
      </div>
      <div className="admin-rec-chart-scroll">
        <MetricLineChart points={points} ariaLabel={`${metricConfig.label} theo ngày`} formatValue={metricConfig.format} />
      </div>
    </section>
  )
}

function SearchDemandPanel({ analytics }: { analytics: RecommendationAnalytics }) {
  const [view, setView] = useState<'popular' | 'zero'>('popular')
  const keywords = view === 'popular'
    ? analytics.search.topKeywords
    : analytics.search.zeroResultKeywords

  return (
    <section className="admin-rec-panel admin-rec-search-panel">
      <header className="admin-rec-table-heading">
        <div>
          <strong>Truy vấn tìm kiếm</strong>
          <span>Biết khách đang cần gì và nội dung nào chưa được đáp ứng.</span>
        </div>
        <div className="admin-rec-table-switch" role="group" aria-label="Loại truy vấn">
          <button type="button" className={view === 'popular' ? 'is-active' : ''} onClick={() => setView('popular')}>Phổ biến</button>
          <button type="button" className={view === 'zero' ? 'is-active' : ''} onClick={() => setView('zero')}>
            Không có kết quả
            {analytics.search.zeroResultKeywords.length ? <b>{analytics.search.zeroResultKeywords.length}</b> : null}
          </button>
        </div>
      </header>
      <div className="admin-rec-data-table-wrap">
        <table className="admin-rec-data-table">
          <thead>
            <tr><th>Truy vấn</th><th>Lượt tìm</th><th>Kết quả trung bình</th><th>Lần gần nhất</th></tr>
          </thead>
          <tbody>
            {keywords.map((keyword) => (
              <tr key={keyword.keyword}>
                <td><strong>{keyword.keyword}</strong></td>
                <td>{formatNumber(keyword.count)}</td>
                <td>{keyword.averageResultCount === 0 ? <em>0 kết quả</em> : formatNumber(keyword.averageResultCount)}</td>
                <td>{formatDateTime(keyword.lastSearchedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!keywords.length ? (
          <p className="admin-rec-table-empty">
            {view === 'zero' ? 'Không có truy vấn từ khóa nào trả về 0 kết quả trong kỳ này.' : 'Chưa có truy vấn từ khóa trong kỳ này.'}
          </p>
        ) : null}
      </div>
    </section>
  )
}

function SummaryStrip({ items }: { items: Array<{ label: string; value: string; detail: string; alert?: boolean }> }) {
  return (
    <section className="admin-rec-summary-strip" aria-label="Chỉ số chính">
      {items.map((item) => (
        <article key={item.label} className={item.alert ? 'is-alert' : undefined}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <small>{item.detail}</small>
        </article>
      ))}
    </section>
  )
}

function TopProductsPanel({ analytics }: { analytics: RecommendationAnalytics }) {
  return (
    <section className="admin-rec-panel admin-rec-products-table-panel">
      <header className="admin-rec-table-heading">
        <div>
          <strong>Sản phẩm được đề xuất hiệu quả</strong>
          <span>Xếp theo lượt nhấp, đơn hàng và doanh thu có tương tác đề xuất.</span>
        </div>
      </header>
      <div className="admin-rec-data-table-wrap">
        <table className="admin-rec-data-table admin-rec-product-table">
          <thead>
            <tr><th>Sản phẩm</th><th>Nhấp</th><th>Tạo đơn</th><th>Thanh toán</th><th>Doanh thu</th></tr>
          </thead>
          <tbody>
            {analytics.topProducts.map((product) => (
              <tr key={product.productId}>
                <td>
                  <span className="admin-rec-product-cell">
                    {product.image ? <img src={product.image} alt="" /> : <i aria-hidden="true" />}
                    <span><strong>{product.name}</strong><small>{product.context.map((context) => contextLabels[context]).join(', ')}</small></span>
                  </span>
                </td>
                <td>{formatNumber(product.clicks)}</td>
                <td>{formatNumber(product.ordersCreated)}</td>
                <td>{formatNumber(product.paymentsCompleted)}</td>
                <td>{formatCurrency(product.netAttributedRevenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!analytics.topProducts.length ? <p className="admin-rec-table-empty">Chưa ghi nhận sản phẩm có tương tác đề xuất trong kỳ này.</p> : null}
      </div>
    </section>
  )
}

function RecentRequestsPanel({ analytics }: { analytics: RecommendationAnalytics }) {
  return (
    <section className="admin-rec-panel admin-rec-requests-panel">
      <header>
        <div>
          <span>Chẩn đoán lượt đề xuất</span>
          <strong>Ghi nhận tương tác gần nhất</strong>
        </div>
        <MousePointerClick aria-hidden="true" />
      </header>
      <div className="admin-rec-request-list">
        {analytics.recentRequests.length ? analytics.recentRequests.map((request) => (
          <article key={request.requestId}>
            <div>
              <strong>{request.requestId}</strong>
              <span>{contextLabels[request.context]} · {request.algorithmVersion}</span>
            </div>
            <small>{formatDateTime(request.createdAt)}</small>
            <em className={request.fallbackUsed ? 'is-fallback' : 'is-primary'}>
              {request.fallbackUsed ? 'Dự phòng' : `${request.itemCount} sản phẩm`}
            </em>
            <b>{formatNumber(request.impressions)} hiển thị · {formatNumber(request.clicks)} nhấp · {formatNumber(request.paymentsCompleted)} thanh toán</b>
          </article>
        )) : (
          <p>Chưa có yêu cầu đề xuất trong kỳ này.</p>
        )}
      </div>
    </section>
  )
}

function ReportEmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <section className="admin-rec-empty-state" role="status">
      <span><SearchX aria-hidden="true" /></span>
      <div>
        <strong>{title}</strong>
        <p>{detail}</p>
      </div>
    </section>
  )
}

function CoverageList({ title, group }: { title: string; group: RecommendationCoverageGroup }) {
  const maximum = Math.max(...group.top.map((item) => item.recommendedCount), 1)

  return (
    <section className="admin-rec-panel admin-rec-coverage-card">
      <header>
        <div>
          <span>{title}</span>
          <strong>{formatPercent(group.coverageRate)} độ phủ</strong>
        </div>
        <Boxes aria-hidden="true" />
      </header>
      <p>{formatNumber(group.uniqueRecommended)}/{formatNumber(group.totalActive)} nhóm đang hoạt động đã xuất hiện trong đề xuất.</p>
      <div className="admin-rec-ranked-list">
        {group.top.length ? group.top.map((item: RecommendationCoverageItem) => (
          <article key={item.id}>
            <span>{item.name}</span>
            <i aria-hidden="true"><em style={widthStyle(item.recommendedCount / maximum)} /></i>
            <small>{formatNumber(item.recommendedCount)} lượt</small>
          </article>
        )) : (
          <p>Chưa có dữ liệu độ phủ trong kỳ này.</p>
        )}
      </div>
    </section>
  )
}

function DiversityPanel({ analytics }: { analytics: RecommendationAnalytics }) {
  const metrics = [
    { label: 'Danh mục trong 10 vị trí đầu', value: analytics.diversity.averageCategoryDiversityAt10 },
    { label: 'Thương hiệu trong 10 vị trí đầu', value: analytics.diversity.averageBrandDiversityAt10 },
  ]

  return (
    <section className="admin-rec-panel admin-rec-diversity-panel">
      <header>
        <div>
          <span>Độ đa dạng 10 vị trí đầu</span>
          <strong>Độ đa dạng top đầu</strong>
        </div>
        <Layers3 aria-hidden="true" />
      </header>
      <div className="admin-rec-diversity-metrics">
        {metrics.map((metric) => (
          <article key={metric.label}>
            <div><span>{metric.label}</span><strong>{formatPercent(metric.value)}</strong></div>
            <i aria-hidden="true"><em style={widthStyle(metric.value)} /></i>
          </article>
        ))}
      </div>
      <p>{formatNumber(analytics.diversity.requestsSampled)} yêu cầu có đủ dữ liệu để tính độ đa dạng.</p>
    </section>
  )
}

function SegmentTable({ segments }: { segments: RecommendationSegment[] }) {
  return (
    <section className="admin-rec-panel admin-rec-segments-panel">
      <header>
        <div>
          <span>Phiên bản × Ngữ cảnh</span>
          <strong>So sánh phiên bản gợi ý</strong>
        </div>
        <Gauge aria-hidden="true" />
      </header>
      <div className="admin-rec-table-scroll">
        <table className="admin-rec-table">
          <thead>
            <tr>
              <th>Phiên bản</th>
              <th>Ngữ cảnh</th>
              <th>Yêu cầu</th>
              <th>CTR</th>
              <th>Click → giỏ</th>
              <th>Giỏ → đơn</th>
              <th>Đơn → thanh toán</th>
              <th>Dự phòng</th>
              <th>Hạng khi nhấp</th>
            </tr>
          </thead>
          <tbody>
            {segments.length ? segments.map((segment) => (
              <tr key={`${segment.algorithmVersion}-${segment.context}`}>
                <td><code>{segment.algorithmVersion}</code></td>
                <td>{contextLabels[segment.context]}</td>
                <td>{formatNumber(segment.metrics.requests)}</td>
                <td><strong>{formatPercent(segment.metrics.ctr)}</strong><span>{formatNumber(segment.metrics.clicks)}/{formatNumber(segment.metrics.impressions)}</span></td>
                <td>{formatPercent(segment.metrics.clickToCartRate)}</td>
                <td>{formatPercent(segment.metrics.cartToOrderRate)}</td>
                <td>{formatPercent(segment.metrics.orderToPaymentRate)}</td>
                <td>{formatPercent(segment.metrics.fallbackRate)}</td>
                <td>{segment.avgClickRank ? `#${segment.avgClickRank}` : '-'}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={9}>Chưa có dữ liệu phiên bản đề xuất trong kỳ này.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export function RecommendationReportsPage({ currentUser }: { currentUser: AdminUser }) {
  const initialFilters = useMemo(() => buildDefaultRecommendationAnalyticsFilters(), [])
  const [filters, setFilters] = useState<RecommendationAnalyticsFilters>(() => ({ ...initialFilters }))
  const [appliedFilters, setAppliedFilters] = useState<RecommendationAnalyticsFilters>(() => ({ ...initialFilters }))
  const [analytics, setAnalytics] = useState<RecommendationAnalytics | null>(null)
  const [activeTab, setActiveTab] = useState<ReportTab>('search')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const latestRequestId = useRef(0)

  const loadAnalytics = useCallback(async (activeFilters: RecommendationAnalyticsFilters) => {
    const requestId = latestRequestId.current + 1
    latestRequestId.current = requestId
    setLoading(true)
    setError('')
    try {
      const nextAnalytics = await getRecommendationAnalytics(activeFilters)
      if (requestId === latestRequestId.current) {
        setAnalytics(nextAnalytics)
      }
    } catch (caught) {
      if (requestId === latestRequestId.current) {
        setError(caught instanceof Error ? caught.message : 'Không thể tải báo cáo gợi ý.')
      }
    } finally {
      if (requestId === latestRequestId.current) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => { void loadAnalytics(appliedFilters) }, [appliedFilters, loadAnalytics])

  const algorithmOptions = useMemo(() => {
    const versions = new Set(analytics?.segments.map((segment) => segment.algorithmVersion) ?? [])
    if (filters.algorithmVersion?.trim()) versions.add(filters.algorithmVersion.trim())
    return Array.from(versions).sort()
  }, [analytics?.segments, filters.algorithmVersion])
  const bestSegment = useMemo(() => {
    if (!analytics) return null
    const relevantSegments = analytics.filters.algorithmVersion
      ? analytics.segments
      : analytics.segments.filter(
        (segment) => segment.algorithmVersion === analytics.currentAlgorithmVersion,
      )
    return getBestRecommendationSegment(relevantSegments)
  }, [analytics])
  const insightItems = useMemo(() => analytics ? getInsightItems(analytics, bestSegment) : [], [analytics, bestSegment])
  const hasRecommendationData = Boolean(analytics && (
    analytics.summary.requests > 0 ||
    analytics.summary.impressions > 0 ||
    analytics.summary.clicks > 0
  ))
  const hasSearchData = Boolean(analytics && analytics.search.totalSearches > 0)
  const hasAnyData = hasRecommendationData || hasSearchData

  return (
    <section className="admin-ui-page admin-rec-page" aria-busy={activeTab !== 'merchandising' && loading}>
      <PageHeader
        title="Tìm kiếm & khám phá"
        description="Hiệu suất tìm kiếm và đề xuất sản phẩm trên cửa hàng."
        breadcrumbs={['Báo cáo', 'Tìm kiếm & khám phá']}
        actions={activeTab === 'merchandising' ? undefined : (
          <Button
            variant="primary"
            icon={<RefreshCcw aria-hidden="true" />}
            disabled={loading}
            onClick={() => void loadAnalytics(appliedFilters)}
          >
            {loading ? 'Đang tải' : 'Làm mới'}
          </Button>
        )}
      />

      <div className="admin-rec-tabs">
        <Tabs items={reportTabs} value={activeTab} onChange={setActiveTab} ariaLabel="Nhóm báo cáo tìm kiếm và khám phá" />
      </div>

      {activeTab === 'merchandising' ? (
        <RecommendationMerchandisingPanel canManage={hasPermission(currentUser, 'catalog.write')} />
      ) : (
        <>

      <form className="admin-rec-filters" onSubmit={(event) => {
        event.preventDefault()
        setAppliedFilters({ ...filters })
      }}>
        <label>
          <span>Từ ngày</span>
          <input
            type="date"
            value={filters.from ?? ''}
            max={filters.to}
            onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))}
          />
        </label>
        <label>
          <span>Đến ngày</span>
          <input
            type="date"
            value={filters.to ?? ''}
            min={filters.from}
            max={toDateInput(new Date())}
            onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))}
          />
        </label>
        {activeTab === 'recommendations' ? (
          <>
            <label>
              <span>Vị trí đề xuất</span>
              <select
                value={filters.context ?? 'all'}
                onChange={(event) => setFilters((current) => ({
                  ...current,
                  context: event.target.value as RecommendationAnalyticsFilters['context'],
                }))}
              >
                <option value="all">Tất cả vị trí</option>
                <option value="home">Trang chủ</option>
                <option value="product_detail_similar">Chi tiết sản phẩm</option>
                <option value="cart">Giỏ hàng</option>
              </select>
            </label>
            <label>
              <span>Phiên bản thuật toán</span>
              <input
                list="admin-rec-algorithm-options"
                value={filters.algorithmVersion ?? ''}
                onChange={(event) => setFilters((current) => ({ ...current, algorithmVersion: event.target.value }))}
                placeholder="Tất cả phiên bản"
              />
              <datalist id="admin-rec-algorithm-options">
                {algorithmOptions.map((version) => <option key={version} value={version} />)}
              </datalist>
            </label>
          </>
        ) : null}
        <Button variant="secondary" icon={<Search aria-hidden="true" />} disabled={loading} type="submit">
          Áp dụng
        </Button>
      </form>

      {error ? <div className="admin-rec-error" role="alert">{error}</div> : null}

      {analytics ? (
        <>
          {!hasAnyData ? (
            <ReportEmptyState
              title="Chưa có dữ liệu tìm kiếm hoặc đề xuất"
              detail="Hãy chọn khoảng thời gian khác hoặc kiểm tra việc ghi nhận lượt tìm kiếm và hiển thị đề xuất trên cửa hàng."
            />
          ) : null}

          {activeTab === 'recommendations' && !hasRecommendationData && hasAnyData ? (
            <ReportEmptyState
              title="Chưa có dữ liệu đề xuất sản phẩm"
              detail="Khoảng thời gian này có dữ liệu tìm kiếm nhưng chưa ghi nhận yêu cầu hoặc lượt hiển thị đề xuất."
            />
          ) : null}

          <div className="admin-rec-tab-panel" role="tabpanel" hidden={activeTab !== 'recommendations' || !hasRecommendationData}>
            <SummaryStrip items={[
              { label: 'Lượt hiển thị', value: formatNumber(analytics.summary.impressions), detail: `${formatNumber(analytics.summary.requests)} yêu cầu đề xuất` },
              { label: 'Tỷ lệ nhấp', value: formatPercent(analytics.summary.ctr), detail: `${formatNumber(analytics.summary.clicks)} lượt nhấp` },
              { label: 'Đơn đã thanh toán', value: formatNumber(analytics.summary.paymentsCompleted), detail: `${formatChange(getMetricChange(analytics, 'paymentsCompleted'))} so với kỳ trước` },
              { label: 'Doanh thu liên quan', value: formatCurrency(analytics.summary.netAttributedRevenue), detail: 'Có tương tác với đề xuất' },
            ]} />
            {insightItems.length ? (
              <div className="admin-rec-action-notice">
                <strong>{insightItems[0].title}</strong>
                <span>{insightItems[0].detail}</span>
                <a href={insightItems[0].href}>{insightItems[0].actionLabel}</a>
              </div>
            ) : null}
          </div>

          <section id="rec-performance" className="admin-rec-section-block admin-rec-tab-panel" role="tabpanel" hidden={activeTab !== 'recommendations' || !hasRecommendationData}>
            <header className="admin-rec-section-heading">
              <div><h2>Hiệu suất đề xuất</h2><p>Phễu chuyển đổi và xu hướng trong khoảng thời gian đã chọn.</p></div>
            </header>
            <div className="admin-rec-main-grid">
              <FunnelPanel summary={analytics.summary} />
              <TrendPanel analytics={analytics} />
            </div>
          </section>

          <section className="admin-rec-section-block admin-rec-tab-panel" role="tabpanel" hidden={activeTab !== 'recommendations' || !hasRecommendationData}>
            <header className="admin-rec-section-heading">
              <div><h2>Sản phẩm và độ phủ</h2><p>Sản phẩm tạo tương tác cùng mức độ bao phủ danh mục, thương hiệu.</p></div>
            </header>
            <TopProductsPanel analytics={analytics} />

            <div className="admin-rec-main-grid">
              <CoverageList title="Độ phủ danh mục" group={analytics.coverage.categories} />
              <CoverageList title="Độ phủ thương hiệu" group={analytics.coverage.brands} />
            </div>
          </section>

          <section className="admin-rec-tab-panel" role="tabpanel" hidden={activeTab !== 'search' || !hasSearchData}>
            <SummaryStrip items={[
              { label: 'Lượt tìm kiếm', value: formatNumber(analytics.search.totalSearches), detail: `${formatNumber(analytics.search.keywordSearches)} từ khóa · ${formatNumber(analytics.search.imageSearches)} hình ảnh` },
              { label: 'Không có kết quả', value: formatPercent(analytics.search.zeroResultRate), detail: 'Cần xử lý từ đồng nghĩa hoặc danh mục', alert: analytics.search.zeroResultRate >= 0.1 },
              { label: 'Kết quả trung bình', value: formatNumber(analytics.search.averageResultCount), detail: 'Trên mỗi lượt tìm kiếm' },
              { label: 'Lượt mở sản phẩm', value: formatNumber(analytics.search.searchResultClicks), detail: 'Từ trang kết quả tìm kiếm' },
            ]} />
            <div className="admin-rec-main-grid admin-rec-search-grid">
              <SearchDemandPanel analytics={analytics} />
              <SearchTrendPanel analytics={analytics} />
            </div>
          </section>

          {activeTab === 'search' && !hasSearchData && hasAnyData ? (
            <ReportEmptyState
              title="Chưa có dữ liệu tìm kiếm"
              detail="Khoảng thời gian này có dữ liệu đề xuất nhưng chưa ghi nhận lượt tìm kiếm trên cửa hàng."
            />
          ) : null}

          <details id="rec-model-health" className="admin-rec-technical admin-rec-tab-panel" hidden={activeTab !== 'recommendations' || !hasRecommendationData}>
            <summary>
              <div>
                <span>Dành cho quản trị kỹ thuật</span>
                <strong>Chất lượng đề xuất và chẩn đoán</strong>
                <small>Phiên bản thuật toán, kết quả dự phòng, độ đa dạng và attribution gần nhất.</small>
              </div>
              <span className="admin-rec-technical-toggle">Chi tiết <b aria-hidden="true">+</b></span>
            </summary>
            <div className="admin-rec-technical-body">
              <SegmentTable segments={analytics.segments} />
              <div className="admin-rec-secondary-grid">
                <DiversityPanel analytics={analytics} />
                <RecentRequestsPanel analytics={analytics} />
              </div>
            </div>
          </details>

          <footer className="admin-rec-footnote" hidden={!hasAnyData}>
            {activeTab === 'recommendations' ? <MiniDelta value={analytics.comparison.fallbackRatePercent} /> : null}
            <span>Cập nhật {formatDateTime(analytics.generatedAt)}{activeTab === 'recommendations' ? ' · Doanh thu liên quan thể hiện mối liên hệ, không khẳng định tác động tăng thêm.' : ''}</span>
          </footer>
        </>
      ) : (
        <div className="admin-rec-loading">{loading ? 'Đang tải báo cáo...' : 'Chưa có dữ liệu báo cáo.'}</div>
      )}
        </>
      )}
    </section>
  )
}
