import { ArrowDown, ArrowUp, Edit3, Plus, Search, Trash2 } from 'lucide-react'
import { Button, EmptyState, StatusBadge } from '../../../components/ui'
import type { FaqArticle, FaqCategory, SupportCategory } from '../support.types'

type SupportFaqPanelProps = {
  faqs: FaqArticle[]
  faqSearch: string
  faqCategory: FaqCategory | 'all'
  categoryLabels: Record<SupportCategory | FaqCategory, string>
  onSearchChange: (value: string) => void
  onCategoryChange: (value: FaqCategory | 'all') => void
  onCreate: () => void
  onEdit: (faq: FaqArticle) => void
  onDelete: (faqId: string) => void | Promise<void>
  onMove: (faqId: string, direction: -1 | 1) => void | Promise<void>
}

export function SupportFaqPanel({
  faqs,
  faqSearch,
  faqCategory,
  categoryLabels,
  onSearchChange,
  onCategoryChange,
  onCreate,
  onEdit,
  onDelete,
  onMove,
}: SupportFaqPanelProps) {
  return (
    <section className="admin-support-faq-wrapper">
      <div className="admin-support-panel-toolbar">
        <label className="admin-support-toolbar-search">
          <Search aria-hidden="true" />
          <input
            aria-label="Tìm bài hướng dẫn"
            placeholder="Tìm câu hỏi hoặc nội dung giải đáp..."
            value={faqSearch}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>

        <select
          className="admin-support-toolbar-select"
          aria-label="Lọc danh mục hướng dẫn"
          value={faqCategory}
          onChange={(event) => onCategoryChange(event.target.value as FaqCategory | 'all')}
        >
          <option value="all">Tất cả danh mục</option>
          {Object.entries(categoryLabels)
            .filter(([key]) => !['product', 'app_website', 'service'].includes(key))
            .map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
        </select>

        <Button variant="primary" onClick={onCreate}>
          <Plus aria-hidden="true" />
          Thêm bài hướng dẫn
        </Button>
      </div>

      <div className="admin-support-faq-list">
        {faqs.length ? (
          faqs.map((faq, index) => (
            <article key={faq._id} className="admin-support-faq-card">
              <div className="admin-support-faq-card__content">
                <div className="admin-support-faq-card__header">
                  <span className="admin-support-faq-category">{categoryLabels[faq.category]}</span>
                  <StatusBadge tone={faq.isPublished ? 'success' : 'neutral'}>
                    {faq.isPublished ? 'Đang hiển thị' : 'Bản nháp'}
                  </StatusBadge>
                  <span className="admin-support-faq-order">Thứ tự {faq.sortOrder + 1}</span>
                </div>

                <h3 className="admin-support-faq-card__question">{faq.question}</h3>
                <p className="admin-support-faq-card__answer">{faq.answer}</p>

                <div className="admin-support-faq-card__stats">
                  <span>👍 <b>{faq.helpfulCount}</b> hữu ích</span>
                  <span>·</span>
                  <span>👎 <b>{faq.notHelpfulCount}</b> chưa hữu ích</span>
                  {faq.keywords.length > 0 ? (
                    <>
                      <span>·</span>
                      <span className="admin-support-faq-keywords">
                        Từ khóa: {faq.keywords.join(', ')}
                      </span>
                    </>
                  ) : null}
                </div>
              </div>

              <aside className="admin-support-faq-card__actions">
                <div className="admin-support-faq-card__move-btns" role="group" aria-label="Thay đổi thứ tự">
                  <button
                    type="button"
                    className="admin-support-icon-mini-btn"
                    disabled={index === 0}
                    onClick={() => void onMove(faq._id, -1)}
                    title="Chuyển lên trên"
                    aria-label="Chuyển lên trên"
                  >
                    <ArrowUp aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="admin-support-icon-mini-btn"
                    disabled={index === faqs.length - 1}
                    onClick={() => void onMove(faq._id, 1)}
                    title="Chuyển xuống dưới"
                    aria-label="Chuyển xuống dưới"
                  >
                    <ArrowDown aria-hidden="true" />
                  </button>
                </div>

                <Button variant="secondary" onClick={() => onEdit(faq)}>
                  <Edit3 aria-hidden="true" />
                  Sửa
                </Button>

                <Button variant="danger" onClick={() => void onDelete(faq._id)}>
                  <Trash2 aria-hidden="true" />
                  Gỡ bài
                </Button>
              </aside>
            </article>
          ))
        ) : (
          <EmptyState
            title="Không tìm thấy bài hướng dẫn"
            description="Thử đổi từ khóa hoặc thêm bài hướng dẫn mới."
          />
        )}
      </div>
    </section>
  )
}
