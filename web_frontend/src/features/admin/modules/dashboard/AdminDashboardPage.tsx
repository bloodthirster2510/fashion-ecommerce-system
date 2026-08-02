import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Boxes,
  Check,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Headphones,
  Minus,
  PackageCheck,
  RefreshCcw,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  Star,
  TicketPercent,
  TrendingUp,
  UserRoundCheck,
} from 'lucide-react'
import { MetricLineChart } from '../../components/ui'
import type { AdminUser } from '../auth/adminSession'
import { useNotificationSummary } from '../../notifications/notification-summary-context'
import type { NotificationSummary } from '../../notifications/notification-summary.types'
import { notifyAdminNavigation } from '../../services/adminNavigation'
import { getAdminDashboardOverview } from './dashboard.service'
import {
  buildDashboardAttentionItems,
  type DashboardAttentionKey,
} from './dashboard.presentation'
import type {
  AdminDashboardOverview,
  DashboardBusinessSummary,
  DashboardInventoryRisk,
} from './dashboard.types'
import './dashboard.css'

type DashboardRangeDays = 7 | 30 | 90
type TrendMetric = 'paidRevenue' | 'paidOrders'

const rangeOptions: Array<{ value: DashboardRangeDays; label: string }> = [
  { value: 7, label: '7 ngày' },
  { value: 30, label: '30 ngày' },
  { value: 90, label: '90 ngày' },
]

const orderStatusLabels: Record<string, string> = {
  confirmed: 'Đã xác nhận',
  packed: 'Đã đóng gói',
  shipping: 'Đang giao',
  delivered: 'Đã giao',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
  return_requested: 'Yêu cầu trả',
  return_approved: 'Đã duyệt trả',
  returned: 'Đã trả',
}

const formatNumber = (value = 0) => new Intl.NumberFormat('vi-VN').format(value)
const formatCurrency = (value = 0) => new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
}).format(value)
const formatCompactCurrency = (value: number) => {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tỷ`
  if (value >= 1_000_000) return `${(value / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tr`
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`
  return formatNumber(Math.round(value))
}
const formatPercent = (value = 0) => `${(value * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`
const formatDateLabel = (value: string) => new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
}).format(new Date(`${value}T00:00:00+07:00`))
const formatUpdatedAt = (value?: string) => value
  ? new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
  : '--:--'

const getGreeting = () => {
  const hour = new Date().getHours()
  if (hour < 11) return 'Chào buổi sáng'
  if (hour < 18) return 'Chào buổi chiều'
  return 'Chào buổi tối'
}

const navigateAdmin = (href: string) => {
  if (`${window.location.pathname}${window.location.search}` !== href) {
    window.history.pushState(null, '', href)
    notifyAdminNavigation()
  }
}

const getAttentionIcon = (key: DashboardAttentionKey) => ({
  'payment-deadline': <Clock3 />,
  packing: <ShoppingBag />,
  handoff: <PackageCheck />,
  returns: <RotateCcw />,
  support: <Headphones />,
  inventory: <Boxes />,
  reviews: <Star />,
  coupons: <TicketPercent />,
})[key]

function Delta({ value, suffix = '%' }: { value: number | null; suffix?: string }) {
  const tone = value === null || value === 0 ? 'neutral' : value > 0 ? 'up' : 'down'
  const Icon = tone === 'up' ? ArrowUpRight : tone === 'down' ? ArrowDownRight : Minus
  const label = value === null ? 'Kỳ đầu' : `${value > 0 ? '+' : ''}${value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}${suffix}`

  return <span className={`admin-dash-delta is-${tone}`}><Icon aria-hidden="true" />{label}</span>
}

