import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  Boxes,
  Gauge,
  Layers3,
  MousePointerClick,
  PackageCheck,
  RefreshCcw,
  Search,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react'
import {
  Button,
  KpiCard,
  KpiGrid,
  MetricLineChart,
  PageHeader,
} from '../../components/ui'
import {
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
import './recommendationReports.css'

type MetricKey = keyof Pick<
  RecommendationMetricSnapshot,
  'requests' | 'impressions' | 'clicks' | 'addToCarts' | 'ordersCreated' | 'paymentsCompleted' | 'netAttributedRevenue'
>

type CssVars = CSSProperties & Record<`--${string}`, string>

const contextLabels: Record<RecommendationContext, string> = {
  home: 'Home',
  product_detail_similar: 'Chi tiết sản phẩm',
  cart: 'Giỏ hàng',
}

const toDateInput = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

const defaultFilters = (): RecommendationAnalyticsFilters => ({
  from: toDateInput(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
  to: toDateInput(new Date()),
  context: 'all',
  algorithmVersion: '',
})

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

const getBestSegment = (segments: RecommendationSegment[]) =>
  [...segments]
    .filter((segment) => segment.metrics.impressions >= 100)
    .sort((left, right) =>
      right.metrics.ctr - left.metrics.ctr ||
      right.metrics.clicks - left.metrics.clicks,
    )[0] ?? segments[0] ?? null

const getInsightItems = (analytics: RecommendationAnalytics, bestSegment: RecommendationSegment | null) => {
  const items: Array<{
    title: string
    detail: string
    tone: 'good' | 'warn' | 'info'
    actionLabel: string
    href: string
  }> = []

  if (bestSegment) {
    items.push({
      title: `${contextLabels[bestSegment.context]} nổi bật`,
      detail: `${bestSegment.algorithmVersion} đạt CTR ${formatPercent(bestSegment.metrics.ctr)} trên ${formatNumber(bestSegment.metrics.impressions)} impression.`,
      tone: 'good',
      actionLabel: 'So sánh phiên bản',
      href: '#rec-model-health',
    })
  }

  if (analytics.summary.fallbackRate >= 0.15 && analytics.summary.requests >= 50) {
    items.push({
      title: 'Fallback cần theo dõi',
      detail: `${formatPercent(analytics.summary.fallbackRate)} request đang dùng fallback; nên xem lại dữ liệu hành vi hoặc catalog thiếu tín hiệu.`,
      tone: 'warn',
      actionLabel: 'Kiểm tra mô hình',
      href: '#rec-model-health',
    })
  }

  if (analytics.diversity.averageCategoryDiversityAt10 < 0.45 && analytics.diversity.requestsSampled >= 20) {
    items.push({
      title: 'Diversity danh mục thấp',
      detail: `Top 10 trung bình chỉ đạt ${formatPercent(analytics.diversity.averageCategoryDiversityAt10)} unique category/item.`,
      tone: 'warn',
      actionLabel: 'Xem diversity',
      href: '#rec-model-health',
    })
  }

  if (analytics.search.zeroResultRate >= 0.2 && analytics.search.totalSearches >= 50) {
    items.push({
      title: 'Search có nhiều truy vấn trống',
      detail: `${formatPercent(analytics.search.zeroResultRate)} lượt search không có kết quả; top keyword bên dưới giúp ưu tiên synonym/catalog.`,
      tone: 'warn',
      actionLabel: 'Xem từ khóa',
      href: '#rec-search',
    })
  }

  if (analytics.summary.clicks > 0 && analytics.summary.addToCarts === 0) {
    items.push({
      title: 'Click chưa sang giỏ',
      detail: 'Có click recommendation nhưng chưa có add-to-cart attribution trong kỳ này.',
      tone: 'info',
      actionLabel: 'Xem funnel',
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
      detail: `Doanh thu attribution ròng giảm ${Math.abs(analytics.comparison.netAttributedRevenuePercent).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}% so với kỳ trước.`,
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
    { label: 'Impression', count: summary.impressions, rate: 1, helper: 'Sản phẩm thật sự được nhìn thấy' },
    { label: 'Click', count: summary.clicks, rate: summary.ctr, helper: 'CTR từ impression' },
    { label: 'Add to cart', count: summary.addToCarts, rate: summary.clickToCartRate, helper: 'Từ click sang giỏ' },
    { label: 'Order created', count: summary.ordersCreated, rate: summary.cartToOrderRate, helper: 'Từ giỏ sang tạo đơn' },
    { label: 'Payment completed', count: summary.paymentsCompleted, rate: summary.orderToPaymentRate, helper: 'Từ đơn sang thanh toán thật' },
  ]

  return (
    <section className="admin-rec-panel admin-rec-funnel-panel">
      <header>
        <div>
          <span>Recommendation funnel</span>
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
    impressions: { label: 'Impression', format: (value: number) => formatNumber(Math.round(value)) },
    paymentsCompleted: { label: 'Đơn paid', format: (value: number) => formatNumber(Math.round(value)) },
  }[metric]
  const points = analytics.trend.map((point) => ({
    label: formatDate(point.date),
    value: point[metric],
  }))

  return (
    <section className="admin-rec-panel admin-rec-trend-panel">
      <header className="admin-rec-trend-heading">
        <div>
          <span>Daily performance</span>
          <strong>Xu hướng hiệu quả theo ngày</strong>
        </div>
        <div className="admin-rec-metric-switch" role="group" aria-label="Chọn chỉ số xu hướng">
          <button type="button" className={metric === 'ctr' ? 'is-active' : ''} onClick={() => setMetric('ctr')}>CTR</button>
          <button type="button" className={metric === 'impressions' ? 'is-active' : ''} onClick={() => setMetric('impressions')}>View</button>
          <button type="button" className={metric === 'paymentsCompleted' ? 'is-active' : ''} onClick={() => setMetric('paymentsCompleted')}>Paid</button>
        </div>
      </header>
      <div className="admin-rec-trend-summary">
        <strong>{metricConfig.format(analytics.summary[metric])}</strong>
        <span>{metricConfig.label} trong kỳ đã chọn</span>
      </div>
      <div className="admin-rec-chart-scroll">
        <MetricLineChart points={points} ariaLabel={`${metricConfig.label} recommendation theo ngày`} formatValue={metricConfig.format} />
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
          <strong>{formatPercent(group.coverageRate)} coverage</strong>
        </div>
        <Boxes aria-hidden="true" />
      </header>
      <p>{formatNumber(group.uniqueRecommended)}/{formatNumber(group.totalActive)} nhóm active đã xuất hiện trong recommendation.</p>
      <div className="admin-rec-ranked-list">
        {group.top.length ? group.top.map((item: RecommendationCoverageItem) => (
          <article key={item.id}>
            <span>{item.name}</span>
            <i aria-hidden="true"><em style={widthStyle(item.recommendedCount / maximum)} /></i>
            <small>{formatNumber(item.recommendedCount)} lượt</small>
          </article>
        )) : (
          <p>Chưa có dữ liệu coverage trong kỳ này.</p>
        )}
      </div>
    </section>
  )
}

function DiversityPanel({ analytics }: { analytics: RecommendationAnalytics }) {
  const metrics = [
    { label: 'Danh mục trong top 10', value: analytics.diversity.averageCategoryDiversityAt10 },
    { label: 'Thương hiệu trong top 10', value: analytics.diversity.averageBrandDiversityAt10 },
  ]

  return (
    <section className="admin-rec-panel admin-rec-diversity-panel">
      <header>
        <div>
          <span>Diversity @10</span>
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
      <p>{formatNumber(analytics.diversity.requestsSampled)} request có đủ dữ liệu sản phẩm để tính diversity.</p>
    </section>
  )
}

function SegmentTable({ segments }: { segments: RecommendationSegment[] }) {
  return (
    <section className="admin-rec-panel admin-rec-segments-panel">
      <header>
        <div>
          <span>Algorithm x Context</span>
          <strong>So sánh phiên bản gợi ý</strong>
        </div>
        <Gauge aria-hidden="true" />
      </header>
      <div className="admin-rec-table-scroll">
        <table className="admin-rec-table">
          <thead>
            <tr>
              <th>Version</th>
              <th>Context</th>
              <th>Request</th>
              <th>CTR</th>
              <th>Click → giỏ</th>
              <th>Giỏ → đơn</th>
              <th>Đơn → paid</th>
              <th>Fallback</th>
              <th>Rank click</th>
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
                <td colSpan={9}>Chưa có segment recommendation trong kỳ này.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export function RecommendationReportsPage() {
  const [filters, setFilters] = useState<RecommendationAnalyticsFilters>(() => defaultFilters())
  const [appliedFilters, setAppliedFilters] = useState<RecommendationAnalyticsFilters>(() => defaultFilters())
  const [analytics, setAnalytics] = useState<RecommendationAnalytics | null>(null)
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
  const bestSegment = useMemo(() => analytics ? getBestSegment(analytics.segments) : null, [analytics])
  const insightItems = useMemo(() => analytics ? getInsightItems(analytics, bestSegment) : [], [analytics, bestSegment])
  const topKeywordMaximum = Math.max(...(analytics?.search.topKeywords.map((item) => item.count) ?? []), 1)

  return (
    <section className="admin-ui-page admin-rec-page" aria-busy={loading}>
      <PageHeader
        title="Gợi ý & tìm kiếm"
        description="Đánh giá giá trị kinh doanh, hành vi tìm kiếm và sức khỏe thuật toán trên cùng một luồng phân tích."
        breadcrumbs={['Báo cáo', 'Gợi ý & tìm kiếm']}
        actions={(
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
        <label>
          <span>Ngữ cảnh</span>
          <select
            value={filters.context ?? 'all'}
            onChange={(event) => setFilters((current) => ({
              ...current,
              context: event.target.value as RecommendationAnalyticsFilters['context'],
            }))}
          >
            <option value="all">Tất cả</option>
            <option value="home">Home</option>
            <option value="product_detail_similar">Chi tiết sản phẩm</option>
            <option value="cart">Giỏ hàng</option>
          </select>
        </label>
        <label>
          <span>Algorithm</span>
          <input
            list="admin-rec-algorithm-options"
            value={filters.algorithmVersion ?? ''}
            onChange={(event) => setFilters((current) => ({ ...current, algorithmVersion: event.target.value }))}
            placeholder="Tất cả version"
          />
          <datalist id="admin-rec-algorithm-options">
            {algorithmOptions.map((version) => <option key={version} value={version} />)}
          </datalist>
        </label>
        <Button variant="secondary" icon={<Search aria-hidden="true" />} disabled={loading} type="submit">
          Áp dụng
        </Button>
      </form>

      {error ? <div className="admin-rec-error" role="alert">{error}</div> : null}

      {analytics ? (
        <>
          <KpiGrid>
            <KpiCard
              label="Doanh thu có tương tác gợi ý"
              value={formatCurrency(analytics.summary.netAttributedRevenue)}
              meta={`${formatChange(getMetricChange(analytics, 'netAttributedRevenue'))} so với kỳ trước`}
              icon={<TrendingUp />}
              tone="accent"
            />
            <KpiCard
              label="Đơn paid từ gợi ý"
              value={formatNumber(analytics.summary.paymentsCompleted)}
              meta={`${formatChange(getMetricChange(analytics, 'paymentsCompleted'))} so với kỳ trước`}
              icon={<PackageCheck />}
              tone="success"
            />
            <KpiCard
              label="CTR"
              value={formatPercent(analytics.summary.ctr)}
              meta={`${formatNumber(analytics.summary.clicks)}/${formatNumber(analytics.summary.impressions)} lượt hiển thị`}
              icon={<MousePointerClick />}
              tone="info"
            />
            <KpiCard
              label="Fallback rate"
              value={formatPercent(analytics.summary.fallbackRate)}
              meta={`${formatNumber(analytics.summary.fallbackRequests)}/${formatNumber(analytics.summary.requests)} request`}
              icon={<Sparkles />}
              tone="warning"
            />
          </KpiGrid>

          <section className="admin-rec-insight-strip">
            {insightItems.length ? insightItems.map((item) => (
              <article key={item.title} className={`is-${item.tone}`}>
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                </div>
                <a href={item.href}>{item.actionLabel} <span aria-hidden="true">→</span></a>
              </article>
            )) : (
              <article className="is-info">
                <div>
                  <strong>Chưa đủ tín hiệu đáng tin cậy</strong>
                  <span>Insight chỉ xuất hiện khi có đủ request, impression hoặc search để tránh kết luận từ mẫu quá nhỏ.</span>
                </div>
              </article>
            )}
          </section>

          <section id="rec-performance" className="admin-rec-section-block">
            <header className="admin-rec-section-heading">
              <span>01 · Hiệu quả kinh doanh</span>
              <div><h2>Từ hiển thị đến thanh toán</h2><p>Nhìn điểm rơi theo từng bước và theo dõi một chỉ số có cùng thang đo theo thời gian.</p></div>
            </header>
            <div className="admin-rec-main-grid">
              <FunnelPanel summary={analytics.summary} />
              <TrendPanel analytics={analytics} />
            </div>
          </section>

          <section className="admin-rec-section-block">
            <header className="admin-rec-section-heading">
              <span>02 · Merchandising</span>
              <div><h2>Nhu cầu tìm kiếm và sản phẩm tạo giá trị</h2><p>Ưu tiên khoảng trống catalog và nhận diện sản phẩm kéo chuyển đổi từ recommendation.</p></div>
            </header>
            <div className="admin-rec-main-grid">
              <section id="rec-search" className="admin-rec-panel admin-rec-search-panel">
                <header>
                  <div>
                    <span>Search demand</span>
                    <strong>Ý định tìm kiếm</strong>
                  </div>
                  <Search aria-hidden="true" />
                </header>
                <div className="admin-rec-search-stats">
                  <div><span>Tổng search</span><strong>{formatNumber(analytics.search.totalSearches)}</strong></div>
                  <div><span>Click kết quả</span><strong>{formatNumber(analytics.search.searchResultClicks)}</strong></div>
                  <div><span>Không kết quả</span><strong>{formatPercent(analytics.search.zeroResultRate)}</strong></div>
                  <div><span>Kết quả TB</span><strong>{analytics.search.averageResultCount}</strong></div>
                </div>
                <div className="admin-rec-ranked-list">
                  {analytics.search.topKeywords.length ? analytics.search.topKeywords.map((keyword) => (
                    <article key={keyword.keyword}>
                      <span>{keyword.keyword}</span>
                      <i aria-hidden="true"><em style={widthStyle(keyword.count / topKeywordMaximum)} /></i>
                      <small>{formatNumber(keyword.count)} lượt</small>
                    </article>
                  )) : (
                    <p>Chưa có keyword search trong kỳ này.</p>
                  )}
                </div>
              </section>

              <section className="admin-rec-panel admin-rec-products-panel">
                <header>
                  <div>
                    <span>Top product</span>
                    <strong>Sản phẩm kéo chuyển đổi</strong>
                  </div>
                  <PackageCheck aria-hidden="true" />
                </header>
                <div className="admin-rec-product-list">
                  {analytics.topProducts.length ? analytics.topProducts.map((product) => (
                    <article key={product.productId}>
                      {product.image ? <img src={product.image} alt="" /> : <span className="admin-rec-product-fallback" />}
                      <div>
                        <strong>{product.name}</strong>
                        <span>{product.context.map((context) => contextLabels[context]).join(', ')}</span>
                      </div>
                      <small>{formatNumber(product.clicks)} click · {formatNumber(product.ordersCreated)} đơn · {formatNumber(product.paymentsCompleted)} paid · {formatCurrency(product.netAttributedRevenue)} net</small>
                    </article>
                  )) : (
                    <p>Chưa có click/order/payment từ recommendation trong kỳ này.</p>
                  )}
                </div>
              </section>
            </div>

            <div className="admin-rec-main-grid">
              <CoverageList title="Coverage danh mục" group={analytics.coverage.categories} />
              <CoverageList title="Coverage thương hiệu" group={analytics.coverage.brands} />
            </div>
          </section>

          <details id="rec-model-health" className="admin-rec-technical">
            <summary>
              <div>
                <span>03 · Dành cho quản trị kỹ thuật</span>
                <strong>Sức khỏe thuật toán & chẩn đoán request</strong>
                <small>Algorithm version, fallback, diversity và attribution gần nhất.</small>
              </div>
              <span className="admin-rec-technical-toggle">Mở chi tiết <b aria-hidden="true">+</b></span>
            </summary>
            <div className="admin-rec-technical-body">
              <SegmentTable segments={analytics.segments} />
              <div className="admin-rec-secondary-grid">
                <DiversityPanel analytics={analytics} />
                <section className="admin-rec-panel admin-rec-requests-panel">
                  <header>
                    <div>
                      <span>Request diagnostics</span>
                      <strong>Attribution gần nhất</strong>
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
                          {request.fallbackUsed ? 'Fallback' : `${request.itemCount} item`}
                        </em>
                        <b>{formatNumber(request.impressions)} view · {formatNumber(request.ordersCreated)} đơn · {formatNumber(request.paymentsCompleted)} paid</b>
                      </article>
                    )) : (
                      <p>Chưa có request recommendation trong kỳ này.</p>
                    )}
                  </div>
                </section>
              </div>
            </div>
          </details>

          <footer className="admin-rec-footnote">
            <MiniDelta value={analytics.comparison.fallbackRatePercent} />
            <span>Cập nhật {formatDateTime(analytics.generatedAt)} · Attribution thể hiện mối liên hệ, không phải doanh thu tăng thêm do gợi ý.</span>
          </footer>
        </>
      ) : (
        <div className="admin-rec-loading">{loading ? 'Đang tải báo cáo...' : 'Chưa có dữ liệu báo cáo.'}</div>
      )}
    </section>
  )
}
