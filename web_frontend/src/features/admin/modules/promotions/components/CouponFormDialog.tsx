import type { Dispatch, FormEvent, RefObject, SetStateAction } from 'react'
import type { CouponDiscountType, CouponEligibleUserType, CouponPreview } from '../promotion.types'
import { OptionPicker, type PickerOption } from './OptionPicker'

type Notice = {
  type: 'success' | 'error'
  message: string
}

type CouponFormState = {
  code: string
  name: string
  description: string
  discountType: CouponDiscountType
  discountValue: string
  maxDiscountAmount: string
  minOrderAmount: string
  usageLimit: string
  perUserLimit: string
  isPublic: boolean
  eligibleUserTypes: CouponEligibleUserType[]
  eligibleMembershipRanks: string[]
  applicableProducts: string[]
  applicableCategories: string[]
  startAt: string
  endAt: string
  isActive: boolean
}

type CouponFieldErrors = Partial<Record<keyof CouponFormState, string>>
type CodeAvailabilityState = 'idle' | 'checking' | 'available' | 'taken'
type CouponScopeMode = 'all' | 'category' | 'product'
type CouponSelectionField = 'eligibleMembershipRanks' | 'applicableProducts' | 'applicableCategories'

type CouponFormDialogProps = {
  dialogRef: RefObject<HTMLDivElement | null>
  mode: 'create' | 'duplicate' | 'edit'
  couponForm: CouponFormState
  setCouponForm: Dispatch<SetStateAction<CouponFormState>>
  couponErrors: CouponFieldErrors
  showCouponErrors: boolean
  couponStep: number
  showAdvancedCouponOptions: boolean
  notice: Notice | null
  actionLoading: boolean
  codeAvailability: CodeAvailabilityState
  draftRestored: boolean
  discountTypeLabels: Record<CouponDiscountType, string>
  discountTypeDescriptions: Record<CouponDiscountType, string>
  discountTypeSymbols: Record<CouponDiscountType, string>
  percentPresets: string[]
  fixedPresets: string[]
  durationPresets: Array<{ label: string; days: number }>
  eligibleUserTypeOptions: Array<{ value: CouponEligibleUserType; label: string }>
  tierOptions: PickerOption[]
  categoryOptions: PickerOption[]
  productOptions: PickerOption[]
  categoryScopeShortcuts: Array<{ key: string; label: string; categoryIds: string[] }>
  tierReferenceError: string | null
  categoryReferenceError: string | null
  productReferenceError: string | null
  couponScopeMode: CouponScopeMode
  couponDurationDays: number
  productSearchQuery: string
  isSearchingProducts: boolean
  productTotal: number
  productPage: number
  productTotalPages: number
  sampleSubTotal: string
  sampleShippingFee: string
  couponPreview: CouponPreview | null
  formAudienceText: string
  formScopeText: string
  formUsageText: string
  formDiscountPreview: string
  estimatedAudience: number
  formatCurrency: (value: number) => string
  formatNumber: (value: number) => string
  formatDateTime: (value: string) => string
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>
  onInvalidForm: () => void
  onDiscardDraft: () => void
  onStepChange: (step: number) => void
  onPreviousStep: () => void
  onToggleAdvancedOptions: () => void
  onGenerateCode: () => void
  onDiscountTypeChange: (discountType: CouponDiscountType) => void
  onSetStartNow: () => void
  onSetFullDay: () => void
  onDurationPreset: (days: number) => void
  onToggleEligibleUserType: (value: CouponEligibleUserType, checked: boolean) => void
  onUpdateSelectionField: (field: CouponSelectionField, values: string[]) => void
  onLoadReferences: () => void | Promise<void>
  onSetCouponScopeMode: (mode: CouponScopeMode) => void
  onApplyCategoryScopeShortcut: (categoryIds: string[]) => void
  onRunProductScopeSearch: (keyword: string) => void | Promise<void>
  onSearchProducts: (keyword: string, page?: number) => void | Promise<void>
  onLoadMoreProducts: () => void | Promise<void>
  onSampleSubTotalChange: (value: string) => void
  onSampleShippingFeeChange: (value: string) => void
  onClose: () => void
}

