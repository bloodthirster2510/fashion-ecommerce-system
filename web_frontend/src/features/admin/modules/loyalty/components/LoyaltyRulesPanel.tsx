import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useDialogAccessibility } from '../../../hooks/useDialogAccessibility'
import type { AdminUser } from '../../auth/adminSession'
import {
  createLoyaltyRule,
  deleteLoyaltyRule,
  listLoyaltyRules,
  updateLoyaltyRule,
} from '../loyalty.service'
import type { LoyaltyRule, LoyaltyRulePayload } from '../loyalty.types'
import { useToast } from '../../../notifications/notification-context'
import { AdminEmptyIllustration } from '../../../components/AdminEmptyIllustration'

type Props = { currentUser: AdminUser }
type RuleFieldErrors = Partial<Record<'name' | 'spendAmount' | 'pointsEarned' | 'minOrderAmount', string>>
const loyaltyRuleDraftKey = 'fashionista.admin.loyalty-rule-draft'

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

const toRuleForm = (rule: LoyaltyRule): LoyaltyRulePayload => ({
  name: rule.name,
  spendAmount: rule.spendAmount,
  pointsEarned: rule.pointsEarned,
  minOrderAmount: rule.minOrderAmount,
  roundMode: rule.roundMode,
  startAt: rule.startAt ?? null,
  endAt: rule.endAt ?? null,
  isActive: rule.isActive,
})

const formatNumber = (value: number) => new Intl.NumberFormat('vi-VN').format(value)
const getError = (error: unknown) => error instanceof Error ? error.message : 'Không thể xử lý quy tắc điểm'
const roundModeLabels: Record<LoyaltyRulePayload['roundMode'], string> = {
  floor: 'Làm tròn xuống',
  round: 'Làm tròn gần nhất',
  ceil: 'Làm tròn lên',
}

