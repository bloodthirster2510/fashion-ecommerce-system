import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useDialogAccessibility } from '../../../hooks/useDialogAccessibility'
import type { AdminUser } from '../../auth/adminSession'
import {
  createPromotionCampaign,
  deletePromotionCampaign,
  getPromotionAnalytics,
  listCoupons,
  listPromotionCampaigns,
  updatePromotionCampaign,
} from '../promotion.service'
import type {
  AdminCoupon,
  PromotionAnalytics,
  PromotionCampaign,
  PromotionCampaignPayload,
} from '../promotion.types'
import { useToast } from '../../../notifications/notification-context'
import {
  formatAdminDate,
  formatAdminDateInput,
  formatAdminDateTimeInput,
  parseAdminDateTimeInput,
} from '../../../utils/dateTime'

type Props = { currentUser: AdminUser }
type CampaignFieldErrors = Partial<Record<'code' | 'name' | 'startAt' | 'endAt' | 'couponIds' | 'maxCouponsPerOrder', string>>
const campaignDraftKey = 'fashionista.admin.campaign-draft'

const toDateTimeInput = (date: Date) => formatAdminDateTimeInput(date)

const toDateInput = (date: Date) => formatAdminDateInput(date)

const createInitialForm = (): PromotionCampaignPayload => ({
  code: '',
  name: '',
  description: '',
  couponIds: [],
  allowCouponStacking: true,
  maxCouponsPerOrder: 2,
  startAt: toDateTimeInput(new Date()),
  endAt: toDateTimeInput(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
  isActive: true,
})

const toCampaignForm = (campaign: PromotionCampaign): PromotionCampaignPayload => ({
  code: campaign.code,
  name: campaign.name,
  description: campaign.description ?? '',
  couponIds: campaign.couponIds.map((coupon) => typeof coupon === 'string' ? coupon : coupon._id),
  allowCouponStacking: campaign.allowCouponStacking,
  maxCouponsPerOrder: campaign.maxCouponsPerOrder,
  startAt: toDateTimeInput(new Date(campaign.startAt)),
  endAt: toDateTimeInput(new Date(campaign.endAt)),
  isActive: campaign.isActive,
})

const formatCurrency = (value = 0) => new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
}).format(value)

const formatRange = (analytics: PromotionAnalytics | null) => analytics
  ? `${formatAdminDate(analytics.range.from)} – ${formatAdminDate(analytics.range.to)}`
  : 'giai đoạn hiện tại'

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : 'Không thể xử lý yêu cầu'
const formatChange = (value: number | null | undefined) => value === null || value === undefined
  ? 'Mới'
  : `${value > 0 ? '+' : ''}${value}%`

const validateCampaignForm = (form: PromotionCampaignPayload): CampaignFieldErrors => {
  const errors: CampaignFieldErrors = {}
  if (!/^[A-Z0-9_-]{2,40}$/.test(form.code.trim().toUpperCase())) errors.code = 'Mã gồm 2–40 ký tự in hoa, số, “_” hoặc “-”.'
  if (form.name.trim().length < 2) errors.name = 'Tên chiến dịch cần ít nhất 2 ký tự.'
  const startAt = parseAdminDateTimeInput(form.startAt)
  const endAt = parseAdminDateTimeInput(form.endAt)
  if (Number.isNaN(startAt.getTime())) errors.startAt = 'Thời gian bắt đầu không hợp lệ.'
  if (Number.isNaN(endAt.getTime()) || (!errors.startAt && endAt <= startAt)) errors.endAt = 'Thời gian kết thúc phải sau thời gian bắt đầu.'
  if (!form.couponIds.length) errors.couponIds = 'Chọn ít nhất một voucher.'
  const minimum = form.allowCouponStacking ? 2 : 1
  if (!Number.isInteger(form.maxCouponsPerOrder) || form.maxCouponsPerOrder < minimum || form.maxCouponsPerOrder > 3) errors.maxCouponsPerOrder = `Giá trị phải từ ${minimum} đến 3.`
  return errors
}

