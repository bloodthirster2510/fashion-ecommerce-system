import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { requestAdminNotificationRefresh } from '../../notifications/notification-summary-events'
import {
  createAdminFaq,
  createCannedResponse,
  deleteAdminFaq,
  deleteCannedResponse,
  getSupportAnalytics,
  getSupportSummary,
  getSupportTicket,
  listAdminFaqs,
  listCannedResponses,
  listSupportTickets,
  markSupportTicketRead,
  replySupportTicket,
  updateAdminFaq,
  updateCannedResponse,
  updateSupportTicket,
  type SupportFilters,
} from './support.service'
import { useSupportRealtime } from './supportSocket'
import type {
  FaqArticle,
  FaqCategory,
  FaqPayload,
  CannedResponse,
  CannedResponsePayload,
  SupportCategory,
  SupportPriority,
  SupportSummary,
  SupportAnalytics,
  SupportTicket,
  SupportTicketDetail,
  SupportTicketStatus,
  SupportTicketType,
} from './support.types'
import './support.css'
import { hasPermission, type AdminUser } from '../auth/adminSession'
import {
  Button,
  EmptyState,
  Field,
  FilterBar,
  KpiCard,
  KpiGrid,
  PageHeader,
  Pagination,
  StatusBadge,
  Tabs,
  type TabItem,
} from '../../components/ui'

type SupportTab = 'tickets' | 'faqs' | 'analytics' | 'canned'

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

const statusTones: Record<SupportTicketStatus, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  open: 'info',
  in_progress: 'warning',
  waiting_customer: 'neutral',
  resolved: 'success',
  closed: 'neutral',
  spam: 'danger',
}

const priorityTones: Record<SupportPriority, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  low: 'neutral',
  normal: 'info',
  high: 'warning',
  urgent: 'danger',
}

const emptyCanned: CannedResponsePayload = { title: '', body: '', category: null, isActive: true }

const formatDate = (value: string) => new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
}).format(new Date(value))

const formatDuration = (value = 0) => value < 60 * 60 * 1000
  ? `${Math.round(value / 60000)} phút`
  : `${(value / 3600000).toFixed(1)} giờ`

const getPersonName = (ticket: SupportTicket) => {
  const value = ticket.userId
  if (!value) return ticket.guestContact?.name || ticket.guestContact?.email || 'Khách vãng lai'
  return typeof value === 'string' ? 'Khách hàng' : value.name || value.email
}