function BusinessKpis({ business }: { business: NonNullable<AdminDashboardOverview['business']> }) {
  const { summary, comparison } = business
  const cards = [
    {
      label: 'Doanh thu đã thanh toán',
      value: formatCurrency(summary.paidRevenue),
      detail: `${formatNumber(summary.itemsSold)} sản phẩm đã bán`,
      change: comparison.paidRevenuePercent,
      icon: <CircleDollarSign />,
      tone: 'violet',
    },
    {
      label: 'Đơn đã thanh toán',
      value: formatNumber(summary.paidOrders),
      detail: `${formatNumber(summary.totalOrders)} đơn được tạo`,
      change: comparison.paidOrdersPercent,
      icon: <PackageCheck />,
      tone: 'blue',
    },
    {
      label: 'Giá trị đơn trung bình',
      value: formatCurrency(summary.averageOrderValue),
      detail: 'Trên mỗi đơn đã thanh toán',
      change: comparison.averageOrderValuePercent,
      icon: <CreditCard />,
      tone: 'amber',
    },
    {
      label: 'Khách quay lại',
      value: formatPercent(summary.returningCustomerRate),
      detail: `${formatNumber(summary.returningCustomers)}/${formatNumber(summary.customers)} khách mua`,
      change: comparison.returningCustomerRatePoints,
      suffix: ' điểm %',
      icon: <UserRoundCheck />,
      tone: 'green',
    },
  ]

  return (
    <section className="admin-dash-kpi-grid" aria-label="Chỉ số kinh doanh chính">
      {cards.map((card) => (
        <article className={`admin-dash-kpi is-${card.tone}`} key={card.label}>
          <header>
            <span>{card.label}</span>
            <i aria-hidden="true">{card.icon}</i>
          </header>
          <strong>{card.value}</strong>
          <footer>
            <Delta value={card.change} suffix={card.suffix} />
            <span>{card.detail}</span>
          </footer>
        </article>
      ))}
    </section>
  )
}