export function CampaignAnalyticsPanel({ currentUser }: Props) {
  const { showToast } = useToast()
  const [campaigns, setCampaigns] = useState<PromotionCampaign[]>([])
  const [coupons, setCoupons] = useState<AdminCoupon[]>([])
  const [analytics, setAnalytics] = useState<PromotionAnalytics | null>(null)
  const [form, setForm] = useState<PromotionCampaignPayload>(createInitialForm)
  const [editingCampaign, setEditingCampaign] = useState<PromotionCampaign | null>(null)
  const [deleteCandidate, setDeleteCandidate] = useState<PromotionCampaign | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [couponSearch, setCouponSearch] = useState('')
  const [couponStatus, setCouponStatus] = useState<'all' | 'active' | 'expired'>('active')
  const [couponDiscountType, setCouponDiscountType] = useState<'all' | AdminCoupon['discountType']>('all')
  const [formError, setFormError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)
  const [formBaseline, setFormBaseline] = useState('')
  const [discardRequested, setDiscardRequested] = useState(false)
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [analyticsFrom, setAnalyticsFrom] = useState(() => toDateInput(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)))
  const [analyticsTo, setAnalyticsTo] = useState(() => toDateInput(new Date()))
  const [filterNow] = useState(() => Date.now())
  const canManage = currentUser.role === 'admin' || currentUser.permissions?.includes('promotions.write') === true
  const deleteDialogRef = useDialogAccessibility(Boolean(deleteCandidate), () => setDeleteCandidate(null), !loading)
  const discardDialogRef = useDialogAccessibility(discardRequested, () => setDiscardRequested(false), !loading)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [campaignData, couponData, analyticsData] = await Promise.all([
        listPromotionCampaigns(),
        listCoupons({ page: 1, limit: 100, sort: 'code_asc' }),
        getPromotionAnalytics(analyticsFrom, analyticsTo),
      ])
      setCampaigns(campaignData)
      setCoupons(couponData.items)
      setAnalytics(analyticsData)
    } catch (error) {
      setNotice(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [analyticsFrom, analyticsTo])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!notice) return
    showToast(notice, notice.startsWith('Đã') ? 'success' : 'error')
    const handle = window.setTimeout(() => setNotice(null), 5000)
    return () => window.clearTimeout(handle)
  }, [notice, showToast])

  useEffect(() => {
    if (!showForm || editingCampaign) return
    const handle = window.setTimeout(() => window.localStorage.setItem(campaignDraftKey, JSON.stringify(form)), 400)
    return () => window.clearTimeout(handle)
  }, [editingCampaign, form, showForm])

  const filteredCoupons = useMemo(() => {
    const query = couponSearch.trim().toLocaleLowerCase('vi')
    return coupons.filter((coupon) => {
      const isActive = coupon.isActive && new Date(coupon.startAt).getTime() <= filterNow && new Date(coupon.endAt).getTime() >= filterNow
      const isExpired = new Date(coupon.endAt).getTime() < filterNow
      if (couponStatus === 'active' && !isActive) return false
      if (couponStatus === 'expired' && !isExpired) return false
      if (couponDiscountType !== 'all' && coupon.discountType !== couponDiscountType) return false
      return !query || `${coupon.code} ${coupon.name}`.toLocaleLowerCase('vi').includes(query)
    })
  }, [couponDiscountType, couponSearch, couponStatus, coupons, filterNow])
  const formErrors = useMemo(() => validateCampaignForm(form), [form])
  const campaignWarnings = useMemo(() => {
    const selected = coupons.filter((coupon) => form.couponIds.includes(coupon._id))
    const warnings: string[] = []
    for (let leftIndex = 0; leftIndex < selected.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < selected.length; rightIndex += 1) {
        const left = selected[leftIndex]
        const right = selected[rightIndex]
        const sharedAudience = left.eligibleUserTypes.some((type) => right.eligibleUserTypes.includes(type))
        const overlaps = new Date(left.startAt) <= new Date(right.endAt) && new Date(right.startAt) <= new Date(left.endAt)
        if (sharedAudience && overlaps) warnings.push(`${left.code} và ${right.code} trùng thời gian và đối tượng; dùng chung có thể giảm quá sâu.`)
        else if (sharedAudience) warnings.push(`${left.code} và ${right.code} cùng nhóm khách mục tiêu.`)
        else if (overlaps) warnings.push(`${left.code} và ${right.code} có thời gian hiệu lực chồng nhau.`)
      }
    }
    return warnings.slice(0, 4)
  }, [coupons, form.couponIds])

  const toggleCoupon = (couponId: string) => {
    setForm((current) => ({
      ...current,
      couponIds: current.couponIds.includes(couponId)
        ? current.couponIds.filter((id) => id !== couponId)
        : [...current.couponIds, couponId],
    }))
  }

  const openCreateForm = () => {
    let nextForm = createInitialForm()
    const rawDraft = window.localStorage.getItem(campaignDraftKey)
    if (rawDraft) {
      try { nextForm = { ...nextForm, ...(JSON.parse(rawDraft) as Partial<PromotionCampaignPayload>) } } catch { window.localStorage.removeItem(campaignDraftKey) }
    }
    setEditingCampaign(null)
    setForm(nextForm)
    setFormBaseline(JSON.stringify(nextForm))
    setFormError(null)
    setSubmitAttempted(false)
    setShowForm(true)
  }

  const openEditForm = (campaign: PromotionCampaign) => {
    setEditingCampaign(campaign)
    const nextForm = toCampaignForm(campaign)
    setForm(nextForm)
    setFormBaseline(JSON.stringify(nextForm))
    setFormError(null)
    setSubmitAttempted(false)
    setShowForm(true)
  }

  const closeForm = (force = false) => {
    if (!force && JSON.stringify(form) !== formBaseline) {
      setDiscardRequested(true)
      return
    }
    setShowForm(false)
    setEditingCampaign(null)
    setFormError(null)
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitAttempted(true)
    const startAt = parseAdminDateTimeInput(form.startAt)
    const endAt = parseAdminDateTimeInput(form.endAt)
    if (Object.keys(formErrors).length) {
      setFormError('Kiểm tra lại các trường được đánh dấu.')
      return
    }

    setLoading(true)
    setNotice(null)
    setFormError(null)
    try {
      const payload = {
        ...form,
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        description: form.description?.trim() || null,
        maxCouponsPerOrder: form.allowCouponStacking ? form.maxCouponsPerOrder : 1,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
      }
      if (editingCampaign) {
        await updatePromotionCampaign(editingCampaign._id, payload)
      } else {
        await createPromotionCampaign(payload)
      }
      window.localStorage.removeItem(campaignDraftKey)
      closeForm(true)
      setNotice(editingCampaign ? 'Đã cập nhật chiến dịch' : 'Đã tạo chiến dịch')
      await load()
    } catch (error) {
      setFormError(getErrorMessage(error))
      setLoading(false)
    }
  }

  const toggleStatus = async (campaign: PromotionCampaign) => {
    setLoading(true)
    try {
      await updatePromotionCampaign(campaign._id, { isActive: !campaign.isActive })
      await load()
    } catch (error) {
      setNotice(getErrorMessage(error))
      setLoading(false)
    }
  }

  const remove = async () => {
    if (!deleteCandidate) return
    setLoading(true)
    try {
      await deletePromotionCampaign(deleteCandidate._id)
      setDeleteCandidate(null)
      setNotice('Đã xóa chiến dịch')
      await load()
    } catch (error) {
      setNotice(getErrorMessage(error))
      setLoading(false)
    }
  }

  return (
    <section className="admin-growth-panel">
      <div className="admin-section-heading">
        <div><p>Chiến dịch & phân tích</p><h2>Hiệu quả khuyến mãi</h2></div>
        <button className="admin-secondary-button admin-campaign-create-button" type="button" disabled={!canManage || loading} onClick={() => showForm ? closeForm() : openCreateForm()}>
          {showForm ? 'Đóng form' : 'Tạo chiến dịch'}
        </button>
      </div>

      <div className="admin-analytics-range">
        <span>Dữ liệu {formatRange(analytics)}</span>
        <label>Từ <input type="date" value={analyticsFrom} max={analyticsTo} onChange={(event) => setAnalyticsFrom(event.target.value)} /></label>
        <label>Đến <input type="date" value={analyticsTo} min={analyticsFrom} max={toDateInput(new Date())} onChange={(event) => setAnalyticsTo(event.target.value)} /></label>
      </div>
      <div className="admin-growth-metrics">
        <div><span>Đơn hàng</span><strong>{analytics?.orders.orderCount ?? 0}</strong><small>{formatChange(analytics?.comparison.orderCountPercent)} kỳ trước</small></div>
        <div><span>Doanh thu ròng</span><strong>{formatCurrency(analytics?.orders.netRevenue)}</strong><small>{formatChange(analytics?.comparison.netRevenuePercent)} kỳ trước</small></div>
        <div><span>Lượt dùng voucher</span><strong>{analytics?.coupons.usageCount ?? 0}</strong><small>{formatChange(analytics?.comparison.couponUsagePercent)} kỳ trước</small></div>
        <div><span>Tổng ưu đãi</span><strong>{formatCurrency(analytics?.coupons.totalDiscount)}</strong><small>{formatChange(analytics?.comparison.totalDiscountPercent)} kỳ trước</small></div>
      </div>

      {analytics?.coupons.topCoupons.length ? (
        <div className="admin-top-coupons">
          <strong>Top voucher</strong>
          {analytics.coupons.topCoupons.slice(0, 5).map((coupon) => (
            <div key={coupon.code}><span>{coupon.code}</span><b>{coupon.usageCount} lượt</b><small>{formatCurrency(coupon.totalDiscount)}</small></div>
          ))}
        </div>
      ) : null}

      {analytics && (analytics.campaigns.length > 0 || analytics.loyalty.length > 0) ? (
        <div className="admin-analytics-charts">
          <section>
            <strong>Doanh thu theo chiến dịch</strong>
            {analytics.campaigns.length ? analytics.campaigns.slice(0, 5).map((campaign) => {
              const maximum = Math.max(...analytics.campaigns.map((item) => item.netRevenue), 1)
              const width = Math.max(4, Math.round((campaign.netRevenue / maximum) * 100))
              return <div className="admin-analytics-bar" key={campaign.campaignId}><span>{campaign.code || campaign.name || 'Chiến dịch'}</span><i><b style={{ width: `${width}%` }} /></i><small>{formatCurrency(campaign.netRevenue)}</small></div>
            }) : <p>Chưa có doanh thu theo chiến dịch.</p>}
          </section>
          <section>
            <strong>Giao dịch điểm</strong>
            {analytics.loyalty.map((item) => {
              const maximum = Math.max(...analytics.loyalty.map((entry) => entry.transactionCount), 1)
              const width = Math.max(4, Math.round((item.transactionCount / maximum) * 100))
              const label = item.type === 'earn' ? 'Cộng điểm' : item.type === 'redeem' ? 'Đổi điểm' : 'Điều chỉnh'
              return <div className="admin-analytics-bar" key={item.type}><span>{label}</span><i><b style={{ width: `${width}%` }} /></i><small>{item.transactionCount} giao dịch</small></div>
            })}
          </section>
        </div>
      ) : null}

      {showForm ? (
        <form className="admin-campaign-form" onSubmit={submit}>
          <header className="admin-campaign-form-heading"><strong>{editingCampaign ? 'Sửa chiến dịch' : 'Chiến dịch mới'}</strong><span>{form.couponIds.length} voucher đã chọn</span></header>
          {formError ? <p className="admin-form-error admin-campaign-form-error" role="alert">{formError}</p> : null}
          <label><span>Mã chiến dịch</span><input className={(submitAttempted || form.code.length > 0) && formErrors.code ? 'is-invalid' : ''} value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} required pattern="[A-Z0-9_-]{2,40}" />{(submitAttempted || form.code.length > 0) && formErrors.code ? <small className="admin-field-error">{formErrors.code}</small> : null}</label>
          <label><span>Tên chiến dịch</span><input className={(submitAttempted || form.name.length > 0) && formErrors.name ? 'is-invalid' : ''} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required minLength={2} />{(submitAttempted || form.name.length > 0) && formErrors.name ? <small className="admin-field-error">{formErrors.name}</small> : null}</label>
          <label><span>Bắt đầu (giờ VN)</span><input className={formErrors.startAt ? 'is-invalid' : ''} type="datetime-local" value={form.startAt} onChange={(event) => setForm({ ...form, startAt: event.target.value })} required />{formErrors.startAt ? <small className="admin-field-error">{formErrors.startAt}</small> : null}</label>
          <label><span>Kết thúc (giờ VN)</span><input className={formErrors.endAt ? 'is-invalid' : ''} type="datetime-local" value={form.endAt} min={form.startAt} onChange={(event) => setForm({ ...form, endAt: event.target.value })} required />{formErrors.endAt ? <small className="admin-field-error">{formErrors.endAt}</small> : null}</label>
          <label><span>Cho phép dùng nhiều voucher</span><input type="checkbox" checked={form.allowCouponStacking} onChange={(event) => setForm({ ...form, allowCouponStacking: event.target.checked, maxCouponsPerOrder: event.target.checked ? 2 : 1 })} /></label>
          <label><span>Tối đa voucher/đơn</span><input className={formErrors.maxCouponsPerOrder ? 'is-invalid' : ''} type="number" min={form.allowCouponStacking ? 2 : 1} max={3} disabled={!form.allowCouponStacking} value={form.maxCouponsPerOrder} onChange={(event) => setForm({ ...form, maxCouponsPerOrder: Number(event.target.value) })} /><small>Tối đa N voucher/đơn nghĩa là khách chỉ được áp N voucher trong số đã chọn.</small>{formErrors.maxCouponsPerOrder ? <small className="admin-field-error">{formErrors.maxCouponsPerOrder}</small> : null}</label>
          <fieldset>
            <legend>Voucher trong chiến dịch</legend>
            <div className="admin-campaign-coupon-toolbar">
              <input type="search" value={couponSearch} onChange={(event) => setCouponSearch(event.target.value)} placeholder="Tìm mã hoặc tên voucher" />
              <select value={couponStatus} onChange={(event) => setCouponStatus(event.target.value as typeof couponStatus)}><option value="active">Đang chạy</option><option value="expired">Hết hạn</option><option value="all">Tất cả trạng thái</option></select>
              <select value={couponDiscountType} onChange={(event) => setCouponDiscountType(event.target.value as typeof couponDiscountType)}><option value="all">Tất cả loại giảm</option><option value="percent">Phần trăm</option><option value="fixed">Số tiền</option><option value="free_shipping">Miễn phí vận chuyển</option></select>
            </div>
            <div className="admin-campaign-coupon-list">
              {filteredCoupons.map((coupon) => <label key={coupon._id}><input type="checkbox" checked={form.couponIds.includes(coupon._id)} onChange={() => toggleCoupon(coupon._id)} /> <span>{coupon.code}<small>{coupon.name}</small></span></label>)}
            </div>
            {formErrors.couponIds ? <small className="admin-field-error">{formErrors.couponIds}</small> : null}
            {campaignWarnings.map((warning) => <p className="admin-smart-warning" key={warning}>{warning}</p>)}
          </fieldset>
          <div className="admin-campaign-form-actions">
            <button className="admin-secondary-button" type="button" onClick={() => closeForm()}>Hủy</button>
            <button className="admin-primary-button" type="submit" disabled={loading || Object.keys(formErrors).length > 0}>{editingCampaign ? 'Lưu thay đổi' : 'Tạo chiến dịch'}</button>
          </div>
        </form>
      ) : null}

      <div className="admin-campaign-list">
        {campaigns.length ? campaigns.map((campaign) => (
          <article key={campaign._id}>
            <div><strong>{campaign.code} · {campaign.name}</strong><span>{campaign.couponIds.length} voucher · {campaign.allowCouponStacking ? `tối đa ${campaign.maxCouponsPerOrder} voucher/đơn` : 'mỗi đơn 1 voucher'}</span></div>
            <span className={`admin-status-pill ${campaign.isActive ? 'is-active' : 'is-blocked'}`}>{campaign.isActive ? 'Đang bật' : 'Tạm tắt'}</span>
            <button className="admin-link-button" type="button" disabled={!canManage || loading} onClick={() => openEditForm(campaign)}>Sửa</button>
            <button className="admin-link-button" type="button" disabled={!canManage || loading} onClick={() => void toggleStatus(campaign)}>{campaign.isActive ? 'Tắt' : 'Bật'}</button>
            <button className="admin-danger-link" type="button" disabled={!canManage || loading} onClick={() => setDeleteCandidate(campaign)}>Xóa</button>
          </article>
        )) : <p>{loading ? 'Đang tải chiến dịch...' : 'Chưa có chiến dịch.'}</p>}
      </div>

      {deleteCandidate ? (
        <div ref={deleteDialogRef} tabIndex={-1} className="admin-confirm-layer" role="dialog" aria-modal="true" aria-labelledby="campaign-delete-title">
          <div className="admin-confirm-box">
            <h2 id="campaign-delete-title">Xóa chiến dịch?</h2>
            <p>Chiến dịch {deleteCandidate.code} sẽ bị xóa. Voucher bên trong vẫn được giữ nguyên.</p>
            <div className="admin-dialog-actions">
              <button className="admin-secondary-button" type="button" disabled={loading} onClick={() => setDeleteCandidate(null)}>Hủy</button>
              <button className="admin-danger-button" type="button" disabled={loading} onClick={() => void remove()}>{loading ? 'Đang xóa...' : 'Xóa chiến dịch'}</button>
            </div>
          </div>
        </div>
      ) : null}

      {discardRequested ? (
        <div ref={discardDialogRef} tabIndex={-1} className="admin-confirm-layer" role="dialog" aria-modal="true" aria-labelledby="campaign-discard-title">
          <div className="admin-confirm-box">
            <h2 id="campaign-discard-title">Bỏ thay đổi chưa lưu?</h2>
            <p>Nội dung đang nhập sẽ được giữ trong bản nháp nếu đây là chiến dịch mới.</p>
            <div className="admin-dialog-actions">
              <button className="admin-secondary-button" type="button" onClick={() => setDiscardRequested(false)}>Tiếp tục chỉnh</button>
              <button className="admin-danger-button" type="button" onClick={() => { setDiscardRequested(false); closeForm(true) }}>Bỏ thay đổi</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