export function CouponFormDialog({
  dialogRef,
  mode,
  couponForm,
  setCouponForm,
  couponErrors,
  showCouponErrors,
  couponStep,
  showAdvancedCouponOptions,
  notice,
  actionLoading,
  codeAvailability,
  draftRestored,
  discountTypeLabels,
  discountTypeDescriptions,
  discountTypeSymbols,
  percentPresets,
  fixedPresets,
  durationPresets,
  eligibleUserTypeOptions,
  tierOptions,
  categoryOptions,
  productOptions,
  categoryScopeShortcuts,
  tierReferenceError,
  categoryReferenceError,
  productReferenceError,
  couponScopeMode,
  couponDurationDays,
  productSearchQuery,
  isSearchingProducts,
  productTotal,
  productPage,
  productTotalPages,
  sampleSubTotal,
  sampleShippingFee,
  couponPreview,
  formAudienceText,
  formScopeText,
  formUsageText,
  formDiscountPreview,
  estimatedAudience,
  formatCurrency,
  formatNumber,
  formatDateTime,
  onSubmit,
  onInvalidForm,
  onDiscardDraft,
  onStepChange,
  onPreviousStep,
  onToggleAdvancedOptions,
  onGenerateCode,
  onDiscountTypeChange,
  onSetStartNow,
  onSetFullDay,
  onDurationPreset,
  onToggleEligibleUserType,
  onUpdateSelectionField,
  onLoadReferences,
  onSetCouponScopeMode,
  onApplyCategoryScopeShortcut,
  onRunProductScopeSearch,
  onSearchProducts,
  onLoadMoreProducts,
  onSampleSubTotalChange,
  onSampleShippingFeeChange,
  onClose,
}: CouponFormDialogProps) {
  return (
    <div ref={dialogRef} tabIndex={-1} className="admin-confirm-layer" role="dialog" aria-modal="true" aria-labelledby="admin-coupon-dialog-title">
      <form
        className={`admin-account-dialog admin-coupon-dialog is-step-${couponStep}`}
        onSubmit={onSubmit}
        onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') event.currentTarget.requestSubmit() }}
        onInvalid={onInvalidForm}
      >
        <header className="admin-coupon-dialog-header">
          <div>
            <span>Thiết lập voucher</span>
            <h2 id="admin-coupon-dialog-title">
              {mode === 'create' ? 'Tạo voucher' : mode === 'duplicate' ? 'Nhân bản voucher' : 'Sửa voucher'}
            </h2>
            <p>Thiết lập giá trị ưu đãi, thời hạn và điều kiện áp dụng.</p>
          </div>
        </header>

        {draftRestored ? (
          <div className="admin-coupon-draft-notice"><span>Đã khôi phục bản nháp gần nhất.</span><button type="button" onClick={onDiscardDraft}>Bỏ bản nháp</button></div>
        ) : null}

        <nav className="admin-coupon-stepper" aria-label="Các bước tạo voucher">
          {['Thông tin & giá trị', 'Thời gian & đối tượng', 'Phạm vi & xem lại'].map((label, index) => {
            const step = index + 1
            return <button key={label} type="button" className={couponStep === step ? 'is-active' : couponStep > step ? 'is-complete' : ''} onClick={() => step < couponStep && onStepChange(step)}><span>{step}</span>{label}</button>
          })}
        </nav>
        <div className="admin-coupon-advanced-toggle"><button className="admin-link-button" type="button" aria-expanded={showAdvancedCouponOptions} onClick={onToggleAdvancedOptions}>{showAdvancedCouponOptions ? 'Ẩn tùy chọn nâng cao' : 'Hiện tùy chọn nâng cao'}</button><span>{showAdvancedCouponOptions ? 'Đối tượng và phạm vi áp dụng đang hiển thị.' : 'Thiết lập nhanh dùng mặc định: mọi khách, toàn bộ đơn.'}</span></div>

        {notice ? <p className={`admin-notice is-${notice.type} admin-coupon-dialog-notice`} role="status">{notice.message}</p> : null}

        <div className="admin-coupon-dialog-body">
          <div className="admin-coupon-form-column">
            <section className="admin-coupon-form-section" hidden={couponStep !== 1}>
              <header className="admin-coupon-section-header">
                <span>01</span>
                <div>
                  <strong>Thông tin voucher</strong>
                  <p>Mã dễ nhớ giúp khách nhập đúng khi thanh toán.</p>
                </div>
              </header>

              <div className="admin-account-form-grid">
                <label>
                  <span>Mã voucher</span>
                  <div className="admin-field-with-action">
                    <input
                      value={couponForm.code}
                      onChange={(event) =>
                        setCouponForm((form) => ({ ...form, code: event.target.value.toUpperCase() }))
                      }
                      placeholder="WELCOME10"
                      required
                      minLength={2}
                      maxLength={40}
                      pattern="[A-Z0-9_-]+"
                    />
                    <button className="admin-secondary-button" type="button" onClick={onGenerateCode}>
                      Tạo mã
                    </button>
                  </div>
                  <small className="admin-field-hint">Chữ in hoa, số, gạch dưới hoặc gạch ngang.</small>
                  {codeAvailability === 'checking' ? <small className="admin-field-status">Đang kiểm tra mã...</small> : null}
                  {codeAvailability === 'available' ? <small className="admin-field-status is-success">Mã này còn trống.</small> : null}
                  {codeAvailability === 'taken' ? <small className="admin-field-error">Mã voucher đã tồn tại.</small> : null}
                  {showCouponErrors && couponErrors.code ? <small className="admin-field-error">{couponErrors.code}</small> : null}
                </label>
                <label>
                  <span>Tên voucher</span>
                  <input
                    value={couponForm.name}
                    onChange={(event) => setCouponForm((form) => ({ ...form, name: event.target.value }))}
                    placeholder="Ví dụ: Chào mừng khách mới"
                    required
                    minLength={2}
                    maxLength={120}
                  />
                  {showCouponErrors && couponErrors.name ? <small className="admin-field-error">{couponErrors.name}</small> : null}
                </label>
                <label className="admin-coupon-wide-field">
                  <span>Mô tả</span>
                  <textarea
                    value={couponForm.description}
                    onChange={(event) => setCouponForm((form) => ({ ...form, description: event.target.value }))}
                    maxLength={500}
                    rows={3}
                    placeholder="Ghi chú nội bộ hoặc mô tả ngắn cho chương trình."
                  />
                </label>
              </div>
            </section>

            <section className="admin-coupon-form-section" hidden={couponStep !== 1}>
              <header className="admin-coupon-section-header">
                <span>02</span>
                <div>
                  <strong>Giá trị ưu đãi và lượt dùng</strong>
                  <p>Chọn kiểu giảm, ngân sách lượt dùng và điều kiện đơn hàng.</p>
                </div>
              </header>

              <div className="admin-coupon-type-grid" role="group" aria-label="Loại giảm">
                {(Object.keys(discountTypeLabels) as CouponDiscountType[]).map((discountType) => (
                  <button
                    key={discountType}
                    className={`admin-coupon-type-button${couponForm.discountType === discountType ? ' is-selected' : ''}`}
                    type="button"
                    aria-pressed={couponForm.discountType === discountType}
                    onClick={() => onDiscountTypeChange(discountType)}
                  >
                    <span className="admin-coupon-type-symbol">{discountTypeSymbols[discountType]}</span>
                    <span>
                      <strong>{discountTypeLabels[discountType]}</strong>
                      <small>{discountTypeDescriptions[discountType]}</small>
                    </span>
                  </button>
                ))}
              </div>

              <div className="admin-account-form-grid">
                {couponForm.discountType !== 'free_shipping' ? <label>
                  <span>Giá trị giảm</span>
                  <div className="admin-input-affix">
                    <input
                      type="number"
                      value={couponForm.discountValue}
                      onChange={(event) => setCouponForm((form) => ({ ...form, discountValue: event.target.value }))}
                      required
                      min={couponForm.discountType === 'percent' ? 1 : 0}
                      max={couponForm.discountType === 'percent' ? 100 : undefined}
                    />
                    <span>{couponForm.discountType === 'percent' ? '%' : 'đ'}</span>
                  </div>
                  {showCouponErrors && couponErrors.discountValue ? <small className="admin-field-error">{couponErrors.discountValue}</small> : null}
                </label> : <p className="admin-smart-guidance">Miễn phí vận chuyển không cần nhập giá trị giảm. Nên đặt đơn tối thiểu để tránh lạm dụng.</p>}
                {couponForm.discountType === 'percent' ? <label>
                  <span>Giảm tối đa</span>
                  <div className="admin-input-affix">
                    <input
                      type="number"
                      value={couponForm.maxDiscountAmount}
                      onChange={(event) =>
                        setCouponForm((form) => ({ ...form, maxDiscountAmount: event.target.value }))
                      }
                      disabled={couponForm.discountType !== 'percent'}
                      min={0}
                      placeholder="Không giới hạn"
                    />
                    <span>đ</span>
                  </div>
                  <small className="admin-field-hint">Nên đặt trần giảm để kiểm soát chi phí với đơn hàng lớn.</small>
                  {showCouponErrors && couponErrors.maxDiscountAmount ? <small className="admin-field-error">{couponErrors.maxDiscountAmount}</small> : null}
                </label> : null}
                <label>
                  <span>Đơn tối thiểu</span>
                  <div className="admin-input-affix">
                    <input
                      type="number"
                      value={couponForm.minOrderAmount}
                      onChange={(event) =>
                        setCouponForm((form) => ({ ...form, minOrderAmount: event.target.value }))
                      }
                      required
                      min={0}
                    />
                    <span>đ</span>
                  </div>
                  {showCouponErrors && couponErrors.minOrderAmount ? <small className="admin-field-error">{couponErrors.minOrderAmount}</small> : null}
                </label>
                <label>
                  <span>Giới hạn lượt dùng</span>
                  <input
                    type="number"
                    value={couponForm.usageLimit}
                    onChange={(event) => setCouponForm((form) => ({ ...form, usageLimit: event.target.value }))}
                    min={1}
                    placeholder="Không giới hạn"
                  />
                  {showCouponErrors && couponErrors.usageLimit ? <small className="admin-field-error">{couponErrors.usageLimit}</small> : null}
                </label>
                <label>
                  <span>Mỗi khách được dùng</span>
                  <input
                    type="number"
                    value={couponForm.perUserLimit}
                    onChange={(event) => setCouponForm((form) => ({ ...form, perUserLimit: event.target.value }))}
                    required
                    min={1}
                  />
                  {showCouponErrors && couponErrors.perUserLimit ? <small className="admin-field-error">{couponErrors.perUserLimit}</small> : null}
                </label>
              </div>

              <div className="admin-preset-row" aria-label="Đơn tối thiểu gợi ý">
                {['0', '200000', '500000', '1000000'].map((preset) => <button key={preset} type="button" className={couponForm.minOrderAmount === preset ? 'is-selected' : ''} onClick={() => setCouponForm((form) => ({ ...form, minOrderAmount: preset }))}>Đơn {formatCurrency(Number(preset))}</button>)}
              </div>
              {couponForm.discountType === 'percent' && Number(couponForm.discountValue) > 30 ? <p className="admin-smart-warning">Mức giảm trên 30% có thể ảnh hưởng đáng kể đến biên lợi nhuận.</p> : null}

              {couponForm.discountType !== 'free_shipping' ? (
                <div className="admin-preset-row" aria-label="Giá trị gợi ý">
                  {(couponForm.discountType === 'percent' ? percentPresets : fixedPresets).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className={couponForm.discountValue === preset ? 'is-selected' : ''}
                      onClick={() => setCouponForm((form) => ({ ...form, discountValue: preset }))}
                    >
                      {couponForm.discountType === 'percent' ? `${preset}%` : formatCurrency(Number(preset))}
                    </button>
                  ))}
                </div>
              ) : null}
              {!couponForm.usageLimit.trim() && Number(couponForm.perUserLimit || 0) > 1 ? <p className="admin-smart-warning">Không giới hạn tổng lượt và cho mỗi khách dùng nhiều lần có thể làm chi phí vượt dự kiến.</p> : null}
            </section>

            <section className="admin-coupon-form-section" hidden={couponStep !== 2}>
              <header className="admin-coupon-section-header">
                <span>03</span>
                <div>
                  <strong>Thời gian hiển thị</strong>
                  <p>Kiểm soát thời điểm voucher bắt đầu, kết thúc và trạng thái hiển thị.</p>
                </div>
              </header>

              <div className="admin-account-form-grid">
                <label>
                  <span>Bắt đầu (giờ VN)</span>
                  <input
                    type="datetime-local"
                    value={couponForm.startAt}
                    onChange={(event) => setCouponForm((form) => ({ ...form, startAt: event.target.value }))}
                    required
                  />
                  {showCouponErrors && couponErrors.startAt ? <small className="admin-field-error">{couponErrors.startAt}</small> : null}
                </label>
                <label>
                  <span>Kết thúc (giờ VN)</span>
                  <input
                    type="datetime-local"
                    value={couponForm.endAt}
                    onChange={(event) => setCouponForm((form) => ({ ...form, endAt: event.target.value }))}
                    required
                  />
                  {showCouponErrors && couponErrors.endAt ? <small className="admin-field-error">{couponErrors.endAt}</small> : null}
                </label>
              </div>
              <div className="admin-preset-row" aria-label="Thời hạn gợi ý">
                <button type="button" onClick={onSetStartNow}>Bắt đầu ngay</button>
                <button type="button" onClick={onSetFullDay}>Cả ngày</button>
                {durationPresets.map((preset) => (
                  <button key={preset.days} type="button" onClick={() => onDurationPreset(preset.days)}>
                    {preset.label}
                  </button>
                ))}
              </div>
              {couponDurationDays > 90 ? <p className="admin-smart-warning">Voucher kéo dài hơn 90 ngày; nên chia thành nhiều đợt để dễ đo hiệu quả và kiểm soát ngân sách.</p> : null}
              <div className="admin-toggle-grid">
                <label>
                  <input
                    type="checkbox"
                    checked={couponForm.isPublic}
                    onChange={(event) => setCouponForm((form) => ({ ...form, isPublic: event.target.checked }))}
                  />
                  <span>
                    <strong>Công khai</strong>
                    <small>Hiển thị trong danh sách ưu đãi của khách</small>
                  </span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={couponForm.isActive}
                    onChange={(event) => setCouponForm((form) => ({ ...form, isActive: event.target.checked }))}
                  />
                  <span>
                    <strong>Đang hoạt động</strong>
                    <small>Cho phép áp dụng khi đến thời gian hiệu lực</small>
                  </span>
                </label>
              </div>
            </section>

            <section className="admin-coupon-form-section" hidden={couponStep !== 2 || !showAdvancedCouponOptions}>
              <header className="admin-coupon-section-header">
                <span>04</span>
                <div>
                  <strong>Đối tượng áp dụng</strong>
                  <p>Có thể giới hạn theo loại khách và hạng thành viên.</p>
                </div>
              </header>

              <div className="admin-promotion-checkbox-row">
                {eligibleUserTypeOptions.map((option) => (
                  <label key={option.value}>
                    <input
                      type="checkbox"
                      checked={couponForm.eligibleUserTypes.includes(option.value)}
                      disabled={option.value !== 'all' && couponForm.eligibleUserTypes.includes('all')}
                      onChange={(event) => onToggleEligibleUserType(option.value, event.target.checked)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
              {couponForm.eligibleUserTypes.includes('all') ? <p className="admin-field-hint">“Tất cả khách” đang được chọn; bỏ chọn để giới hạn theo nhóm khách.</p> : null}
              <OptionPicker
                title="Hạng thành viên"
                emptyLabel="Tất cả hạng"
                searchPlaceholder="Tìm hạng thành viên"
                options={tierOptions}
                selectedValues={couponForm.eligibleMembershipRanks}
                onChange={(values) => onUpdateSelectionField('eligibleMembershipRanks', values)}
                warning={tierReferenceError ?? undefined}
                onRetry={() => void onLoadReferences()}
              />
            </section>

            <section className="admin-coupon-form-section" hidden={couponStep !== 3 || !showAdvancedCouponOptions}>
              <header className="admin-coupon-section-header">
                <span>05</span>
                <div>
                  <strong>Phạm vi sản phẩm</strong>
                  <p>Để trống nếu voucher áp dụng cho toàn bộ đơn hàng.</p>
                </div>
              </header>

              <div className="admin-coupon-scope-grid" role="group" aria-label="Chọn phạm vi voucher">
                <button
                  type="button"
                  className={`admin-coupon-scope-card${couponScopeMode === 'all' ? ' is-selected' : ''}`}
                  onClick={() => onSetCouponScopeMode('all')}
                >
                  <strong>Toàn bộ đơn hàng</strong>
                  <span>Áp dụng cho mọi sản phẩm đủ điều kiện.</span>
                </button>
                <button
                  type="button"
                  className={`admin-coupon-scope-card${couponScopeMode === 'category' ? ' is-selected' : ''}`}
                  onClick={() => onSetCouponScopeMode('category')}
                >
                  <strong>Theo danh mục</strong>
                  <span>Phù hợp khi giảm toàn bộ áo, quần, giày hoặc một nhóm hàng.</span>
                </button>
                <button
                  type="button"
                  className={`admin-coupon-scope-card${couponScopeMode === 'product' ? ' is-selected' : ''}`}
                  onClick={() => onSetCouponScopeMode('product')}
                >
                  <strong>Từng sản phẩm</strong>
                  <span>Chọn chính xác các món muốn chạy ưu đãi.</span>
                </button>
              </div>

              {couponScopeMode === 'all' ? (
                <p className="admin-scope-empty-note">Voucher sẽ áp dụng cho toàn bộ đơn hàng, không cần chọn danh mục hoặc sản phẩm.</p>
              ) : null}

              {couponScopeMode === 'category' ? (
                <div className="admin-coupon-scope-workspace">
                  <div className="admin-coupon-scope-shortcuts" aria-label="Chọn nhanh danh mục">
                    {categoryScopeShortcuts.map((shortcut) => (
                      <button
                        key={shortcut.key}
                        type="button"
                        disabled={!shortcut.categoryIds.length}
                        className={shortcut.categoryIds.length && shortcut.categoryIds.every((id) => couponForm.applicableCategories.includes(id)) ? 'is-selected' : ''}
                        onClick={() => onApplyCategoryScopeShortcut(shortcut.categoryIds)}
                      >
                        <strong>{shortcut.label}</strong>
                        <span>{shortcut.categoryIds.length ? `${shortcut.categoryIds.length} danh mục` : 'Chưa có danh mục'}</span>
                      </button>
                    ))}
                  </div>
                  <OptionPicker
                    title="Danh mục áp dụng"
                    emptyLabel="Chưa chọn danh mục"
                    searchPlaceholder="Tìm danh mục"
                    options={categoryOptions}
                    selectedValues={couponForm.applicableCategories}
                    onChange={(values) => onUpdateSelectionField('applicableCategories', values)}
                    warning={categoryReferenceError ?? undefined}
                    onRetry={() => void onLoadReferences()}
                  />
                </div>
              ) : null}

              {couponScopeMode === 'product' ? (
                <div className="admin-coupon-scope-workspace">
                  <div className="admin-coupon-scope-shortcuts" aria-label="Tìm nhanh sản phẩm">
                    {['Áo', 'Quần', 'Váy', 'Giày'].map((keyword) => (
                      <button key={keyword} type="button" onClick={() => void onRunProductScopeSearch(keyword)}>
                        <strong>Tìm {keyword.toLowerCase()}</strong>
                        <span>Lọc sản phẩm theo từ khóa</span>
                      </button>
                    ))}
                  </div>
                  <OptionPicker
                    title="Sản phẩm áp dụng"
                    emptyLabel="Chưa chọn sản phẩm"
                    searchPlaceholder="Tìm sản phẩm"
                    options={productOptions}
                    selectedValues={couponForm.applicableProducts}
                    onChange={(values) => onUpdateSelectionField('applicableProducts', values)}
                    onSearch={onSearchProducts}
                    isSearching={isSearchingProducts}
                    totalCount={productTotal}
                    hasMore={productPage < productTotalPages}
                    onLoadMore={onLoadMoreProducts}
                    warning={productReferenceError ?? undefined}
                    onRetry={() => void onSearchProducts(productSearchQuery, 1)}
                  />
                </div>
              ) : null}
              {couponForm.applicableCategories.length && couponForm.applicableProducts.length ? <p className="admin-smart-warning">Đang chọn cả danh mục và sản phẩm. Voucher chỉ giảm các sản phẩm thuộc ít nhất một phạm vi đã chọn; hãy kiểm tra tránh chọn trùng ngoài ý muốn.</p> : null}
            </section>
          </div>

          <aside className="admin-coupon-side-panel" aria-label="Tóm tắt voucher">
            <div className="admin-coupon-preview">
              <span>{couponForm.code || 'VOUCHER'}</span>
              <b>{couponForm.name || 'Tên voucher'}</b>
              <strong>{formDiscountPreview}</strong>
              <small>Đơn từ {formatCurrency(Number(couponForm.minOrderAmount || 0))}</small>
            </div>

            <div className="admin-coupon-cost-preview">
              <strong>Ước tính trên đơn mẫu</strong>
              <label><span>Tiền hàng</span><input type="number" min={0} step={1000} value={sampleSubTotal} onChange={(event) => onSampleSubTotalChange(event.target.value)} /></label>
              <label><span>Phí vận chuyển</span><input type="number" min={0} step={1000} value={sampleShippingFee} onChange={(event) => onSampleShippingFeeChange(event.target.value)} /></label>
              {couponPreview ? (
                <div className={couponPreview.eligible ? 'is-eligible' : 'is-ineligible'}>
                  <span>{couponPreview.eligible ? 'Đơn đủ điều kiện' : 'Chưa đạt đơn tối thiểu'}</span>
                  <b>Giảm {formatCurrency(couponPreview.summary.discountAmount + couponPreview.summary.shippingDiscountAmount)}</b>
                  <small>Khách trả {formatCurrency(couponPreview.summary.totalAmount)}</small>
                </div>
              ) : <small>Hoàn tất các trường bắt buộc để xem ước tính.</small>}
            </div>

            <div className="admin-coupon-summary">
              <div>
                <span>Đối tượng</span>
                <strong>{formAudienceText}</strong>
                <small>Ước tính {formatNumber(estimatedAudience)} thành viên đã xếp hạng</small>
              </div>
              <div>
                <span>Phạm vi</span>
                <strong>{formScopeText}</strong>
              </div>
              <div>
                <span>Hạn dùng</span>
                <strong>{formatDateTime(couponForm.endAt)}</strong>
              </div>
              <div>
                <span>Lượt dùng</span>
                <strong>{formUsageText}</strong>
              </div>
              <div>
                <span>Hiển thị</span>
                <strong>{couponForm.isPublic ? 'Công khai' : 'Riêng tư'} · {couponForm.isActive ? 'Đang bật' : 'Đang tắt'}</strong>
              </div>
            </div>
          </aside>
        </div>

        <footer className="admin-dialog-actions admin-coupon-actions">
          <button className="admin-secondary-button" type="button" disabled={actionLoading} onClick={onClose}>
            Hủy
          </button>
          {couponStep > 1 ? <button className="admin-secondary-button" type="button" disabled={actionLoading} onClick={onPreviousStep}>Quay lại</button> : null}
          <button className="admin-primary-button" type="submit" disabled={actionLoading || codeAvailability === 'checking'}>
            {actionLoading ? 'Đang lưu...' : couponStep < 3 ? 'Tiếp tục' : 'Lưu voucher'}
          </button>
        </footer>
      </form>
    </div>
  )
}