function AttentionCenter({ summary, loading }: { summary: NotificationSummary | null; loading: boolean }) {
  const items = useMemo(() => buildDashboardAttentionItems(summary), [summary])

  return (
    <section className="admin-dash-card admin-dash-attention">
      <header className="admin-dash-card-heading">
        <div>
          <span>Ưu tiên hôm nay</span>
          <h2>Cần bạn xử lý</h2>
        </div>
        {summary?.total ? <b>{formatNumber(summary.total)}</b> : null}
      </header>

      {loading && !summary ? (
        <div className="admin-dash-inline-loading">Đang đồng bộ công việc…</div>
      ) : items.length ? (
        <div className="admin-dash-attention-list">
          {items.map((item) => (
            <button type="button" key={item.key} onClick={() => navigateAdmin(item.href)}>
              <i className={`is-${item.tone}`} aria-hidden="true">{getAttentionIcon(item.key)}</i>
              <span>
                <strong>{item.title}</strong>
                <small>{item.detail}</small>
              </span>
              <em>{formatNumber(item.count)}</em>
              <ArrowRight aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : (
        <div className="admin-dash-all-clear">
          <i><Check aria-hidden="true" /></i>
          <strong>Không có việc tồn đọng</strong>
          <span>Các hàng chờ theo quyền của bạn đang ở trạng thái tốt.</span>
        </div>
      )}
    </section>
  )
}

function SalesTrend({ overview }: { overview: AdminDashboardOverview }) {
  const [metric, setMetric] = useState<TrendMetric>('paidRevenue')
  const trend = overview.business?.trend ?? []
  const points = trend.map((point) => ({
    label: formatDateLabel(point.date),
    value: point[metric],
  }))
  const summary = overview.business?.summary
  const metricValue = metric === 'paidRevenue'
    ? formatCurrency(summary?.paidRevenue ?? 0)
    : `${formatNumber(summary?.paidOrders ?? 0)} đơn`

  return (
    <section className="admin-dash-card admin-dash-trend-card">
      <header className="admin-dash-card-heading is-with-controls">
        <div>
          <span>Hiệu suất kinh doanh</span>
          <h2>Xu hướng {overview.range.days} ngày</h2>
        </div>
        <div className="admin-dash-segmented" role="group" aria-label="Chọn chỉ số biểu đồ">
          <button type="button" className={metric === 'paidRevenue' ? 'is-active' : ''} onClick={() => setMetric('paidRevenue')}>Doanh thu</button>
          <button type="button" className={metric === 'paidOrders' ? 'is-active' : ''} onClick={() => setMetric('paidOrders')}>Đơn paid</button>
        </div>
      </header>
      <div className="admin-dash-trend-total">
        <strong>{metricValue}</strong>
        <span>Tổng trong kỳ đã chọn</span>
      </div>
      <div className="admin-dash-chart-scroll">
        <MetricLineChart
          points={points}
          ariaLabel={metric === 'paidRevenue' ? 'Doanh thu đã thanh toán theo ngày' : 'Số đơn đã thanh toán theo ngày'}
          formatValue={metric === 'paidRevenue' ? formatCompactCurrency : (value) => formatNumber(Math.round(value))}
        />
      </div>
    </section>
  )
}

function TopProducts({ overview }: { overview: AdminDashboardOverview }) {
  const products = overview.business?.topProducts ?? []
  const maximum = Math.max(...products.map((product) => product.grossSales), 1)

  return (
    <section className="admin-dash-card admin-dash-products">
      <header className="admin-dash-card-heading">
        <div>
          <span>Sản phẩm</span>
          <h2>Đóng góp doanh số</h2>
        </div>
        <TrendingUp aria-hidden="true" />
      </header>
      <p className="admin-dash-card-note">Xếp hạng theo doanh số dòng hàng trước phân bổ giảm giá.</p>
      <div className="admin-dash-product-list">
        {products.length ? products.map((product, index) => (
          <article key={`${product.productId}-${product.sku}`}>
            <span className="admin-dash-rank">{String(index + 1).padStart(2, '0')}</span>
            {product.image ? <img src={product.image} alt="" /> : <span className="admin-dash-product-image" />}
            <div>
              <strong>{product.name}</strong>
              <small>{product.sku} · {formatNumber(product.units)} sản phẩm</small>
              <i aria-hidden="true"><em style={{ width: `${Math.max(4, (product.grossSales / maximum) * 100)}%` }} /></i>
            </div>
            <b>{formatCompactCurrency(product.grossSales)}</b>
          </article>
        )) : <div className="admin-dash-compact-empty">Chưa có đơn đã thanh toán trong kỳ.</div>}
      </div>
    </section>
  )
}

const getInventoryRiskLabel = (item: DashboardInventoryRisk) => {
  if (item.availableQuantity === 0) return { label: 'Hết hàng', tone: 'danger' }
  if (item.daysRemaining !== null && item.daysRemaining <= 7) return { label: `${Math.ceil(item.daysRemaining)} ngày`, tone: 'danger' }
  if (item.daysRemaining !== null) return { label: `${Math.ceil(item.daysRemaining)} ngày`, tone: 'warning' }
  return { label: 'Bán chậm', tone: 'neutral' }
}

function InventoryRisk({ overview }: { overview: AdminDashboardOverview }) {
  const inventory = overview.inventory
  if (!inventory) return null

  return (
    <section className="admin-dash-card admin-dash-inventory">
      <header className="admin-dash-card-heading">
        <div>
          <span>Tồn kho</span>
          <h2>Rủi ro cần nhập hàng</h2>
        </div>
        <button type="button" onClick={() => navigateAdmin('/admin/inventory')}>Xem kho <ArrowRight /></button>
      </header>
      <div className="admin-dash-inventory-summary">
        <div><strong>{formatNumber(inventory.outOfStockSkus)}</strong><span>hết hàng</span></div>
        <div><strong>{formatNumber(inventory.lowStockSkus)}</strong><span>tồn thấp</span></div>
        <div><strong>{formatNumber(inventory.reservedUnits)}</strong><span>đang giữ</span></div>
      </div>
      <div className="admin-dash-stock-list">
        {inventory.atRisk.length ? inventory.atRisk.map((item) => {
          const risk = getInventoryRiskLabel(item)
          return (
            <article key={item.inventoryId}>
              {item.image ? <img src={item.image} alt="" /> : <span />}
              <div>
                <strong>{item.name}</strong>
                <small>{item.sku} · Size {item.size} · còn {formatNumber(item.availableQuantity)}</small>
              </div>
              <em className={`is-${risk.tone}`}>{risk.label}</em>
            </article>
          )
        }) : <div className="admin-dash-compact-empty">Không có SKU tồn kho thấp.</div>}
      </div>
    </section>
  )
}

function CustomerMix({ summary }: { summary: DashboardBusinessSummary }) {
  const newRate = summary.customers ? summary.newCustomers / summary.customers : 0
  const returningRate = summary.customers ? summary.returningCustomers / summary.customers : 0

  return (
    <section className="admin-dash-card admin-dash-customer-mix">
      <header className="admin-dash-card-heading">
        <div>
          <span>Khách hàng</span>
          <h2>Cơ cấu người mua</h2>
        </div>
        <UserRoundCheck aria-hidden="true" />
      </header>
      <div className="admin-dash-customer-total">
        <strong>{formatNumber(summary.customers)}</strong>
        <span>khách đã thanh toán trong kỳ</span>
      </div>
      <div className="admin-dash-mix-bar" aria-label={`${formatPercent(newRate)} khách mới, ${formatPercent(returningRate)} khách quay lại`}>
        <i style={{ width: `${newRate * 100}%` }} />
        <em style={{ width: `${returningRate * 100}%` }} />
      </div>
      <div className="admin-dash-mix-legend">
        <div><i /><span>Khách mới<small>{formatNumber(summary.newCustomers)} · {formatPercent(newRate)}</small></span></div>
        <div><i /><span>Quay lại<small>{formatNumber(summary.returningCustomers)} · {formatPercent(returningRate)}</small></span></div>
      </div>
      <p>Khách quay lại được xác định khi đã có đơn thanh toán trước kỳ đang xem.</p>
    </section>
  )
}

function OrderHealth({ overview }: { overview: AdminDashboardOverview }) {
  const total = overview.orderHealth.reduce((sum, item) => sum + item.count, 0)
  const maximum = Math.max(...overview.orderHealth.map((item) => item.count), 1)

  return (
    <section className="admin-dash-card admin-dash-order-health">
      <header className="admin-dash-card-heading">
        <div>
          <span>Vận hành</span>
          <h2>Trạng thái đơn trong kỳ</h2>
        </div>
        <button type="button" onClick={() => navigateAdmin('/admin/orders')}>Xem đơn <ArrowRight /></button>
      </header>
      <div className="admin-dash-order-total"><strong>{formatNumber(total)}</strong><span>đơn được tạo</span></div>
      <div className="admin-dash-status-list">
        {overview.orderHealth.length ? overview.orderHealth.slice(0, 6).map((item) => (
          <article key={item.status}>
            <span>{orderStatusLabels[item.status] ?? item.status}</span>
            <i aria-hidden="true"><em style={{ width: `${Math.max(3, (item.count / maximum) * 100)}%` }} /></i>
            <strong>{formatNumber(item.count)}</strong>
          </article>
        )) : <div className="admin-dash-compact-empty">Chưa có đơn trong kỳ đã chọn.</div>}
      </div>
    </section>
  )
}

function NoBusinessAccess({ currentUser }: { currentUser: AdminUser }) {
  return (
    <section className="admin-dash-permission-note">
      <i><Sparkles aria-hidden="true" /></i>
      <div>
        <strong>Dashboard đang hiển thị theo quyền của bạn</strong>
        <span>{currentUser.name || currentUser.email} vẫn có thể theo dõi và mở trực tiếp mọi hàng chờ được phân công. Cần quyền “Báo cáo” để xem doanh thu và hiệu suất cửa hàng.</span>
      </div>
    </section>
  )
}

function DashboardSkeleton() {
  return (
    <div className="admin-dash-skeleton" aria-label="Đang tải tổng quan" role="status">
      <div className="admin-dash-skeleton-kpis">{Array.from({ length: 4 }, (_, index) => <i key={index} />)}</div>
      <div className="admin-dash-skeleton-main"><i /><i /></div>
    </div>
  )
}

export function AdminDashboardPage({ currentUser }: { currentUser: AdminUser }) {
  const [days, setDays] = useState<DashboardRangeDays>(30)
  const [overview, setOverview] = useState<AdminDashboardOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const latestRequestId = useRef(0)
  const { summary: notificationSummary, loading: notificationLoading, refresh: refreshNotifications } = useNotificationSummary()

  const loadOverview = useCallback(async (selectedDays: DashboardRangeDays) => {
    const requestId = latestRequestId.current + 1
    latestRequestId.current = requestId
    setLoading(true)
    setError('')
    try {
      const result = await getAdminDashboardOverview(selectedDays)
      if (requestId === latestRequestId.current) setOverview(result)
    } catch (caught) {
      if (requestId === latestRequestId.current) {
        setError(caught instanceof Error ? caught.message : 'Không thể tải tổng quan cửa hàng.')
      }
    } finally {
      if (requestId === latestRequestId.current) setLoading(false)
    }
  }, [])

  useEffect(() => { void loadOverview(days) }, [days, loadOverview])

  const refreshAll = () => {
    void Promise.all([loadOverview(days), refreshNotifications()])
  }
  const fullName = currentUser.name?.trim()
  const firstName = currentUser.role === 'admin' && fullName?.toLocaleLowerCase('vi-VN') === 'quản trị viên'
    ? fullName
    : fullName?.split(/\s+/).at(-1) || 'bạn'

  return (
    <section className="admin-ui-page admin-dash-page" aria-busy={loading}>
      <header className="admin-dash-hero">
        <div className="admin-dash-hero-copy">
          <span className="admin-dash-eyebrow">{currentUser.role === 'admin' ? 'Góc nhìn chủ cửa hàng' : 'Không gian làm việc của bạn'}</span>
          <h1>{getGreeting()}, {firstName}</h1>
          <p>Theo dõi nhịp bán hàng, nhận diện rủi ro và đi thẳng tới việc cần xử lý.</p>
          <small>Cập nhật lúc {formatUpdatedAt(overview?.generatedAt ?? notificationSummary?.generatedAt)}</small>
        </div>
        <div className="admin-dash-hero-controls">
          <div className="admin-dash-range" role="group" aria-label="Khoảng thời gian báo cáo">
            {rangeOptions.map((option) => (
              <button
                type="button"
                className={days === option.value ? 'is-active' : ''}
                key={option.value}
                onClick={() => setDays(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button className="admin-dash-refresh" type="button" disabled={loading} onClick={refreshAll} aria-label="Làm mới dashboard">
            <RefreshCcw aria-hidden="true" />
          </button>
        </div>
      </header>

      {error ? (
        <div className="admin-dash-error" role="alert">
          <AlertTriangle aria-hidden="true" />
          <span><strong>Chưa thể đồng bộ dữ liệu</strong>{error}</span>
          <button type="button" onClick={() => void loadOverview(days)}>Thử lại</button>
        </div>
      ) : null}

      {loading && !overview ? <DashboardSkeleton /> : overview ? (
        overview.business ? (
          <>
            <BusinessKpis business={overview.business} />

            <div className="admin-dash-primary-grid">
              <SalesTrend overview={overview} />
              <AttentionCenter summary={notificationSummary} loading={notificationLoading} />
            </div>

            <div className="admin-dash-secondary-grid">
              <TopProducts overview={overview} />
              {overview.inventory ? <InventoryRisk overview={overview} /> : null}
              <CustomerMix summary={overview.business.summary} />
              {overview.capabilities.orders ? <OrderHealth overview={overview} /> : null}
            </div>
          </>
        ) : (
          <>
            <NoBusinessAccess currentUser={currentUser} />

            <div className="admin-dash-staff-grid">
              <AttentionCenter summary={notificationSummary} loading={notificationLoading} />
              {overview.inventory ? <InventoryRisk overview={overview} /> : null}
              {overview.capabilities.orders ? <OrderHealth overview={overview} /> : null}
            </div>
          </>
        )
      ) : null}
    </section>
  )
}
