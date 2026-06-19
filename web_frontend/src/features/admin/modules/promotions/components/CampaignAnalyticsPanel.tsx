import { useCallback, useEffect, useState, type FormEvent } from 'react'
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

type Props = { currentUser: AdminUser }

const toDateTimeInput = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

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

const formatCurrency = (value = 0) => new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
}).format(value)

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : 'Không thể xử lý yêu cầu'

export function CampaignAnalyticsPanel({ currentUser }: Props) {
  const [campaigns, setCampaigns] = useState<PromotionCampaign[]>([])
  const [coupons, setCoupons] = useState<AdminCoupon[]>([])
  const [analytics, setAnalytics] = useState<PromotionAnalytics | null>(null)
  const [form, setForm] = useState<PromotionCampaignPayload>(createInitialForm)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)
  const canManage = currentUser.role === 'admin' || currentUser.permissions?.includes('promotions.write') === true

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [campaignData, couponData, analyticsData] = await Promise.all([
        listPromotionCampaigns(),
        listCoupons({ page: 1, limit: 100, sort: 'code_asc' }),
        getPromotionAnalytics(),
      ])
      setCampaigns(campaignData)
      setCoupons(couponData.items)
      setAnalytics(analyticsData)
    } catch (error) {
      setNotice(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const toggleCoupon = (couponId: string) => {
    setForm((current) => ({
      ...current,
      couponIds: current.couponIds.includes(couponId)
        ? current.couponIds.filter((id) => id !== couponId)
        : [...current.couponIds, couponId],
    }))
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setNotice(null)
    try {
      if (form.couponIds.length < 1) throw new Error('Chọn ít nhất một voucher cho chiến dịch')
      await createPromotionCampaign({
        ...form,
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        maxCouponsPerOrder: form.allowCouponStacking ? form.maxCouponsPerOrder : 1,
        startAt: new Date(form.startAt).toISOString(),
        endAt: new Date(form.endAt).toISOString(),
      })
      setForm(createInitialForm())
      setShowForm(false)
      setNotice('Đã tạo chiến dịch')
      await load()
    } catch (error) {
      setNotice(getErrorMessage(error))
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

  const remove = async (campaign: PromotionCampaign) => {
    if (!window.confirm(`Xóa chiến dịch ${campaign.code}?`)) return
    setLoading(true)
    try {
      await deletePromotionCampaign(campaign._id)
      await load()
    } catch (error) {
      setNotice(getErrorMessage(error))
      setLoading(false)
    }
  }

  return (
    <section className="admin-growth-panel">
      <div className="admin-section-heading">
        <div><p>Campaign & analytics</p><h2>Hiệu quả khuyến mãi</h2></div>
        <button className="admin-secondary-button" type="button" disabled={!canManage || loading} onClick={() => setShowForm((value) => !value)}>
          {showForm ? 'Đóng form' : 'Tạo chiến dịch'}
        </button>
      </div>

      {notice ? <p className="admin-notice" role="status">{notice}</p> : null}
      <div className="admin-growth-metrics">
        <div><span>Đơn hàng 30 ngày</span><strong>{analytics?.orders.orderCount ?? 0}</strong></div>
        <div><span>Doanh thu ròng</span><strong>{formatCurrency(analytics?.orders.netRevenue)}</strong></div>
        <div><span>Lượt dùng voucher</span><strong>{analytics?.coupons.usageCount ?? 0}</strong></div>
        <div><span>Tổng ưu đãi</span><strong>{formatCurrency(analytics?.coupons.totalDiscount)}</strong></div>
      </div>

      {showForm ? (
        <form className="admin-campaign-form" onSubmit={submit}>
          <label><span>Mã chiến dịch</span><input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} required pattern="[A-Z0-9_-]{2,40}" /></label>
          <label><span>Tên chiến dịch</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required minLength={2} /></label>
          <label><span>Bắt đầu</span><input type="datetime-local" value={form.startAt} onChange={(event) => setForm({ ...form, startAt: event.target.value })} required /></label>
          <label><span>Kết thúc</span><input type="datetime-local" value={form.endAt} onChange={(event) => setForm({ ...form, endAt: event.target.value })} required /></label>
          <label><span>Cho phép stacking</span><input type="checkbox" checked={form.allowCouponStacking} onChange={(event) => setForm({ ...form, allowCouponStacking: event.target.checked, maxCouponsPerOrder: event.target.checked ? 2 : 1 })} /></label>
          <label><span>Tối đa coupon/đơn</span><input type="number" min={form.allowCouponStacking ? 2 : 1} max={3} disabled={!form.allowCouponStacking} value={form.maxCouponsPerOrder} onChange={(event) => setForm({ ...form, maxCouponsPerOrder: Number(event.target.value) })} /></label>
          <fieldset>
            <legend>Voucher trong chiến dịch</legend>
            <div className="admin-campaign-coupon-list">
              {coupons.map((coupon) => <label key={coupon._id}><input type="checkbox" checked={form.couponIds.includes(coupon._id)} onChange={() => toggleCoupon(coupon._id)} /> <span>{coupon.code}</span></label>)}
            </div>
          </fieldset>
          <button className="admin-primary-button" type="submit" disabled={loading}>Lưu chiến dịch</button>
        </form>
      ) : null}

      <div className="admin-campaign-list">
        {campaigns.length ? campaigns.map((campaign) => (
          <article key={campaign._id}>
            <div><strong>{campaign.code} · {campaign.name}</strong><span>{campaign.couponIds.length} voucher · {campaign.allowCouponStacking ? `stack tối đa ${campaign.maxCouponsPerOrder}` : 'không stack'}</span></div>
            <span className={`admin-status-pill ${campaign.isActive ? 'is-active' : 'is-blocked'}`}>{campaign.isActive ? 'Đang bật' : 'Tạm tắt'}</span>
            <button className="admin-link-button" type="button" disabled={!canManage || loading} onClick={() => void toggleStatus(campaign)}>{campaign.isActive ? 'Tắt' : 'Bật'}</button>
            <button className="admin-danger-link" type="button" disabled={!canManage || loading} onClick={() => void remove(campaign)}>Xóa</button>
          </article>
        )) : <p>{loading ? 'Đang tải chiến dịch...' : 'Chưa có chiến dịch.'}</p>}
      </div>
    </section>
  )
}