export function LoyaltyRulesPanel({ currentUser }: Props) {
  const { showToast } = useToast()
  const [rules, setRules] = useState<LoyaltyRule[]>([])
  const [form, setForm] = useState<LoyaltyRulePayload>(initialForm)
  const [editingRule, setEditingRule] = useState<LoyaltyRule | null>(null)
  const [deleteCandidate, setDeleteCandidate] = useState<LoyaltyRule | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)
  const [formBaseline, setFormBaseline] = useState('')
  const [discardRequested, setDiscardRequested] = useState(false)
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const canManage = currentUser.role === 'admin' || currentUser.permissions?.includes('loyalty.write') === true
  const deleteDialogRef = useDialogAccessibility(Boolean(deleteCandidate), () => setDeleteCandidate(null), !loading)
  const discardDialogRef = useDialogAccessibility(discardRequested, () => setDiscardRequested(false), !loading)

  const load = useCallback(async () => {
    setLoading(true)
    try { setRules(await listLoyaltyRules()) }
    catch (error) { setNotice(getError(error)) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!notice) return
    showToast(notice, notice.startsWith('Đã') ? 'success' : 'error')
    const handle = window.setTimeout(() => setNotice(null), 5000)
    return () => window.clearTimeout(handle)
  }, [notice, showToast])
  useEffect(() => {
    if (!showForm || editingRule) return
    const handle = window.setTimeout(() => window.localStorage.setItem(loyaltyRuleDraftKey, JSON.stringify(form)), 400)
    return () => window.clearTimeout(handle)
  }, [editingRule, form, showForm])

  const examplePoints = useMemo(() => {
    if (form.spendAmount <= 0 || form.pointsEarned <= 0) return 0
    const units = 500_000 / form.spendAmount
    const roundedUnits = form.roundMode === 'ceil' ? Math.ceil(units) : form.roundMode === 'round' ? Math.round(units) : Math.floor(units)
    return roundedUnits * form.pointsEarned
  }, [form.pointsEarned, form.roundMode, form.spendAmount])
  const ruleErrors = useMemo(() => {
    const errors: RuleFieldErrors = {}
    if (form.name.trim().length < 2) errors.name = 'Tên cần ít nhất 2 ký tự.'
    if (!Number.isFinite(form.spendAmount) || form.spendAmount < 1) errors.spendAmount = 'Số tiền phải từ 1₫.'
    if (!Number.isFinite(form.pointsEarned) || form.pointsEarned < 1) errors.pointsEarned = 'Số điểm phải từ 1.'
    if (!Number.isFinite(form.minOrderAmount) || form.minOrderAmount < 0) errors.minOrderAmount = 'Đơn tối thiểu không được âm.'
    return errors
  }, [form])

  const openCreateForm = () => {
    let nextForm = initialForm
    const draft = window.localStorage.getItem(loyaltyRuleDraftKey)
    if (draft) {
      try { nextForm = { ...initialForm, ...(JSON.parse(draft) as Partial<LoyaltyRulePayload>) } } catch { window.localStorage.removeItem(loyaltyRuleDraftKey) }
    }
    setEditingRule(null)
    setForm(nextForm)
    setFormBaseline(JSON.stringify(nextForm))
    setShowForm(true)
    setSubmitAttempted(false)
    setNotice(null)
  }

  const openEditForm = (rule: LoyaltyRule) => {
    setEditingRule(rule)
    const nextForm = toRuleForm(rule)
    setForm(nextForm)
    setFormBaseline(JSON.stringify(nextForm))
    setShowForm(true)
    setSubmitAttempted(false)
    setNotice(null)
  }

  const closeForm = (force = false) => {
    if (!force && JSON.stringify(form) !== formBaseline) {
      setDiscardRequested(true)
      return
    }
    setShowForm(false)
    setEditingRule(null)
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitAttempted(true)
    if (Object.keys(ruleErrors).length) {
      setNotice('Kiểm tra lại các trường được đánh dấu')
      return
    }
    setLoading(true)
    setNotice(null)
    try {
      if (editingRule) {
        await updateLoyaltyRule(editingRule._id, form)
      } else {
        await createLoyaltyRule(form)
      }
      window.localStorage.removeItem(loyaltyRuleDraftKey)
      closeForm(true)
      setNotice(editingRule ? 'Đã cập nhật quy tắc tích điểm' : 'Đã tạo quy tắc tích điểm')
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

  const remove = async () => {
    if (!deleteCandidate) return
    setLoading(true)
    try {
      await deleteLoyaltyRule(deleteCandidate._id)
      setDeleteCandidate(null)
      setNotice('Đã xóa quy tắc tích điểm')
      await load()
    } catch (error) {
      setNotice(getError(error))
      setLoading(false)
    }
  }

  return (
    <section className="admin-loyalty-rules">
      <div className="admin-section-heading">
        <div><p>Quy tắc điểm</p><h2>Cấu hình cách tích điểm</h2></div>
        <button className="admin-secondary-button" type="button" disabled={!canManage || loading} onClick={() => showForm ? closeForm() : openCreateForm()}>
          {showForm ? 'Đóng form' : 'Thêm quy tắc'}
        </button>
      </div>
      {showForm ? (
        <form className="admin-loyalty-rule-form" onSubmit={submit}>
          <header className="admin-rule-form-heading"><strong>{editingRule ? 'Sửa quy tắc' : 'Quy tắc mới'}</strong><span>Mỗi {formatNumber(form.spendAmount || 0)}₫ → {formatNumber(form.pointsEarned || 0)} điểm · đơn 500.000₫ → khoảng {formatNumber(examplePoints)} điểm</span></header>
          {form.spendAmount > 0 && form.spendAmount < 500 ? <p className="admin-smart-warning">Tỉ lệ này cho điểm rất nhanh; hãy kiểm tra lại chi phí đổi điểm.</p> : null}
          <label><span>Tên quy tắc</span><input className={(submitAttempted || form.name.length > 0) && ruleErrors.name ? 'is-invalid' : ''} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} minLength={2} required />{(submitAttempted || form.name.length > 0) && ruleErrors.name ? <small className="admin-field-error">{ruleErrors.name}</small> : null}</label>
          <label><span>Mỗi số tiền</span><input className={ruleErrors.spendAmount ? 'is-invalid' : ''} type="number" min={1} value={form.spendAmount} onChange={(event) => setForm({ ...form, spendAmount: Number(event.target.value) })} required />{ruleErrors.spendAmount ? <small className="admin-field-error">{ruleErrors.spendAmount}</small> : null}</label>
          <label><span>Nhận số điểm</span><input className={ruleErrors.pointsEarned ? 'is-invalid' : ''} type="number" min={1} value={form.pointsEarned} onChange={(event) => setForm({ ...form, pointsEarned: Number(event.target.value) })} required />{ruleErrors.pointsEarned ? <small className="admin-field-error">{ruleErrors.pointsEarned}</small> : null}</label>
          <label><span>Đơn tối thiểu</span><input className={ruleErrors.minOrderAmount ? 'is-invalid' : ''} type="number" min={0} value={form.minOrderAmount} onChange={(event) => setForm({ ...form, minOrderAmount: Number(event.target.value) })} required />{ruleErrors.minOrderAmount ? <small className="admin-field-error">{ruleErrors.minOrderAmount}</small> : null}</label>
          <label><span>Làm tròn</span><select value={form.roundMode} onChange={(event) => setForm({ ...form, roundMode: event.target.value as LoyaltyRulePayload['roundMode'] })}><option value="floor">Xuống (1,9 → 1)</option><option value="round">Gần nhất (1,5 → 2)</option><option value="ceil">Lên (1,1 → 2)</option></select></label>
          <div className="admin-rule-form-actions"><button className="admin-secondary-button" type="button" onClick={() => closeForm()}>Hủy</button><button className="admin-primary-button" type="submit" disabled={loading || Object.keys(ruleErrors).length > 0}>{editingRule ? 'Lưu thay đổi' : 'Lưu quy tắc'}</button></div>
        </form>
      ) : null}
      <div className="admin-loyalty-rule-list">
        {rules.length ? rules.map((rule) => (
          <article key={rule._id}>
            <div><strong>{rule.name}</strong><span>{formatNumber(rule.spendAmount)}₫ = {formatNumber(rule.pointsEarned)} điểm · đơn từ {formatNumber(rule.minOrderAmount)}₫ · {roundModeLabels[rule.roundMode]}</span></div>
            <span className={`admin-status-pill ${rule.isActive ? 'is-active' : 'is-blocked'}`}>{rule.isActive ? 'Đang áp dụng' : 'Tạm tắt'}</span>
            <button className="admin-link-button" type="button" disabled={!canManage || loading} onClick={() => openEditForm(rule)}>Sửa</button>
            <button className="admin-link-button" type="button" disabled={!canManage || loading} onClick={() => void toggle(rule)}>{rule.isActive ? 'Tắt' : 'Kích hoạt'}</button>
            <button className="admin-danger-link" type="button" disabled={!canManage || loading} onClick={() => setDeleteCandidate(rule)}>Xóa</button>
          </article>
        )) : loading ? <p>Đang tải quy tắc...</p> : <div className="admin-loyalty-empty-state"><AdminEmptyIllustration variant="rule" /><strong>Chưa có quy tắc tùy chỉnh</strong><span>Hệ thống đang dùng mặc định 1 điểm / 1.000₫.</span></div>}
      </div>

      {deleteCandidate ? (
        <div ref={deleteDialogRef} tabIndex={-1} className="admin-confirm-layer" role="dialog" aria-modal="true" aria-labelledby="loyalty-rule-delete-title">
          <div className="admin-confirm-box">
            <h2 id="loyalty-rule-delete-title">Xóa quy tắc tích điểm?</h2>
            <p>Quy tắc “{deleteCandidate.name}” sẽ bị xóa. Lịch sử điểm đã phát sinh không thay đổi.</p>
            <div className="admin-dialog-actions">
              <button className="admin-secondary-button" type="button" disabled={loading} onClick={() => setDeleteCandidate(null)}>Hủy</button>
              <button className="admin-danger-button" type="button" disabled={loading} onClick={() => void remove()}>{loading ? 'Đang xóa...' : 'Xóa quy tắc'}</button>
            </div>
          </div>
        </div>
      ) : null}
      {discardRequested ? (
        <div ref={discardDialogRef} tabIndex={-1} className="admin-confirm-layer" role="dialog" aria-modal="true" aria-labelledby="loyalty-rule-discard-title">
          <div className="admin-confirm-box"><h2 id="loyalty-rule-discard-title">Bỏ thay đổi chưa lưu?</h2><p>Bản nháp quy tắc mới vẫn được giữ để khôi phục lần sau.</p><div className="admin-dialog-actions"><button className="admin-secondary-button" type="button" onClick={() => setDiscardRequested(false)}>Tiếp tục chỉnh</button><button className="admin-danger-button" type="button" onClick={() => { setDiscardRequested(false); closeForm(true) }}>Bỏ thay đổi</button></div></div>
        </div>
      ) : null}
    </section>
  )
}
