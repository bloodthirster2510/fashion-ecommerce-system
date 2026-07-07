import type { Dispatch, FormEvent, RefObject, SetStateAction } from 'react'
import type { MembershipRanking } from '../loyalty.types'

export type TierFormState = {
  name: string
  level: string
  minPoint: string
  maxPoint: string
  discountPercent: string
  benefitDescription: string
  cardColor: string
  textColor: string
  badgeColor: string
  iconName: string
  isActive: boolean
}

export type TierFieldErrors = Partial<Record<keyof TierFormState, string>>

export type TierTemplate = {
  label: string
  values: Partial<TierFormState>
}

type TierPalettePreset = {
  name: string
  card: string
  text: string
  badge: string
}

type TierIconOption = {
  value: string
  label: string
}

type TierFormNeighbors = {
  previous: MembershipRanking | null
  next: MembershipRanking | null
}

type TierDialogProps = {
  mode: 'create' | 'edit'
  dialogRef: RefObject<HTMLDivElement | null>
  form: TierFormState
  errors: TierFieldErrors
  submitAttempted: boolean
  actionLoading: boolean
  notice: { type: 'success' | 'error'; message: string } | null
  draftRestored: boolean
  showAdvancedOptions: boolean
  suggestedMaxPoint: number | null
  contrastRatio: number
  neighbors: TierFormNeighbors
  templates: TierTemplate[]
  palettePresets: TierPalettePreset[]
  iconOptions: TierIconOption[]
  iconSymbols: Record<string, string>
  setForm: Dispatch<SetStateAction<TierFormState>>
  formatNumber: (value: number | null | undefined) => string
  getContrastRatio: (firstColor: string, secondColor: string) => number
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onClose: () => void
  onClearDraft: () => void
  onToggleAdvancedOptions: () => void
}

