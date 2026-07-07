import { Button } from '../../../components/ui'
import type { FaqArticle, FaqCategory, SupportCategory } from '../support.types'

type SupportFaqPanelProps = {
  faqs: FaqArticle[]
  faqSearch: string
  categoryLabels: Record<SupportCategory | FaqCategory, string>
  onSearchChange: (value: string) => void
  onCreate: () => void
  onEdit: (faq: FaqArticle) => void
  onDelete: (faqId: string) => void | Promise<void>
}

export function SupportFaqPanel({
  faqs,
  faqSearch,
  categoryLabels,
  onSearchChange,
  onCreate,
  onEdit,
  onDelete,
}: SupportFaqPanelProps) {
  return (
    <section className="admin-support-faqs">
      <div className="admin-support-toolbar">
        <input aria-label="Tìm FAQ" placeholder="Tìm câu hỏi..." value={faqSearch} onChange={(event) => onSearchChange(event.target.value)} />
        <Button variant="primary" onClick={onCreate}>Thêm FAQ</Button>
      </div>
      <div className="admin-support-faq-list">
        {faqs.map((faq) => (
          <article key={faq._id}>
            <div><span>{categoryLabels[faq.category]}</span><h3>{faq.question}</h3><p>{faq.answer}</p><small>{faq.helpfulCount} hữu ích · {faq.notHelpfulCount} chưa hữu ích</small></div>
            <aside><em className={faq.isPublished ? 'published' : ''}>{faq.isPublished ? 'Đang hiển thị' : 'Bản nháp'}</em><Button variant="secondary" onClick={() => onEdit(faq)}>Sửa</Button><Button variant="danger" onClick={() => void onDelete(faq._id)}>Ẩn/Xóa</Button></aside>
          </article>
        ))}
      </div>
    </section>
  )
}
