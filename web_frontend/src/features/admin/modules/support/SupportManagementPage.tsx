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
  listSupportAssignees,
  listSupportTickets,
  markSupportTicketRead,
  replySupportTicket,
  reorderAdminFaqs,
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
  SupportPerson,
  SupportSummary,
  SupportAnalytics,
  SupportTicket,
  SupportTicketDetail,
  SupportMessage,
  SupportTicketStatus,
  SupportTicketType,
} from './support.types'
import './support.css'
import { hasPermission, type AdminUser } from '../auth/adminSession'
import {
  PageHeader,
  Tabs,
  type TabItem,
} from '../../components/ui'
import { FaqEditorDialog } from './components/FaqEditorDialog'
import { SupportAnalyticsPanel } from './components/SupportAnalyticsPanel'
import { SupportCannedResponsesPanel } from './components/SupportCannedResponsesPanel'
import { SupportFaqPanel } from './components/SupportFaqPanel'
import { SupportInboxPanel } from './components/SupportInboxPanel'
import { SupportKpiSummary } from './components/SupportKpiSummary'
import { SupportTicketFilters } from './components/SupportTicketFilters'

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
  spam: 'neutral',
}

const priorityTones: Record<SupportPriority, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  low: 'neutral',
  normal: 'neutral',
  high: 'warning',
  urgent: 'danger',
}

const emptyCanned: CannedResponsePayload = { title: '', body: '', category: null, isActive: true }

