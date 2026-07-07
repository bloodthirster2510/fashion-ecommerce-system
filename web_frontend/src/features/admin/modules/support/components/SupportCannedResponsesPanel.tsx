import { Button } from '../../../components/ui'
import type { CannedResponse, CannedResponsePayload, FaqCategory, SupportCategory } from '../support.types'

type SupportCannedResponsesPanelProps = {
  cannedResponses: CannedResponse[]
  cannedForm: CannedResponsePayload
  editingCannedId: string | null
  submitting: boolean
  categoryLabels: Record<SupportCategory | FaqCategory, string>
  onFormChange: (form: CannedResponsePayload) => void
  onSubmit: () => void | Promise<void>
  onCancelEdit: () => void
  onEdit: (item: CannedResponse) => void
  onDelete: (id: string) => void | Promise<void>
}

export function SupportCannedResponsesPanel({
  cannedResponses,
  cannedForm,
  editingCannedId,
  submitting,
  categoryLabels,
  onFormChange,
  onSubmit,
  onCancelEdit,
  onEdit,
  onDelete,
}: SupportCannedResponsesPanelProps) {
  return (
    <section className="admin-support-canned">
      <form onSubmit={(event) => { event.preventDefault(); void onSubmit() }} className="admin-support-canned-form">
        <h2>{editingCannedId ? 'Sửa mẫu trả lời' : 'Thêm mẫu trả lời'}</h2>
        <input aria-label="Tên mẫu" placeholder="Tên mẫu" value={cannedForm.title} onChange={(event) => onFormChange({ ...cannedForm, title: event.target.value })} />
        <select aria-label="Danh mục mẫu" value={cannedForm.category ?? ''} onChange={(event) => onFormChange({ ...cannedForm, category: (event.target.value || null) as SupportCategory | null })}>
          <option value="">Tất cả danh mục</option>
          {Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <textarea rows={6} placeholder="Nội dung trả lời" value={cannedForm.body} onChange={(event) => onFormChange({ ...cannedForm, body: event.target.value })} />
        <label><input type="checkbox" checked={cannedForm.isActive} onChange={(event) => onFormChange({ ...cannedForm, isActive: event.target.checked })} /> Đang sử dụng</label>
        <div><Button variant="primary" type="submit" disabled={submitting || cannedForm.title.trim().length < 2 || cannedForm.body.trim().length < 2}>Lưu mẫu</Button>{editingCannedId && <Button variant="secondary" onClick={onCancelEdit}>Hủy</Button>}</div>
      </form>
      <div className="admin-support-canned-list">
        {cannedResponses.map((item) => <article key={item._id}><div><h3>{item.title}</h3><p>{item.body}</p><small>{item.category ? categoryLabels[item.category] : 'Tất cả danh mục'} · đã dùng {item.useCount} lần · {item.isActive ? 'đang bật' : 'đã tắt'}</small></div><aside><Button variant="secondary" onClick={() => onEdit(item)}>Sửa</Button><Button variant="danger" onClick={() => void onDelete(item._id)}>Xóa</Button></aside></article>)}
      </div>
    </section>
  )
}