export function SupportManagementPage({ currentUser }: { currentUser: AdminUser }) {
  const [tab, setTab] = useState<SupportTab>('tickets')
  const canManage = hasPermission(currentUser, 'support.manage')
  const canMarkSpam = currentUser.role === 'admin'
  const [filters, setFilters] = useState<SupportFilters>({ page: 1, status: 'all' })
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [ticketPagination, setTicketPagination] = useState({ page: 1, limit: 20, totalItems: 0, totalPages: 1 })
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
  const [cannedResponses, setCannedResponses] = useState<CannedResponse[]>([])
  const [selectedCannedId, setSelectedCannedId] = useState('')
  const [cannedForm, setCannedForm] = useState<CannedResponsePayload>(emptyCanned)
  const [editingCannedId, setEditingCannedId] = useState<string | null>(null)
  const [analytics, setAnalytics] = useState<SupportAnalytics | null>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [customerTypingTicketId, setCustomerTypingTicketId] = useState<string | null>(null)
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadTickets = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [list, nextSummary] = await Promise.all([listSupportTickets(filters), getSupportSummary()])
      setTickets(list.items)
      setTicketPagination(list.pagination)
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

  const loadCanned = useCallback(async () => {
    try { setCannedResponses(await listCannedResponses()) }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Không thể tải mẫu trả lời.') }
  }, [])

  const loadAnalytics = useCallback(async () => {
    try { setAnalytics(await getSupportAnalytics(dateFrom, dateTo)) }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Không thể tải báo cáo.') }
  }, [dateFrom, dateTo])

  useEffect(() => { if (tab === 'tickets') void loadTickets() }, [loadTickets, tab])
  useEffect(() => { if (tab === 'faqs') void loadFaqs() }, [loadFaqs, tab])
  useEffect(() => { if (canManage && (tab === 'canned' || tab === 'tickets')) void loadCanned() }, [canManage, loadCanned, tab])
  useEffect(() => { if (tab === 'analytics') void loadAnalytics() }, [loadAnalytics, tab])
  useEffect(() => { if (selectedId) void loadDetail(selectedId) }, [loadDetail, selectedId])
  useEffect(() => { if (!canManage && tab !== 'tickets') setTab('tickets') }, [canManage, tab])

  const realtime = useSupportRealtime({
    onMessage: (ticketId, message, isInternal) => {
      if (isInternal) {
        setDetail((prev) => prev && prev.ticket._id === ticketId
          ? { ...prev, messages: [...prev.messages, message] }
          : prev)
        return
      }
      setDetail((prev) => prev && prev.ticket._id === ticketId
        ? { ...prev, messages: [...prev.messages, message] }
        : prev)
      setTickets((prev) => prev.map((t) => t._id === ticketId
        ? { ...t, lastMessageAt: message.createdAt, lastMessageSender: message.senderType, requiresReply: message.senderType === 'customer', updatedAt: message.createdAt }
        : t))
      setCustomerTypingTicketId(null)
    },
    onTyping: (ticketId, isTyping, senderId) => {
      if (senderId === currentUser._id) return
      if (isTyping) {
        setCustomerTypingTicketId(ticketId)
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
        typingTimerRef.current = setTimeout(() => setCustomerTypingTicketId(null), 4000)
      } else if (customerTypingTicketId === ticketId) {
        setCustomerTypingTicketId(null)
      }
    },
    onUpdated: (ticketId, ticket) => {
      setTickets((prev) => prev.some((t) => t._id === ticketId)
        ? prev.map((t) => (t._id === ticketId ? { ...t, ...ticket } : t))
        : [ticket, ...prev])
      setDetail((prev) => prev && prev.ticket._id === ticketId ? { ...prev, ticket: { ...prev.ticket, ...ticket } } : prev)
    },
    onSummary: () => { void loadSummaryOnly() },
  })

  const summaryDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loadSummaryOnly = useCallback(() => {
    if (summaryDebounceRef.current) clearTimeout(summaryDebounceRef.current)
    summaryDebounceRef.current = setTimeout(async () => {
      try {
        const [list, nextSummary] = await Promise.all([listSupportTickets(filters), getSupportSummary()])
        setTickets(list.items)
        setTicketPagination(list.pagination)
        setSummary(nextSummary)
      } catch { /* ignore realtime refresh errors */ }
    }, 600)
  }, [filters])

  useEffect(() => {
    if (selectedId) realtime.subscribeTicket(selectedId)
    return () => { if (selectedId) realtime.unsubscribeTicket(selectedId) }
  }, [selectedId, realtime])

  useEffect(() => {
    if (!selectedId || !detail) return
    if (detail.ticket.lastMessageSender === 'customer' && detail.ticket.requiresReply) {
      void markSupportTicketRead(selectedId).catch(() => {})
    }
  }, [selectedId, detail])

  const handleReplyChange = (value: string) => {
    setReply(value)
    if (selectedId) realtime.emitTyping(selectedId, value.trim().length > 0)
  }

  const selectedTicket = detail?.ticket
  const queueCount = useMemo(() => tickets.filter((ticket) => ticket.requiresReply).length, [tickets])
  const supportTabs: Array<TabItem<SupportTab>> = [
    { value: 'tickets', label: 'Ticket', badge: queueCount || undefined },
    ...(canManage ? [
      { value: 'faqs' as const, label: 'FAQ' },
      { value: 'canned' as const, label: 'Mẫu trả lời' },
      { value: 'analytics' as const, label: 'Báo cáo' },
    ] : []),
  ]

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
      await replySupportTicket(selectedId, reply.trim(), isInternal, replyFiles, selectedCannedId || undefined)
      setReply('')
      setSelectedCannedId('')
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

  const saveCanned = async () => {
    setSubmitting(true)
    try {
      if (editingCannedId) await updateCannedResponse(editingCannedId, cannedForm)
      else await createCannedResponse(cannedForm)
      setEditingCannedId(null)
      setCannedForm(emptyCanned)
      await loadCanned()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể lưu mẫu trả lời.')
    } finally { setSubmitting(false) }
  }

  return (
    <section className="admin-ui-page admin-support-page">
      <PageHeader
        title="Hỗ trợ khách hàng"
        description="Quản lý ticket, phản hồi khách hàng, mẫu trả lời và nội dung FAQ trong cùng một hàng đợi."
        breadcrumbs={['CSKH', 'Hỗ trợ']}
        actions={<Tabs items={supportTabs} value={tab} onChange={setTab} ariaLabel="Khu vực hỗ trợ" />}
      />

      {error && <div className="admin-support-error" role="alert">{error}<button type="button" onClick={() => setError('')}>Đóng</button></div>}

      {tab === 'tickets' ? (
        <>
          <KpiGrid>
            <KpiCard label="Đang mở" value={summary?.totalOpen ?? 0} meta="Ticket chưa hoàn tất" />
            <KpiCard label="Chờ phản hồi" value={summary?.waitingAdmin ?? 0} meta="Cần CSKH xử lý" />
            <KpiCard label="Chờ khách" value={summary?.waitingCustomer ?? 0} meta="Đang đợi khách bổ sung" />
            <KpiCard label="Quá 24 giờ" value={summary?.overdue ?? 0} meta="Cần ưu tiên kiểm tra" />
          </KpiGrid>

          <FilterBar>
            <Field label="Tìm ticket" grow>
              <input aria-label="Tìm ticket" placeholder="Mã ticket, khách hàng, mã đơn..." value={filters.search ?? ''} onChange={(event) => setFilters((old) => ({ ...old, search: event.target.value, page: 1 }))} />
            </Field>
            <Field label="Trạng thái">
              <select aria-label="Lọc trạng thái" value={filters.status ?? 'all'} onChange={(event) => setFilters((old) => ({ ...old, status: event.target.value as SupportFilters['status'], page: 1 }))}>
                <option value="all">Tất cả trạng thái</option>
                {Object.entries(statusLabels)
                  .filter(([value]) => canMarkSpam || value !== 'spam')
                  .map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
            <Field label="Ưu tiên">
              <select aria-label="Lọc ưu tiên" value={filters.priority ?? 'all'} onChange={(event) => setFilters((old) => ({ ...old, priority: event.target.value as SupportFilters['priority'], page: 1 }))}>
                <option value="all">Tất cả mức</option>
                {Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
            <Field label="Danh mục">
              <select aria-label="Lọc danh mục" value={filters.category ?? 'all'} onChange={(event) => setFilters((old) => ({ ...old, category: event.target.value as SupportFilters['category'], page: 1 }))}>
                <option value="all">Tất cả danh mục</option>
                {Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
            <Button variant="secondary" onClick={() => setFilters({ page: 1, status: 'all' })}>
              Xóa lọc
            </Button>
            <Button variant="secondary" onClick={() => void loadTickets()}>
              Làm mới
            </Button>
          </FilterBar>

          <div className="admin-support-workspace">
            <aside className="admin-support-queue" aria-label="Danh sách ticket">
              {loading ? <p className="admin-support-empty">Đang tải ticket...</p> : tickets.length ? tickets.map((ticket) => (
                <button key={ticket._id} type="button" className={`admin-support-ticket${ticket._id === selectedId ? ' is-selected' : ''}${ticket.requiresReply ? ' needs-reply' : ''}`} onClick={() => setSelectedId(ticket._id)}>
                  <span className="admin-support-ticket-top"><strong>{ticket.ticketCode}</strong><time>{formatDate(ticket.lastMessageAt)}</time></span>
                  <b>{ticket.subject}</b>
                  <span>{getPersonName(ticket)} · {categoryLabels[ticket.category]}</span>
                  <span className="admin-support-ticket-bottom">
                    <StatusBadge tone={statusTones[ticket.status]}>{statusLabels[ticket.status]}</StatusBadge>
                    <StatusBadge tone={priorityTones[ticket.priority]}>{priorityLabels[ticket.priority]}</StatusBadge>
                  </span>
                </button>
              )) : (
                <EmptyState
                  title="Không có ticket phù hợp"
                  description="Thử đổi bộ lọc hoặc làm mới hàng đợi để kiểm tra ticket mới."
                />
              )}
              {ticketPagination.totalPages > 1 ? (
                <Pagination
                  page={ticketPagination.page}
                  totalPages={ticketPagination.totalPages}
                  totalItems={ticketPagination.totalItems}
                  isDisabled={loading}
                  onPageChange={(page) => setFilters((old) => ({ ...old, page }))}
                />
              ) : null}
            </aside>

            <main className="admin-support-detail">
              {detailLoading ? <p className="admin-support-empty">Đang tải hội thoại...</p> : selectedTicket ? (
                <>
                  <header className="admin-support-detail-header">
                    <div>
                      <p>{selectedTicket.ticketCode}</p>
                      <h2>{selectedTicket.subject}</h2>
                      <span>{getPersonName(selectedTicket)} · {typeLabels[selectedTicket.type]}</span>
                      <div className="admin-support-detail-badges">
                        <StatusBadge tone={statusTones[selectedTicket.status]}>{statusLabels[selectedTicket.status]}</StatusBadge>
                        <StatusBadge tone={priorityTones[selectedTicket.priority]}>{priorityLabels[selectedTicket.priority]}</StatusBadge>
                        {selectedTicket.requiresReply ? <StatusBadge tone="danger">Cần phản hồi</StatusBadge> : null}
                      </div>
                    </div>
                    <div className="admin-support-actions">
                      {!selectedTicket.assignedTo && (
                        <Button variant="primary" disabled={submitting} onClick={() => void mutateTicket({ assignedTo: currentUser._id })}>
                          Nhận xử lý
                        </Button>
                      )}
                      <select aria-label="Mức ưu tiên" value={selectedTicket.priority} disabled={submitting} onChange={(event) => void mutateTicket({ priority: event.target.value as SupportPriority })}>
                        {Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                      <select aria-label="Trạng thái ticket" value={selectedTicket.status} disabled={submitting} onChange={(event) => void mutateTicket({ status: event.target.value as SupportTicketStatus })}>
                        {Object.entries(statusLabels)
                          .filter(([value]) => canMarkSpam || value !== 'spam' || selectedTicket.status === 'spam')
                          .map(([value, label]) => <option key={value} value={value} disabled={!canMarkSpam && value === 'spam'}>{label}</option>)}
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
                    {customerTypingTicketId === selectedTicket._id && (
                      <p className="admin-support-typing" aria-live="polite">Khách hàng đang gõ...</p>
                    )}
                  </div>

                  <div className="admin-support-composer">
                    {canManage && <select value={selectedCannedId} onChange={(event) => {
                      const id = event.target.value
                      setSelectedCannedId(id)
                      const canned = cannedResponses.find((item) => item._id === id)
                      if (canned) setReply(canned.body)
                    }} aria-label="Chọn mẫu trả lời">
                      <option value="">Chọn mẫu trả lời nhanh...</option>
                      {cannedResponses.filter((item) => item.isActive && (!item.category || item.category === selectedTicket.category)).map((item) => <option key={item._id} value={item._id}>{item.title}</option>)}
                    </select>}
                    <textarea rows={4} value={reply} onChange={(event) => handleReplyChange(event.target.value)} placeholder={isInternal ? 'Ghi chú chỉ nhân viên nhìn thấy...' : 'Nhập phản hồi cho khách hàng...'} maxLength={3000} />
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
      ) : tab === 'faqs' ? (
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
      ) : tab === 'analytics' ? (
        <section className="admin-support-report">
          <div className="admin-support-toolbar">
            <label>Từ ngày<input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
            <label>Đến ngày<input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
            <button type="button" onClick={() => void loadAnalytics()}>Áp dụng</button>
          </div>
          <div className="admin-support-kpis">
            <Kpi label="Tổng ticket" value={analytics?.tickets.total ?? 0} />
            <Kpi label="Đã phản hồi" value={analytics?.tickets.responded ?? 0} />
            <Kpi label="Phản hồi đầu" value={formatDuration(analytics?.tickets.avgFirstResponseMs)} />
            <Kpi label="Thời gian xử lý" value={formatDuration(analytics?.tickets.avgResolutionMs)} />
          </div>
          <div className="admin-support-report-grid">
            <ReportBreakdown title="Theo danh mục" items={(analytics?.byCategory ?? []).map((item) => ({ label: categoryLabels[item.key], count: item.count }))} />
            <ReportBreakdown title="Theo loại" items={(analytics?.byType ?? []).map((item) => ({ label: typeLabels[item.key], count: item.count }))} />
            <ReportBreakdown title="Lượng ticket theo ngày" items={(analytics?.dailyVolume ?? []).map((item) => ({ label: item.date, count: item.count }))} />
            <article className="admin-support-report-card"><h3>FAQ hữu ích</h3><strong>{Math.round((analytics?.faq.helpfulRate ?? 0) * 100)}%</strong><p>{analytics?.faq.helpful ?? 0}/{analytics?.faq.totalVotes ?? 0} lượt đánh giá hữu ích</p></article>
          </div>
        </section>
      ) : (
        <section className="admin-support-canned">
          <form onSubmit={(event) => { event.preventDefault(); void saveCanned() }} className="admin-support-canned-form">
            <h2>{editingCannedId ? 'Sửa mẫu trả lời' : 'Thêm mẫu trả lời'}</h2>
            <input aria-label="Tên mẫu" placeholder="Tên mẫu" value={cannedForm.title} onChange={(event) => setCannedForm((old) => ({ ...old, title: event.target.value }))} />
            <select aria-label="Danh mục mẫu" value={cannedForm.category ?? ''} onChange={(event) => setCannedForm((old) => ({ ...old, category: (event.target.value || null) as SupportCategory | null }))}>
              <option value="">Tất cả danh mục</option>
              {Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <textarea rows={6} placeholder="Nội dung trả lời" value={cannedForm.body} onChange={(event) => setCannedForm((old) => ({ ...old, body: event.target.value }))} />
            <label><input type="checkbox" checked={cannedForm.isActive} onChange={(event) => setCannedForm((old) => ({ ...old, isActive: event.target.checked }))} /> Đang sử dụng</label>
            <div><button type="submit" disabled={submitting || cannedForm.title.trim().length < 2 || cannedForm.body.trim().length < 2}>Lưu mẫu</button>{editingCannedId && <button type="button" onClick={() => { setEditingCannedId(null); setCannedForm(emptyCanned) }}>Hủy</button>}</div>
          </form>
          <div className="admin-support-canned-list">
            {cannedResponses.map((item) => <article key={item._id}><div><h3>{item.title}</h3><p>{item.body}</p><small>{item.category ? categoryLabels[item.category] : 'Tất cả danh mục'} · đã dùng {item.useCount} lần · {item.isActive ? 'đang bật' : 'đã tắt'}</small></div><aside><button type="button" onClick={() => { setEditingCannedId(item._id); setCannedForm({ title: item.title, body: item.body, category: item.category ?? null, isActive: item.isActive }) }}>Sửa</button><button type="button" onClick={() => void deleteCannedResponse(item._id).then(loadCanned)}>Xóa</button></aside></article>)}
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

function Kpi({ label, value, tone = 'default' }: { label: string; value: number | string; tone?: 'default' | 'danger' | 'warning' }) {
  return <article className={`admin-support-kpi ${tone}`}><span>{label}</span><strong>{value}</strong></article>
}

function ReportBreakdown({ title, items }: { title: string; items: Array<{ label: string; count: number }> }) {
  const max = Math.max(1, ...items.map((item) => item.count))
  return <article className="admin-support-report-card"><h3>{title}</h3>{items.length ? items.map((item) => <div className="admin-support-report-row" key={item.label}><span>{item.label}</span><i><b style={{ width: `${item.count / max * 100}%` }} /></i><strong>{item.count}</strong></div>) : <p>Chưa có dữ liệu.</p>}</article>
}