const appendMessageOnce = (messages: SupportMessage[], message: SupportMessage) =>
  messages.some((item) => item._id === message._id) ? messages : [...messages, message]

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
  const [assignees, setAssignees] = useState<SupportPerson[]>([])
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
  const [faqCategory, setFaqCategory] = useState<FaqCategory | 'all'>('all')
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
  const submittingRef = useRef(false)

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
      setFaqs((await listAdminFaqs(faqSearch, faqCategory)).items)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể tải FAQ.')
    }
  }, [faqCategory, faqSearch])

  const loadCanned = useCallback(async () => {
    try { setCannedResponses(await listCannedResponses()) }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Không thể tải mẫu trả lời.') }
  }, [])

  const loadAnalytics = useCallback(async () => {
    try { setAnalytics(await getSupportAnalytics(dateFrom, dateTo)) }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Không thể tải báo cáo.') }
  }, [dateFrom, dateTo])

  useEffect(() => { if (tab === 'tickets') void loadTickets() }, [loadTickets, tab])
  useEffect(() => { void listSupportAssignees().then(setAssignees).catch(() => {}) }, [])
  useEffect(() => { if (tab === 'faqs') void loadFaqs() }, [loadFaqs, tab])
  useEffect(() => { if (canManage && (tab === 'canned' || tab === 'tickets')) void loadCanned() }, [canManage, loadCanned, tab])
  useEffect(() => { if (tab === 'analytics') void loadAnalytics() }, [loadAnalytics, tab])
  useEffect(() => { if (selectedId) void loadDetail(selectedId) }, [loadDetail, selectedId])
  useEffect(() => { if (!canManage && tab !== 'tickets') setTab('tickets') }, [canManage, tab])

  const realtime = useSupportRealtime({
    onMessage: (ticketId, message, isInternal) => {
      if (isInternal) {
        setDetail((prev) => prev && prev.ticket._id === ticketId
          ? { ...prev, messages: appendMessageOnce(prev.messages, message) }
          : prev)
        return
      }
      setDetail((prev) => prev && prev.ticket._id === ticketId
        ? { ...prev, messages: appendMessageOnce(prev.messages, message) }
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
    if (!selectedId || submittingRef.current) return
    submittingRef.current = true; setSubmitting(true)
    try {
      await updateSupportTicket(selectedId, payload)
      await Promise.all([loadDetail(selectedId), loadTickets()])
      requestAdminNotificationRefresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể cập nhật ticket.')
    } finally {
      submittingRef.current = false; setSubmitting(false)
    }
  }

  const sendReply = async () => {
    if (!selectedId || !reply.trim() || submittingRef.current) return
    const ticketId = selectedId
    const internal = isInternal
    submittingRef.current = true; setSubmitting(true)
    setError('')
    realtime.emitTyping(ticketId, false)
    try {
      const message = await replySupportTicket(ticketId, reply.trim(), internal, replyFiles, selectedCannedId || undefined)
      setReply('')
      setSelectedCannedId('')
      setReplyFiles([])
      setDetail((prev) => {
        if (!prev || prev.ticket._id !== ticketId) return prev
        const messages = appendMessageOnce(prev.messages, message)
        if (internal || new Date(prev.ticket.lastMessageAt).getTime() > new Date(message.createdAt).getTime()) {
          return messages === prev.messages ? prev : { ...prev, messages }
        }
        const status = ['open', 'in_progress'].includes(prev.ticket.status) ? 'waiting_customer' : prev.ticket.status
        return {
          ...prev,
          messages,
          ticket: {
            ...prev.ticket,
            status,
            requiresReply: false,
            lastMessageAt: message.createdAt,
            lastMessageSender: 'staff',
            updatedAt: message.createdAt,
          },
        }
      })
      if (!internal) {
        setTickets((prev) => prev.map((ticket) => {
          if (ticket._id !== ticketId || new Date(ticket.lastMessageAt).getTime() > new Date(message.createdAt).getTime()) return ticket
          return {
            ...ticket,
            status: ['open', 'in_progress'].includes(ticket.status) ? 'waiting_customer' : ticket.status,
            requiresReply: false,
            lastMessageAt: message.createdAt,
            lastMessageSender: 'staff',
            updatedAt: message.createdAt,
          }
        }))
      }
      loadSummaryOnly()
      requestAdminNotificationRefresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể gửi phản hồi.')
    } finally {
      submittingRef.current = false; setSubmitting(false)
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
    if (submittingRef.current) return
    submittingRef.current = true; setSubmitting(true)
    try {
      if (editingFaq) await updateAdminFaq(editingFaq._id, faqForm)
      else await createAdminFaq(faqForm)
      setFaqEditorOpen(false)
      await loadFaqs()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể lưu FAQ.')
    } finally {
      submittingRef.current = false; setSubmitting(false)
    }
  }

  const saveCanned = async () => {
    if (submittingRef.current) return
    submittingRef.current = true; setSubmitting(true)
    try {
      if (editingCannedId) await updateCannedResponse(editingCannedId, cannedForm)
      else await createCannedResponse(cannedForm)
      setEditingCannedId(null)
      setCannedForm(emptyCanned)
      await loadCanned()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể lưu mẫu trả lời.')
    } finally { submittingRef.current = false; setSubmitting(false) }
  }

  const moveFaq = async (faqId: string, direction: -1 | 1) => {
    const index = faqs.findIndex((faq) => faq._id === faqId)
    const target = index + direction
    if (index < 0 || target < 0 || target >= faqs.length) return
    const next = [...faqs]
    ;[next[index], next[target]] = [next[target], next[index]]
    setFaqs(next)
    try { await reorderAdminFaqs(next.map((faq) => faq._id)); await loadFaqs() }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Không thể đổi thứ tự FAQ.'); await loadFaqs() }
  }

  const handleReplyFiles = (files: File[]) => {
    if (files.length > 3) { setError('Chỉ được đính kèm tối đa 3 ảnh.'); return }
    if (files.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) { setError('Chỉ hỗ trợ ảnh JPEG, PNG hoặc WEBP.'); return }
    if (files.some((file) => file.size > 5 * 1024 * 1024)) { setError('Mỗi ảnh phải có dung lượng không quá 5MB.'); return }
    setReplyFiles(files)
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
          <SupportKpiSummary
            summary={summary}
            activeView={
              filters.assignedTo === currentUser._id
                ? 'mine'
                : filters.assignedTo === 'unassigned'
                  ? 'unassigned'
                  : filters.requiresReply === true
                    ? 'reply'
                    : 'all'
            }
            onSelectKpi={(view) => {
              if (view === 'reply') {
                setFilters((old) => ({ ...old, page: 1, requiresReply: true, assignedTo: 'all' }))
              } else if (view === 'unassigned') {
                setFilters((old) => ({ ...old, page: 1, assignedTo: 'unassigned', requiresReply: 'all' }))
              } else if (view === 'overdue') {
                const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
                setFilters((old) => ({ ...old, page: 1, status: 'open', dateTo: yesterday, assignedTo: 'all', requiresReply: 'all' }))
              } else {
                setFilters((old) => ({ ...old, page: 1, status: 'all', assignedTo: 'all', requiresReply: 'all', dateFrom: undefined, dateTo: undefined }))
              }
            }}
          />

          <SupportTicketFilters
            filters={filters}
            currentUserId={currentUser._id}
            canMarkSpam={canMarkSpam}
            statusLabels={statusLabels}
            priorityLabels={priorityLabels}
            categoryLabels={categoryLabels}
            typeLabels={typeLabels}
            assignees={assignees}
            onFiltersChange={(updater) => setFilters(updater)}
            onReset={() => setFilters({ page: 1, status: 'all' })}
            onRefresh={() => void loadTickets()}
          />

          <SupportInboxPanel
            tickets={tickets}
            ticketPagination={ticketPagination}
            selectedId={selectedId}
            detail={detail}
            loading={loading}
            detailLoading={detailLoading}
            submitting={submitting}
            canManage={canManage}
            canMarkSpam={canMarkSpam}
            currentUserId={currentUser._id}
            assignees={assignees}
            reply={reply}
            isInternal={isInternal}
            selectedCannedId={selectedCannedId}
            cannedResponses={cannedResponses}
            customerTypingTicketId={customerTypingTicketId}
            replyFiles={replyFiles}
            statusLabels={statusLabels}
            typeLabels={typeLabels}
            categoryLabels={categoryLabels}
            priorityLabels={priorityLabels}
            statusTones={statusTones}
            priorityTones={priorityTones}
            formatDate={formatDate}
            getPersonName={getPersonName}
            onSelectTicket={setSelectedId}
            onPageChange={(page) => setFilters((old) => ({ ...old, page }))}
            onMutateTicket={mutateTicket}
            onCannedChange={(id) => {
              setSelectedCannedId(id)
              const canned = cannedResponses.find((item) => item._id === id)
              if (canned) setReply(canned.body)
            }}
            onReplyChange={handleReplyChange}
            onInternalChange={setIsInternal}
            onFilesChange={handleReplyFiles}
            onSendReply={sendReply}
          />
        </>
      ) : tab === 'faqs' ? (
        <SupportFaqPanel
          faqs={faqs}
          faqSearch={faqSearch}
          faqCategory={faqCategory}
          categoryLabels={categoryLabels}
          onSearchChange={setFaqSearch}
          onCategoryChange={setFaqCategory}
          onCreate={() => openFaqEditor()}
          onEdit={openFaqEditor}
          onDelete={(faqId) => void deleteAdminFaq(faqId).then(loadFaqs)}
          onMove={moveFaq}
        />
      ) : tab === 'analytics' ? (
        <SupportAnalyticsPanel
          analytics={analytics}
          dateFrom={dateFrom}
          dateTo={dateTo}
          categoryLabels={categoryLabels}
          typeLabels={typeLabels}
          formatDuration={formatDuration}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          onApply={loadAnalytics}
        />
      ) : (
        <SupportCannedResponsesPanel
          cannedResponses={cannedResponses}
          cannedForm={cannedForm}
          editingCannedId={editingCannedId}
          submitting={submitting}
          categoryLabels={categoryLabels}
          onFormChange={setCannedForm}
          onSubmit={saveCanned}
          onCancelEdit={() => { setEditingCannedId(null); setCannedForm(emptyCanned) }}
          onEdit={(item) => {
            setEditingCannedId(item._id)
            setCannedForm({ title: item.title, body: item.body, category: item.category ?? null, isActive: item.isActive })
          }}
          onDelete={(id) => void deleteCannedResponse(id).then(loadCanned)}
        />
      )}

      {faqEditorOpen ? (
        <FaqEditorDialog
          isEditing={Boolean(editingFaq)}
          form={faqForm}
          categoryLabels={categoryLabels}
          submitting={submitting}
          onFormChange={setFaqForm}
          onClose={() => setFaqEditorOpen(false)}
          onSave={saveFaq}
        />
      ) : null}
    </section>
  )
}
