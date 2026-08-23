import type { FaqCategory, FaqPayload, SupportCategory } from '../support.types'
import { Button, Field, Modal } from '../../../components/ui'

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
    <Modal
      title={isEditing ? 'Sửa bài hướng dẫn' : 'Thêm bài hướng dẫn'}
      description="Nội dung đã xuất bản sẽ hiển thị ngay trên trang hỗ trợ của khách hàng."
      className="admin-support-faq-modal"
      isOpen
      onClose={onClose}
      actions={(
        <>
          <Button variant="secondary" type="button" disabled={submitting} onClick={onClose}>Hủy</Button>
          <Button
            variant="primary"
            type="button"
            disabled={submitting || form.question.trim().length < 5 || form.answer.trim().length < 10}
            onClick={() => void onSave()}
          >
            {submitting ? 'Đang lưu...' : 'Lưu bài'}
          </Button>
        </>
      )}
    >
      <div className="admin-support-faq-form">
        <Field label="Câu hỏi">
          <input maxLength={300} value={form.question} onChange={(event) => onFormChange({ ...form, question: event.target.value })} />
        </Field>
        <Field label="Câu trả lời">
          <textarea maxLength={5000} rows={7} value={form.answer} onChange={(event) => onFormChange({ ...form, answer: event.target.value })} />
        </Field>
        <div className="admin-support-faq-form__row">
          <Field label="Chủ đề">
            <select value={form.category} onChange={(event) => onFormChange({ ...form, category: event.target.value as FaqCategory })}>
              {Object.entries(categoryLabels).filter(([key]) => !['product', 'app_website', 'service'].includes(key)).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <Field label="Thứ tự hiển thị">
            <input type="number" min={0} max={100000} value={form.sortOrder} onChange={(event) => onFormChange({ ...form, sortOrder: Number(event.target.value) || 0 })} />
          </Field>
        </div>
        <Field label="Từ khóa">
          <input value={form.keywords.join(', ')} onChange={(event) => onFormChange({ ...form, keywords: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} placeholder="đơn hàng, giao hàng" />
        </Field>
        <label className="admin-support-check">
          <input type="checkbox" checked={form.isPublished} onChange={(event) => onFormChange({ ...form, isPublished: event.target.checked })} />
          <span>Xuất bản cho khách hàng</span>
        </label>
      </div>
    </Modal>
  )
}
