import { useCallback, useEffect, useMemo, useState } from 'react'
import { requestAdminNotificationRefresh } from '../../notifications/notification-summary-events'
import {
  createAdminFaq,
  deleteAdminFaq,
  getSupportSummary,
  getSupportTicket,
  listAdminFaqs,
  listSupportTickets,
  replySupportTicket,
  updateAdminFaq,
  updateSupportTicket,
  type SupportFilters,
} from './support.service'
import type {
  FaqArticle,
  FaqCategory,
  FaqPayload,
  SupportCategory,
  SupportPriority,
  SupportSummary,
  SupportTicket,
  SupportTicketDetail,
  SupportTicketStatus,
  SupportTicketType,
} from './support.types'
import './support.css'
import type { AdminUser } from '../auth/adminSession'

const statusLabels: Record<SupportTicketStatus, string> = {
  open: 'Đã tiếp nhận',
  in_progress: 'Đang xử lý',
  waiting_customer: 'Chờ khách bổ sung',
  resolved: 'Đã giải quyết',
  closed: 'Đã đóng',
  spam: 'Spam',
}

const typeLabels: Record<SupportTicketType, string> = {
  question: 'Câu hỏi',
  issue: 'Sự cố',
  complaint: 'Khiếu nại',
  feedback: 'Góp ý',
  suggestion: 'Đề xuất',
}

const categoryLabels: Record<SupportCategory | FaqCategory, string> = {
  orders: 'Đơn hàng', shipping: 'Giao hàng', returns: 'Đổi trả', payments: 'Thanh toán',
  promotions: 'Voucher', loyalty: 'Thành viên', account: 'Tài khoản', product: 'Sản phẩm',
  app_website: 'Ứng dụng/website', service: 'Dịch vụ', other: 'Khác',
}

const priorityLabels: Record<SupportPriority, string> = {
  low: 'Thấp', normal: 'Bình thường', high: 'Cao', urgent: 'Khẩn cấp',
}

const emptyFaq: FaqPayload = {
  question: '', answer: '', category: 'orders', keywords: [], sortOrder: 0, isPublished: false,
}

const formatDate = (value: string) => new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
}).format(new Date(value))

const getPersonName = (value: SupportTicket['userId']) =>
  typeof value === 'string' ? 'Khách hàng' : value.name || value.email