export function TierDialog({
  mode,
  dialogRef,
  form,
  errors,
  submitAttempted,
  actionLoading,
  notice,
  draftRestored,
  showAdvancedOptions,
  suggestedMaxPoint,
  contrastRatio,
  neighbors,
  templates,
  palettePresets,
  iconOptions,
  iconSymbols,
  setForm,
  formatNumber,
  getContrastRatio,
  onSubmit,
  onClose,
  onClearDraft,
  onToggleAdvancedOptions,
}: TierDialogProps) {
  const shouldShowError = (field: keyof TierFormState) => submitAttempted || form[field].toString().length > 0

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="admin-confirm-layer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-tier-dialog-title"
    >
      <form
        className="admin-account-dialog admin-tier-dialog"
        onSubmit={onSubmit}
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.currentTarget.requestSubmit()
          }
        }}
      >
        <h2 id="admin-tier-dialog-title">
          {mode === 'create' ? 'Thêm hạng thành viên' : 'Sửa hạng thành viên'}
        </h2>

        {notice ? <p className={`admin-notice is-${notice.type}`} role="status">{notice.message}</p> : null}

        <p className="admin-tier-dialog-intro">
          {mode === 'create'
            ? 'Điền vài thông tin chính để tạo hạng mới. Cấp hạng, khoảng điểm tối đa và giao diện thẻ đã được gợi ý sẵn.'
            : 'Chỉnh thông tin vận hành và giao diện của hạng thành viên.'}
        </p>

        {mode === 'create' ? (
          <div className="admin-tier-template-row">
            <span>Mẫu nhanh</span>
            {templates.map((template) => (
              <button
                key={template.label}
                type="button"
                onClick={() => setForm((currentForm) => ({ ...currentForm, ...template.values }))}
              >
                {template.label}
              </button>
            ))}
          </div>
        ) : null}

        {draftRestored ? (
          <div className="admin-tier-draft-notice">
            <span>Đã khôi phục bản nháp gần nhất.</span>
            <button type="button" onClick={onClearDraft}>
              Bỏ bản nháp
            </button>
          </div>
        ) : null}

        <div className="admin-tier-quick-layout">
          <div>
            <h3 className="admin-tier-form-section-title">Thông tin chính</h3>
            <div className="admin-account-form-grid">
              <label>
                <span>Tên hạng</span>
                <input
                  className={shouldShowError('name') && errors.name ? 'is-invalid' : ''}
                  value={form.name}
                  onChange={(event) => setForm((currentForm) => ({ ...currentForm, name: event.target.value }))}
                  required
                  minLength={2}
                  maxLength={30}
                />
                {shouldShowError('name') && errors.name ? <small className="admin-field-error">{errors.name}</small> : null}
              </label>

              <label>
                <span>Điểm tối thiểu</span>
                <input
                  className={shouldShowError('minPoint') && errors.minPoint ? 'is-invalid' : ''}
                  type="number"
                  value={form.minPoint}
                  onChange={(event) => setForm((currentForm) => ({ ...currentForm, minPoint: event.target.value }))}
                  required
                  min={0}
                  max={100000000}
                />
                {shouldShowError('minPoint') && errors.minPoint ? <small className="admin-field-error">{errors.minPoint}</small> : null}
                <small className="admin-field-hint">Mốc điểm để khách bắt đầu thuộc hạng này.</small>
              </label>

              <label>
                <span>Giảm giá (%)</span>
                <input
                  className={shouldShowError('discountPercent') && errors.discountPercent ? 'is-invalid' : ''}
                  type="number"
                  value={form.discountPercent}
                  onChange={(event) => setForm((currentForm) => ({ ...currentForm, discountPercent: event.target.value }))}
                  required
                  min={0}
                  max={100}
                  step={0.1}
                />
                {shouldShowError('discountPercent') && errors.discountPercent ? (
                  <small className="admin-field-error">{errors.discountPercent}</small>
                ) : Number(form.discountPercent) > 15 ? (
                  <small className="admin-field-error">Mức trên 15% có thể ảnh hưởng biên lợi nhuận.</small>
                ) : (
                  <small className="admin-field-hint">Ưu đãi áp dụng cho khách thuộc hạng này.</small>
                )}
              </label>

              <label className="admin-tier-wide-field">
                <span>Quyền lợi</span>
                <textarea
                  className={shouldShowError('benefitDescription') && errors.benefitDescription ? 'is-invalid' : ''}
                  value={form.benefitDescription}
                  onChange={(event) => setForm((currentForm) => ({ ...currentForm, benefitDescription: event.target.value }))}
                  required
                  minLength={2}
                  maxLength={200}
                  rows={3}
                />
                {shouldShowError('benefitDescription') && errors.benefitDescription ? (
                  <small className="admin-field-error">{errors.benefitDescription}</small>
                ) : null}
                <small className="admin-character-count">{form.benefitDescription.length}/200</small>
              </label>
            </div>
          </div>

          <aside className="admin-tier-quick-preview">
            <div className="admin-tier-card-preview" style={{ backgroundColor: form.cardColor, color: form.textColor }}>
              <span style={{ backgroundColor: form.badgeColor }}>
                {iconSymbols[form.iconName] ?? iconSymbols.star}
              </span>
              <div>
                <small>THẺ THÀNH VIÊN</small>
                <strong>{form.name || 'Tên hạng'}</strong>
                <p>Cấp {form.level || '-'} · Giảm {form.discountPercent || 0}%</p>
              </div>
              <em>{form.benefitDescription || 'Quyền lợi của thành viên sẽ hiển thị tại đây.'}</em>
            </div>
            <div className="admin-tier-auto-summary">
              <span>Cấp {form.level || '-'}</span>
              <span>
                {suggestedMaxPoint === null
                  ? 'Không giới hạn điểm tối đa'
                  : `Đến ${formatNumber(suggestedMaxPoint)} điểm`}
              </span>
              <span>{form.isActive ? 'Đang hoạt động' : 'Tạm tắt'}</span>
            </div>
          </aside>
        </div>

        <button
          className="admin-tier-advanced-toggle"
          type="button"
          aria-expanded={showAdvancedOptions}
          onClick={onToggleAdvancedOptions}
        >
          {showAdvancedOptions ? 'Ẩn tùy chỉnh nâng cao' : 'Tùy chỉnh cấp, trạng thái và giao diện thẻ'}
        </button>

        <div className="admin-tier-advanced-panel" hidden={!showAdvancedOptions}>
          <div className="admin-tier-context-row">
            <div>
              <span>Đứng sau</span>
              <strong>{neighbors.previous?.name ?? 'Đầu chương trình'}</strong>
              <small>
                {neighbors.previous
                  ? `Từ ${formatNumber(neighbors.previous.minPoint)} điểm`
                  : 'Hạng đầu nên bắt đầu từ 0 điểm'}
              </small>
            </div>
            <div>
              <span>Hạng đang chỉnh</span>
              <strong>{form.name || 'Hạng mới'}</strong>
              <small>Cấp {form.level || '-'} · từ {form.minPoint ? formatNumber(Number(form.minPoint)) : '-'} điểm</small>
            </div>
            <div>
              <span>Đứng trước</span>
              <strong>{neighbors.next?.name ?? 'Hạng cao nhất'}</strong>
              <small>
                {neighbors.next
                  ? `Từ ${formatNumber(neighbors.next.minPoint)} điểm`
                  : 'Không giới hạn điểm tối đa'}
              </small>
            </div>
          </div>

          <h3 className="admin-tier-form-section-title">Cấu hình chi tiết</h3>
          <div className="admin-account-form-grid">
            <label>
              <span>Cấp hạng</span>
              <input
                className={shouldShowError('level') && errors.level ? 'is-invalid' : ''}
                type="number"
                value={form.level}
                onChange={(event) => setForm((currentForm) => ({ ...currentForm, level: event.target.value }))}
                required
                min={1}
                max={20}
              />
              {shouldShowError('level') && errors.level ? <small className="admin-field-error">{errors.level}</small> : null}
              <small className="admin-field-hint">Cấp càng cao tương ứng hạng càng cao.</small>
            </label>
            <label>
              <span>Điểm tối đa (tự tính)</span>
              <input
                type="text"
                value={suggestedMaxPoint === null ? 'Không giới hạn (hạng cao nhất)' : formatNumber(suggestedMaxPoint)}
                disabled
              />
              <small className="admin-field-hint">Tự động theo hạng kế tiếp, không cần nhập tay.</small>
            </label>
            <label>
              <span>Trạng thái</span>
              <select
                value={form.isActive ? 'active' : 'inactive'}
                onChange={(event) =>
                  setForm((currentForm) => ({ ...currentForm, isActive: event.target.value === 'active' }))
                }
              >
                <option value="active">Hoạt động</option>
                <option value="inactive">Tạm tắt</option>
              </select>
            </label>
          </div>

          <h3 className="admin-tier-form-section-title">Giao diện thẻ</h3>
          <div className="admin-tier-palette-row" aria-label="Bảng màu gợi ý">
            {palettePresets.map((palette) => (
              <button
                key={palette.name}
                type="button"
                style={{ backgroundColor: palette.card, color: palette.text }}
                onClick={() =>
                  setForm((currentForm) => ({
                    ...currentForm,
                    cardColor: palette.card,
                    textColor: palette.text,
                    badgeColor: palette.badge,
                  }))
                }
              >
                {palette.name}
              </button>
            ))}
          </div>

          <div className="admin-account-form-grid">
            <label>
              <span>Màu thẻ</span>
              <input
                className={errors.cardColor ? 'is-invalid' : ''}
                type="color"
                value={form.cardColor}
                onChange={(event) => {
                  const cardColor = event.target.value
                  const textColor = getContrastRatio(cardColor, '#ffffff') >= getContrastRatio(cardColor, '#111827')
                    ? '#ffffff'
                    : '#111827'
                  setForm((currentForm) => ({ ...currentForm, cardColor, textColor }))
                }}
              />
              {errors.cardColor ? <small className="admin-field-error">{errors.cardColor}</small> : null}
            </label>

            <label>
              <span>Màu chữ</span>
              <input
                className={errors.textColor ? 'is-invalid' : ''}
                type="color"
                value={form.textColor}
                onChange={(event) => setForm((currentForm) => ({ ...currentForm, textColor: event.target.value }))}
              />
              {errors.textColor ? <small className="admin-field-error">{errors.textColor}</small> : null}
            </label>

            <label>
              <span>Màu badge</span>
              <input
                type="color"
                value={form.badgeColor}
                onChange={(event) => setForm((currentForm) => ({ ...currentForm, badgeColor: event.target.value }))}
              />
            </label>

            <div className="admin-tier-icon-field">
              <span>Icon</span>
              <div className="admin-tier-icon-grid">
                {iconOptions.map((icon) => (
                  <button
                    key={icon.value}
                    type="button"
                    className={form.iconName === icon.value ? 'is-selected' : ''}
                    aria-label={icon.label}
                    title={icon.label}
                    onClick={() => setForm((currentForm) => ({ ...currentForm, iconName: icon.value }))}
                  >
                    {iconSymbols[icon.value] ?? '●'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <p className={`admin-tier-contrast ${contrastRatio >= 4.5 ? 'is-valid' : 'is-invalid'}`}>
            Độ tương phản {contrastRatio.toFixed(2)}:1 · {contrastRatio >= 4.5 ? 'Đạt chuẩn dễ đọc' : 'Cần tối thiểu 4.5:1'}
          </p>
        </div>

        <div className="admin-dialog-actions">
          <button className="admin-secondary-button" type="button" disabled={actionLoading} onClick={onClose}>
            Hủy
          </button>
          <button className="admin-primary-button" type="submit" disabled={actionLoading || Object.keys(errors).length > 0}>
            {actionLoading ? 'Đang lưu...' : 'Lưu hạng'}
          </button>
        </div>
      </form>
    </div>
  )
}
