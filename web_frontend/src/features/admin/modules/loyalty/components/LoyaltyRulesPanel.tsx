import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { AdminUser } from '../../auth/adminSession'
import {
  createLoyaltyRule,
  deleteLoyaltyRule,
  listLoyaltyRules,
  updateLoyaltyRule,
} from '../loyalty.service'
import type { LoyaltyRule, LoyaltyRulePayload } from '../loyalty.types'

type Props = { currentUser: AdminUser }

const initialForm: LoyaltyRulePayload = {
  name: 'Quy tắc tích điểm tiêu chuẩn',
  spendAmount: 1000,
  pointsEarned: 1,
  minOrderAmount: 0,
  roundMode: 'floor',
  startAt: null,
  endAt: null,
  isActive: true,
}

const formatNumber = (value: number) => new Intl.NumberFormat('vi-VN').format(value)
const getError = (error: unknown) => error instanceof Error ? error.message : 'Không thể xử lý quy tắc điểm'

export function LoyaltyRulesPanel({ currentUser }: Props) {
  const [rules, setRules] = useState<LoyaltyRule[]>([])
  const [form, setForm] = useState<LoyaltyRulePayload>(initialForm)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)
  const canManage = currentUser.role === 'admin' || currentUser.permissions?.includes('loyalty.write') === true

  const load = useCallback(async () => {
    setLoading(true)
    try { setRules(await listLoyaltyRules()) }
    catch (error) { setNotice(getError(error)) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setNotice(null)
    try {
      await createLoyaltyRule(form)
      setForm(initialForm)
      setShowForm(false)
      setNotice('Đã tạo quy tắc tích điểm')
      await load()
    } catch (error) {
      setNotice(getError(error))
      setLoading(false)
    }
  }

  const toggle = async (rule: LoyaltyRule) => {
    setLoading(true)
    try {
      await updateLoyaltyRule(rule._id, { isActive: !rule.isActive })
      await load()
    } catch (error) {
      setNotice(getError(error))
      setLoading(false)
    }
  }

  const remove = async (rule: LoyaltyRule) => {
    if (!window.confirm(`Xóa quy tắc ${rule.name}?`)) return
    setLoading(true)
    try {
      await deleteLoyaltyRule(rule._id)
      await load()
    } catch (error) {
      setNotice(getError(error))
      setLoading(false)
    }
  }

  return (
    <section className="admin-loyalty-rules">
      <div className="admin-section-heading">
        <div><p>Rules engine</p><h2>Cấu hình công thức tích điểm</h2></div>
        <button className="admin-secondary-button" type="button" disabled={!canManage || loading} onClick={() => setShowForm((value) => !value)}>
          {showForm ? 'Đóng form' : 'Thêm quy tắc'}
        </button>
      </div>
      {notice ? <p className="admin-notice" role="status">{notice}</p> : null}
      {showForm ? (
        <form className="admin-loyalty-rule-form" onSubmit={submit}>
          <label><span>Tên quy tắc</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} minLength={2} required /></label>
          <label><span>Mỗi số tiền</span><input type="number" min={1} value={form.spendAmount} onChange={(event) => setForm({ ...form, spendAmount: Number(event.target.value) })} required /></label>
          <label><span>Nhận số điểm</span><input type="number" min={1} value={form.pointsEarned} onChange={(event) => setForm({ ...form, pointsEarned: Number(event.target.value) })} required /></label>
          <label><span>Đơn tối thiểu</span><input type="number" min={0} value={form.minOrderAmount} onChange={(event) => setForm({ ...form, minOrderAmount: Number(event.target.value) })} required /></label>
          <label><span>Làm tròn</span><select value={form.roundMode} onChange={(event) => setForm({ ...form, roundMode: event.target.value as LoyaltyRulePayload['roundMode'] })}><option value="floor">Xuống</option><option value="round">Gần nhất</option><option value="ceil">Lên</option></select></label>
          <button className="admin-primary-button" type="submit" disabled={loading}>Lưu quy tắc</button>
        </form>
      ) : null}
      <div className="admin-loyalty-rule-list">
        {rules.length ? rules.map((rule) => (
          <article key={rule._id}>
            <div><strong>{rule.name}</strong><span>{formatNumber(rule.spendAmount)}₫ = {formatNumber(rule.pointsEarned)} điểm · đơn từ {formatNumber(rule.minOrderAmount)}₫ · làm tròn {rule.roundMode}</span></div>
            <span className={`admin-status-pill ${rule.isActive ? 'is-active' : 'is-blocked'}`}>{rule.isActive ? 'Đang áp dụng' : 'Tạm tắt'}</span>
            <button className="admin-link-button" type="button" disabled={!canManage || loading} onClick={() => void toggle(rule)}>{rule.isActive ? 'Tắt' : 'Kích hoạt'}</button>
            <button className="admin-danger-link" type="button" disabled={!canManage || loading} onClick={() => void remove(rule)}>Xóa</button>
          </article>
        )) : <p>{loading ? 'Đang tải quy tắc...' : 'Chưa có quy tắc tùy chỉnh; hệ thống dùng mặc định 1 điểm / 1.000₫.'}</p>}
      </div>
    </section>
  )
}