export function SupportManagementPage({ currentUser }: { currentUser: AdminUser }) {
  const [tab, setTab] = useState<'tickets' | 'faqs'>('tickets')
  const [filters, setFilters] = useState<SupportFilters>({ page: 1, status: 'all' })
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [summary, setSummary] = useState<SupportSummary | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<SupportTicketDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')
  const [reply, setReply] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [replyFiles, setReplyFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [faqs, setFaqs] = useState<FaqArticle[]>([])
  const [faqSearch, setFaqSearch] = useState('')
  const [faqForm, setFaqForm] = useState<FaqPayload>(emptyFaq)
  const [editingFaq, setEditingFaq] = useState<FaqArticle | null>(null)
  const [faqEditorOpen, setFaqEditorOpen] = useState(false)

  const loadTickets = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [list, nextSummary] = await Promise.all([listSupportTickets(filters), getSupportSummary()])
      setTickets(list.items)
      setSummary(nextSummary)
      if (!selectedId && list.items[0]) setSelectedId(list.items[0]._id)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể tải hàng đợi hỗ trợ.')
    } finally {
      setLoading(false)
    }
  }, [filters, selectedId])

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true)
    try {
      setDetail(await getSupportTicket(id))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể tải ticket.')
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const loadFaqs = useCallback(async () => {
    try {
      setFaqs((await listAdminFaqs(faqSearch)).items)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể tải FAQ.')
    }
  }, [faqSearch])

  useEffect(() => { if (tab === 'tickets') void loadTickets() }, [loadTickets, tab])
  useEffect(() => { if (tab === 'faqs') void loadFaqs() }, [loadFaqs, tab])
  useEffect(() => { if (selectedId) void loadDetail(selectedId) }, [loadDetail, selectedId])

  const selectedTicket = detail?.ticket
  const queueCount = useMemo(() => tickets.filter((ticket) => ticket.requiresReply).length, [tickets])

  const mutateTicket = async (payload: Parameters<typeof updateSupportTicket>[1]) => {
    if (!selectedId) return
    setSubmitting(true)
    try {
      await updateSupportTicket(selectedId, payload)
      await Promise.all([loadDetail(selectedId), loadTickets()])
      requestAdminNotificationRefresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể cập nhật ticket.')
    } finally {
      setSubmitting(false)
    }
  }

  const sendReply = async () => {
    if (!selectedId || !reply.trim()) return
    setSubmitting(true)
    try {
      await replySupportTicket(selectedId, reply.trim(), isInternal, replyFiles)
      setReply('')
      setReplyFiles([])
      await Promise.all([loadDetail(selectedId), loadTickets()])
      requestAdminNotificationRefresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể gửi phản hồi.')
    } finally {
      setSubmitting(false)
    }
  }

  const openFaqEditor = (faq?: FaqArticle) => {
    setEditingFaq(faq ?? null)
    setFaqForm(faq ? {
      question: faq.question, answer: faq.answer, category: faq.category, keywords: faq.keywords,
      sortOrder: faq.sortOrder, isPublished: faq.isPublished,
    } : emptyFaq)
    setFaqEditorOpen(true)
  }

  const saveFaq = async () => {
    setSubmitting(true)
    try {
      if (editingFaq) await updateAdminFaq(editingFaq._id, faqForm)
      else await createAdminFaq(faqForm)
      setFaqEditorOpen(false)
      await loadFaqs()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể lưu FAQ.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="admin-support-page">
      <header className="admin-support-header">
        <div>
          <p>CSKH</p>
          <h1>Hỗ trợ & phản hồi</h1>
          <span>Quản lý ticket khách hàng và nội dung câu hỏi thường gặp.</span>
        </div>
        <div className="admin-support-tabs" role="tablist" aria-label="Khu vực hỗ trợ">
          <button className={tab === 'tickets' ? 'is-active' : ''} onClick={() => setTab('tickets')} type="button">Ticket {queueCount ? `(${queueCount})` : ''}</button>
          <button className={tab === 'faqs' ? 'is-active' : ''} onClick={() => setTab('faqs')} type="button">FAQ</button>
        </div>
      </header>

      {error && <div className="admin-support-error" role="alert">{error}<button type="button" onClick={() => setError('')}>Đóng</button></div>}

      {tab === 'tickets' ? (
        <>
          <div className="admin-support-kpis">
            <Kpi label="Đang mở" value={summary?.totalOpen ?? 0} />
            <Kpi label="Chờ admin" value={summary?.waitingAdmin ?? 0} tone="danger" />
            <Kpi label="Chờ khách" value={summary?.waitingCustomer ?? 0} />
            <Kpi label="Quá 24 giờ" value={summary?.overdue ?? 0} tone="warning" />
          </div>

          <div className="admin-support-toolbar">
            <input aria-label="Tìm ticket" placeholder="Mã ticket, khách hàng, mã đơn..." value={filters.search ?? ''} onChange={(event) => setFilters((old) => ({ ...old, search: event.target.value, page: 1 }))} />
            <select aria-label="Lọc trạng thái" value={filters.status ?? 'all'} onChange={(event) => setFilters((old) => ({ ...old, status: event.target.value as SupportFilters['status'], page: 1 }))}>
              <option value="all">Tất cả trạng thái</option>
              {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <button type="button" onClick={() => void loadTickets()}>Làm mới</button>
          </div>

          <div className="admin-support-workspace">
            <aside className="admin-support-queue" aria-label="Danh sách ticket">
              {loading ? <p className="admin-support-empty">Đang tải ticket...</p> : tickets.length ? tickets.map((ticket) => (
                <button key={ticket._id} type="button" className={`admin-support-ticket${ticket._id === selectedId ? ' is-selected' : ''}${ticket.requiresReply ? ' needs-reply' : ''}`} onClick={() => setSelectedId(ticket._id)}>
                  <span className="admin-support-ticket-top"><strong>{ticket.ticketCode}</strong><time>{formatDate(ticket.lastMessageAt)}</time></span>
                  <b>{ticket.subject}</b>
                  <span>{getPersonName(ticket.userId)} · {categoryLabels[ticket.category]}</span>
                  <span className="admin-support-ticket-bottom"><em className={`status-${ticket.status}`}>{statusLabels[ticket.status]}</em><small>{priorityLabels[ticket.priority]}</small></span>
                </button>
              )) : <p className="admin-support-empty">Không có ticket phù hợp.</p>}
            </aside>

            <main className="admin-support-detail">
              {detailLoading ? <p className="admin-support-empty">Đang tải hội thoại...</p> : selectedTicket ? (
                <>
                  <header className="admin-support-detail-header">
                    <div><p>{selectedTicket.ticketCode}</p><h2>{selectedTicket.subject}</h2><span>{getPersonName(selectedTicket.userId)} · {typeLabels[selectedTicket.type]}</span></div>
                    <div className="admin-support-actions">
                      {!selectedTicket.assignedTo && <button style={{ minHeight: 40, border: 0, borderRadius: 9, padding: '0 12px', background: '#537f99', color: '#fff', fontWeight: 700 }} type="button" disabled={submitting} onClick={() => void mutateTicket({ assignedTo: currentUser._id })}>Nhận xử lý</button>}
                      <select aria-label="Mức ưu tiên" value={selectedTicket.priority} disabled={submitting} onChange={(event) => void mutateTicket({ priority: event.target.value as SupportPriority })}>
                        {Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                      <select aria-label="Trạng thái ticket" value={selectedTicket.status} disabled={submitting} onChange={(event) => void mutateTicket({ status: event.target.value as SupportTicketStatus })}>
                        {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </div>
                  </header>

                  {(selectedTicket.orderId || selectedTicket.couponCode || selectedTicket.context) && (
                    <div className="admin-support-context">
                      {selectedTicket.orderId && <span>Đơn: {typeof selectedTicket.orderId === 'string' ? selectedTicket.orderId : selectedTicket.orderId.orderCode}</span>}
                      {selectedTicket.couponCode && <span>Voucher: {selectedTicket.couponCode}</span>}
                      {selectedTicket.context?.source && <span>Nguồn: {selectedTicket.context.source}</span>}
                    </div>
                  )}

                  <div className="admin-support-thread">
                    {detail.messages.map((message) => (
                      <article key={message._id} className={`admin-support-message ${message.senderType}${message.isInternal ? ' internal' : ''}`}>
                        <header><strong>{message.isInternal ? 'Ghi chú nội bộ' : message.senderType === 'staff' ? 'Nhân viên hỗ trợ' : 'Khách hàng'}</strong><time>{formatDate(message.createdAt)}</time></header>
                        <p>{message.body}</p>
                        {message.attachments.length > 0 && <div className="admin-support-attachments">{message.attachments.map((file) => <a href={file.url} target="_blank" rel="noreferrer" key={file.publicId}><img src={file.url} alt="Ảnh đính kèm" /></a>)}</div>}
                      </article>
                    ))}
                  </div>

                  <div className="admin-support-composer">
                    <textarea rows={4} value={reply} onChange={(event) => setReply(event.target.value)} placeholder={isInternal ? 'Ghi chú chỉ nhân viên nhìn thấy...' : 'Nhập phản hồi cho khách hàng...'} maxLength={3000} />
                    <div>
                      <label><input type="checkbox" checked={isInternal} onChange={(event) => setIsInternal(event.target.checked)} /> Ghi chú nội bộ</label>
                      <label className="admin-support-file">Đính kèm ảnh<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setReplyFiles(Array.from(event.target.files ?? []).slice(0, 3))} /></label>
                      <button type="button" disabled={!reply.trim() || submitting} onClick={() => void sendReply()}>{submitting ? 'Đang gửi...' : isInternal ? 'Lưu ghi chú' : 'Gửi phản hồi'}</button>
                    </div>
                  </div>
                </>
              ) : <p className="admin-support-empty">Chọn một ticket để xem chi tiết.</p>}
            </main>
          </div>
        </>
      ) : (
        <section className="admin-support-faqs">
          <div className="admin-support-toolbar">
            <input aria-label="Tìm FAQ" placeholder="Tìm câu hỏi..." value={faqSearch} onChange={(event) => setFaqSearch(event.target.value)} />
            <button type="button" onClick={() => openFaqEditor()}>Thêm FAQ</button>
          </div>
          <div className="admin-support-faq-list">
            {faqs.map((faq) => (
              <article key={faq._id}>
                <div><span>{categoryLabels[faq.category]}</span><h3>{faq.question}</h3><p>{faq.answer}</p><small>{faq.helpfulCount} hữu ích · {faq.notHelpfulCount} chưa hữu ích</small></div>
                <aside><em className={faq.isPublished ? 'published' : ''}>{faq.isPublished ? 'Đang hiển thị' : 'Bản nháp'}</em><button type="button" onClick={() => openFaqEditor(faq)}>Sửa</button><button type="button" onClick={() => void deleteAdminFaq(faq._id).then(loadFaqs)}>Ẩn/Xóa</button></aside>
              </article>
            ))}
          </div>
        </section>
      )}

      {faqEditorOpen && (
        <div className="admin-support-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setFaqEditorOpen(false) }}>
          <section className="admin-support-dialog" role="dialog" aria-modal="true" aria-labelledby="faq-editor-title">
            <header><h2 id="faq-editor-title">{editingFaq ? 'Chỉnh sửa FAQ' : 'Thêm FAQ'}</h2><button type="button" onClick={() => setFaqEditorOpen(false)}>×</button></header>
            <label>Câu hỏi<input value={faqForm.question} onChange={(event) => setFaqForm((old) => ({ ...old, question: event.target.value }))} /></label>
            <label>Câu trả lời<textarea rows={7} value={faqForm.answer} onChange={(event) => setFaqForm((old) => ({ ...old, answer: event.target.value }))} /></label>
            <label>Chủ đề<select value={faqForm.category} onChange={(event) => setFaqForm((old) => ({ ...old, category: event.target.value as FaqCategory }))}>{Object.entries(categoryLabels).filter(([key]) => !['product', 'app_website', 'service'].includes(key)).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Từ khóa<input value={faqForm.keywords.join(', ')} onChange={(event) => setFaqForm((old) => ({ ...old, keywords: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) }))} placeholder="đơn hàng, giao hàng" /></label>
            <label className="admin-support-check"><input type="checkbox" checked={faqForm.isPublished} onChange={(event) => setFaqForm((old) => ({ ...old, isPublished: event.target.checked }))} /> Xuất bản cho khách hàng</label>
            <footer><button type="button" onClick={() => setFaqEditorOpen(false)}>Hủy</button><button type="button" disabled={submitting || faqForm.question.trim().length < 5 || faqForm.answer.trim().length < 10} onClick={() => void saveFaq()}>{submitting ? 'Đang lưu...' : 'Lưu FAQ'}</button></footer>
          </section>
        </div>
      )}
    </section>
  )
}

function Kpi({ label, value, tone = 'default' }: { label: string; value: number; tone?: 'default' | 'danger' | 'warning' }) {
  return <article className={`admin-support-kpi ${tone}`}><span>{label}</span><strong>{value}</strong></article>
}
