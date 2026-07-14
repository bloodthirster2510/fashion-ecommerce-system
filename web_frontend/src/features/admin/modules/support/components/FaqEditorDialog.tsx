import type { FaqCategory, FaqPayload, SupportCategory } from '../support.types'

type FaqEditorDialogProps = {
  isEditing: boolean
  form: FaqPayload
  categoryLabels: Record<SupportCategory | FaqCategory, string>
  submitting: boolean
  onFormChange: (form: FaqPayload) => void
  onClose: () => void
  onSave: () => void | Promise<void>
}

export function FaqEditorDialog({
  isEditing,
  form,
  categoryLabels,
  submitting,
  onFormChange,
  onClose,
  onSave,
}: FaqEditorDialogProps) {
  return (
    <div className="admin-support-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="admin-support-dialog" role="dialog" aria-modal="true" aria-labelledby="faq-editor-title">
        <header><h2 id="faq-editor-title">{isEditing ? 'Chỉnh sửa FAQ' : 'Thêm FAQ'}</h2><button type="button" onClick={onClose}>×</button></header>
        <label>Câu hỏi<input value={form.question} onChange={(event) => onFormChange({ ...form, question: event.target.value })} /></label>
        <label>Câu trả lời<textarea rows={7} value={form.answer} onChange={(event) => onFormChange({ ...form, answer: event.target.value })} /></label>
        <label>Chủ đề<select value={form.category} onChange={(event) => onFormChange({ ...form, category: event.target.value as FaqCategory })}>{Object.entries(categoryLabels).filter(([key]) => !['product', 'app_website', 'service'].includes(key)).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Từ khóa<input value={form.keywords.join(', ')} onChange={(event) => onFormChange({ ...form, keywords: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} placeholder="đơn hàng, giao hàng" /></label>
        <label>Thứ tự hiển thị<input type="number" min={0} max={100000} value={form.sortOrder} onChange={(event) => onFormChange({ ...form, sortOrder: Number(event.target.value) || 0 })} /></label>
        <label className="admin-support-check"><input type="checkbox" checked={form.isPublished} onChange={(event) => onFormChange({ ...form, isPublished: event.target.checked })} /> Xuất bản cho khách hàng</label>
        <footer><button type="button" onClick={onClose}>Hủy</button><button type="button" disabled={submitting || form.question.trim().length < 5 || form.answer.trim().length < 10} onClick={() => void onSave()}>{submitting ? 'Đang lưu...' : 'Lưu FAQ'}</button></footer>
      </section>
    </div>
  )
}
