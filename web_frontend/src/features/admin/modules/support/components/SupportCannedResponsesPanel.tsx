import { useState } from 'react'
import { CheckCircle2, Edit3, MessageSquarePlus, Search, Trash2, X } from 'lucide-react'
import { Button, EmptyState, Field, StatusBadge } from '../../../components/ui'
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
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  const filteredResponses = cannedResponses.filter((item) => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.body.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCat = selectedCategory === 'all' || item.category === selectedCategory
    return matchesSearch && matchesCat
  })

  return (
    <section className="admin-support-canned-workspace">
      {/* LEFT COLUMN: FORM */}
      <div className="admin-support-canned-form-card">
        <header className="admin-support-canned-form-card__header">
          <div className="admin-support-canned-form-card__title">
            <MessageSquarePlus aria-hidden="true" />
            <h3>{editingCannedId ? 'Chỉnh sửa mẫu trả lời' : 'Tạo mẫu trả lời nhanh'}</h3>
          </div>
          <p>Lưu sẵn các câu trả lời chuẩn để nhân viên CSKH phản hồi nhanh chỉ với 1 click.</p>
        </header>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            void onSubmit()
          }}
          className="admin-support-canned-form"
        >
          <Field label="Tiêu đề mẫu">
            <input
              aria-label="Tiêu đề mẫu"
              placeholder="VD: Chào khách hàng, Hướng dẫn đổi trả..."
              value={cannedForm.title}
              onChange={(event) => onFormChange({ ...cannedForm, title: event.target.value })}
              required
            />
          </Field>

          <Field label="Áp dụng cho danh mục">
            <select
              aria-label="Danh mục mẫu"
              value={cannedForm.category ?? ''}
              onChange={(event) => onFormChange({ ...cannedForm, category: (event.target.value || null) as SupportCategory | null })}
            >
              <option value="">Tất cả danh mục (Dùng chung)</option>
              {Object.entries(categoryLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </Field>

          <Field label="Nội dung phản hồi mẫu">
            <textarea
              rows={7}
              placeholder="Nhập nội dung mẫu trả lời chi tiết..."
              value={cannedForm.body}
              onChange={(event) => onFormChange({ ...cannedForm, body: event.target.value })}
              required
            />
          </Field>

          <label className="admin-support-checkbox-label">
            <input
              type="checkbox"
              checked={cannedForm.isActive}
              onChange={(event) => onFormChange({ ...cannedForm, isActive: event.target.checked })}
            />
            <span>Kích hoạt và cho phép nhân viên sử dụng mẫu này</span>
          </label>

          <div className="admin-support-canned-form__actions">
            <Button
              variant="primary"
              type="submit"
              disabled={submitting || cannedForm.title.trim().length < 2 || cannedForm.body.trim().length < 2}
            >
              <CheckCircle2 aria-hidden="true" />
              {editingCannedId ? 'Lưu thay đổi' : 'Tạo mẫu mới'}
            </Button>

            {editingCannedId ? (
              <Button variant="secondary" type="button" onClick={onCancelEdit}>
                <X aria-hidden="true" />
                Hủy
              </Button>
            ) : null}
          </div>
        </form>
      </div>

      {/* RIGHT COLUMN: LIST */}
      <div className="admin-support-canned-list-wrapper">
        <div className="admin-support-panel-toolbar is-compact">
          <label className="admin-support-toolbar-search">
            <Search aria-hidden="true" />
            <input
              aria-label="Tìm mẫu trả lời"
              placeholder="Tìm theo tiêu đề hoặc nội dung..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </label>

          <select
            className="admin-support-toolbar-select"
            aria-label="Lọc danh mục"
            value={selectedCategory}
            onChange={(event) => setSelectedCategory(event.target.value)}
          >
            <option value="all">Tất cả danh mục</option>
            {Object.entries(categoryLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div className="admin-support-canned-list">
          {filteredResponses.length ? (
            filteredResponses.map((item) => (
              <article key={item._id} className={`admin-support-canned-card${editingCannedId === item._id ? ' is-editing' : ''}`}>
                <div className="admin-support-canned-card__main">
                  <div className="admin-support-canned-card__header">
                    <span className="admin-support-canned-category">
                      {item.category ? categoryLabels[item.category] : 'Dùng chung'}
                    </span>
                    <StatusBadge tone={item.isActive ? 'success' : 'neutral'}>
                      {item.isActive ? 'Đang bật' : 'Đã tắt'}
                    </StatusBadge>
                    <span className="admin-support-canned-count">
                      Đã dùng: <b>{item.useCount}</b> lần
                    </span>
                  </div>

                  <h4 className="admin-support-canned-card__title">{item.title}</h4>
                  <p className="admin-support-canned-card__body">{item.body}</p>
                </div>

                <aside className="admin-support-canned-card__actions">
                  <Button variant="secondary" onClick={() => onEdit(item)}>
                    <Edit3 aria-hidden="true" />
                    Sửa
                  </Button>
                  <Button variant="danger" onClick={() => void onDelete(item._id)}>
                    <Trash2 aria-hidden="true" />
                    Xóa
                  </Button>
                </aside>
              </article>
            ))
          ) : (
            <EmptyState
              title="Không tìm thấy mẫu trả lời"
              description="Thử đổi từ khóa tìm kiếm hoặc tạo mẫu mới ở khung bên trái."
            />
          )}
        </div>
      </div>
    </section>
  )
}
