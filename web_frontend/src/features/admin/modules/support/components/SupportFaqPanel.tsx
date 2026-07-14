import { Button } from '../../../components/ui'
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
    <section className="admin-support-faqs">
      <div className="admin-support-toolbar">
        <input aria-label="Tìm FAQ" placeholder="Tìm câu hỏi..." value={faqSearch} onChange={(event) => onSearchChange(event.target.value)} />
        <select aria-label="Lọc danh mục FAQ" value={faqCategory} onChange={(event) => onCategoryChange(event.target.value as FaqCategory | 'all')}>
          <option value="all">Tất cả danh mục</option>
          {Object.entries(categoryLabels).filter(([key]) => !['product', 'app_website', 'service'].includes(key)).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <Button variant="primary" onClick={onCreate}>Thêm FAQ</Button>
      </div>
      <div className="admin-support-faq-list">
        {faqs.map((faq) => (
          <article key={faq._id}>
            <div><span>{categoryLabels[faq.category]}</span><h3>{faq.question}</h3><p>{faq.answer}</p><small>{faq.helpfulCount} hữu ích · {faq.notHelpfulCount} chưa hữu ích</small></div>
            <aside><em className={faq.isPublished ? 'published' : ''}>{faq.isPublished ? 'Đang hiển thị' : 'Bản nháp'} · #{faq.sortOrder}</em><Button variant="secondary" onClick={() => void onMove(faq._id, -1)}>↑</Button><Button variant="secondary" onClick={() => void onMove(faq._id, 1)}>↓</Button><Button variant="secondary" onClick={() => onEdit(faq)}>Sửa</Button><Button variant="danger" onClick={() => void onDelete(faq._id)}>Ẩn/Xóa</Button></aside>
          </article>
        ))}
      </div>
    </section>
  )
}
