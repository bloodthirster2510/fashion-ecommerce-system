import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { requestAdminNotificationRefresh } from '../../notifications/notification-summary-events'
import { formatAdminDateTime } from '../../utils/dateTime'
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

type SupportTab = 'tickets' | 'faqs' | 'analytics' | 'canned'

const statusLabels: Record<SupportTicketStatus, string> = {
  open: 'Đã tiếp nhận',
  in_progress: 'Đang xử lý',
  waiting_customer: 'Chờ khách bổ sung',
  resolved: 'Đã giải quyết',
  closed: 'Đã đóng',
  spam: 'Thư rác',
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
  promotions: 'Ưu đãi', loyalty: 'Thành viên', account: 'Tài khoản', product: 'Sản phẩm',
  app_website: 'Ứng dụng/trang web', service: 'Dịch vụ', other: 'Khác',
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

const emptyCanned: CannedResponsePayload = { title: '', body: '', category: null, isActive: true }

const appendMessageOnce = (messages: SupportMessage[], message: SupportMessage) =>
  messages.some((item) => item._id === message._id) ? messages : [...messages, message]

const getSupportErrorMessage = (caught: unknown, fallback: string) => {
  if (!(caught instanceof Error)) return fallback
  const exactMessages: Record<string, string> = {
    'Ticket not found': 'Không tìm thấy yêu cầu hỗ trợ.',
    'This ticket cannot receive messages': 'Yêu cầu này đã kết thúc nên không thể nhận thêm tin nhắn.',
    'Canned response not found': 'Mẫu trả lời không còn tồn tại hoặc đã bị tắt.',
    'Only admin can mark spam': 'Chỉ quản trị viên mới có thể đánh dấu thư rác.',
    'Only admin can restore a spam ticket': 'Chỉ quản trị viên mới có thể khôi phục yêu cầu từ thư rác.',
    'Reply to the customer before setting waiting customer': 'Hãy phản hồi khách trước khi chuyển sang trạng thái chờ khách bổ sung.',
    'Assignee is not an active support admin/staff member': 'Người được chọn hiện không thể xử lý yêu cầu hỗ trợ.',
    'dateFrom must not be after dateTo': 'Ngày bắt đầu không được sau ngày kết thúc.',
    'FAQ not found': 'Không tìm thấy bài hướng dẫn.',
    'FAQ list changed while reordering': 'Danh sách vừa thay đổi. Vui lòng thử sắp xếp lại.',
  }
  if (exactMessages[caught.message]) return exactMessages[caught.message]
  if (/must contain|is invalid|must be|Cannot transition/i.test(caught.message)) return fallback
  return caught.message
}

const formatDate = (value: string) => formatAdminDateTime(value)

const formatDuration = (value = 0) => value <= 0
  ? '—'
  : value < 60000
    ? 'Dưới 1 phút'
    : value < 60 * 60 * 1000
      ? `${Math.round(value / 60000)} phút`
      : value < 24 * 60 * 60 * 1000
        ? `${(value / 3600000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} giờ`
        : `${(value / (24 * 60 * 60 * 1000)).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} ngày`

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
  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const typingTicketRef = useRef<string | null>(null)
  const selectedIdRef = useRef<string | null>(null)
  const ticketRequestRef = useRef(0)
  const detailRequestRef = useRef(0)
  const faqRequestRef = useRef(0)
  const submittingRef = useRef(false)

  useEffect(() => { selectedIdRef.current = selectedId }, [selectedId])

  const loadTickets = useCallback(async () => {
    const requestId = ++ticketRequestRef.current
    setLoading(true)
    setError('')
    try {
      const [list, nextSummary] = await Promise.all([listSupportTickets(filters), getSupportSummary()])
      if (requestId !== ticketRequestRef.current) return
      setTickets(list.items)
      setTicketPagination(list.pagination)
      setSummary(nextSummary)
      const currentId = selectedIdRef.current
      const nextId = currentId && list.items.some((item) => item._id === currentId)
        ? currentId
        : list.items[0]?._id ?? null
      if (nextId !== currentId) {
        selectedIdRef.current = nextId
        setSelectedId(nextId)
        setDetail(null)
        setReply('')
        setIsInternal(false)
        setReplyFiles([])
        setSelectedCannedId('')
      }
    } catch (caught) {
      if (requestId === ticketRequestRef.current) {
        setError(getSupportErrorMessage(caught, 'Không thể tải danh sách hỗ trợ.'))
      }
    } finally {
      if (requestId === ticketRequestRef.current) setLoading(false)
    }
  }, [filters])

  const loadDetail = useCallback(async (id: string) => {
    const requestId = ++detailRequestRef.current
    setDetailLoading(true)
    setError('')
    try {
      const nextDetail = await getSupportTicket(id)
      if (requestId === detailRequestRef.current && selectedIdRef.current === id) setDetail(nextDetail)
    } catch (caught) {
      if (requestId === detailRequestRef.current) {
        setError(getSupportErrorMessage(caught, 'Không thể tải nội dung yêu cầu.'))
      }
    } finally {
      if (requestId === detailRequestRef.current) setDetailLoading(false)
    }
  }, [])

  const loadFaqs = useCallback(async () => {
    const requestId = ++faqRequestRef.current
    try {
      const result = await listAdminFaqs(faqSearch, faqCategory)
      if (requestId === faqRequestRef.current) setFaqs(result.items)
    } catch (caught) {
      if (requestId === faqRequestRef.current) setError(getSupportErrorMessage(caught, 'Không thể tải bài hướng dẫn.'))
    }
  }, [faqCategory, faqSearch])

  const loadCanned = useCallback(async () => {
    try { setCannedResponses(await listCannedResponses(!canManage)) }
    catch (caught) { setError(getSupportErrorMessage(caught, 'Không thể tải mẫu trả lời.')) }
  }, [canManage])

  const loadAnalytics = useCallback(async () => {
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setError('Ngày bắt đầu không được sau ngày kết thúc.')
      return
    }
    setError('')
    try { setAnalytics(await getSupportAnalytics(dateFrom, dateTo)) }
    catch (caught) { setError(getSupportErrorMessage(caught, 'Không thể tải báo cáo.')) }
  }, [dateFrom, dateTo])

  useEffect(() => {
    if (tab !== 'tickets') return
    const timer = setTimeout(() => { void loadTickets() }, filters.search?.trim() ? 300 : 0)
    return () => clearTimeout(timer)
  }, [filters.search, loadTickets, tab])
  useEffect(() => {
    void listSupportAssignees().then(setAssignees).catch((caught) => {
      setError(getSupportErrorMessage(caught, 'Không thể tải danh sách người xử lý.'))
    })
  }, [])
  useEffect(() => {
    if (tab !== 'faqs') return
    const timer = setTimeout(() => { void loadFaqs() }, faqSearch.trim() ? 300 : 0)
    return () => clearTimeout(timer)
  }, [faqSearch, loadFaqs, tab])
  useEffect(() => { if (tab === 'canned' || tab === 'tickets') void loadCanned() }, [loadCanned, tab])
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
    onTyping: (ticketId, isTyping, senderId, scope) => {
      if (scope !== 'customer' || senderId === currentUser._id) return
      if (isTyping) {
        setCustomerTypingTicketId(ticketId)
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
        typingTimerRef.current = setTimeout(() => setCustomerTypingTicketId(null), 4000)
      } else {
        setCustomerTypingTicketId((current) => current === ticketId ? null : current)
      }
    },
    onUpdated: (ticketId, ticket) => {
      setTickets((prev) => prev.map((item) => item._id === ticketId ? { ...item, ...ticket } : item))
      setDetail((prev) => prev && prev.ticket._id === ticketId ? { ...prev, ticket: { ...prev.ticket, ...ticket } } : prev)
      loadSummaryOnly()
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
        const currentId = selectedIdRef.current
        const nextId = currentId && list.items.some((item) => item._id === currentId)
          ? currentId
          : list.items[0]?._id ?? null
        if (nextId !== currentId) {
          selectedIdRef.current = nextId
          setSelectedId(nextId)
          setDetail(null)
          setReply('')
          setIsInternal(false)
          setReplyFiles([])
          setSelectedCannedId('')
        }
      } catch { /* ignore realtime refresh errors */ }
    }, 600)
  }, [filters])

  useEffect(() => {
    if (selectedId) realtime.subscribeTicket(selectedId)
    return () => { if (selectedId) realtime.unsubscribeTicket(selectedId) }
  }, [selectedId, realtime])

  useEffect(() => {
    if (!selectedId || !detail) return
    const lastMessageAt = new Date(detail.ticket.lastMessageAt).getTime()
    const staffLastReadAt = detail.ticket.staffLastReadAt ? new Date(detail.ticket.staffLastReadAt).getTime() : 0
    if (detail.ticket.lastMessageSender !== 'customer' || staffLastReadAt >= lastMessageAt) return
    void markSupportTicketRead(selectedId).then((ticket) => {
      setDetail((current) => current && current.ticket._id === selectedId
        ? { ...current, ticket: { ...current.ticket, staffLastReadAt: ticket.staffLastReadAt } }
        : current)
      setTickets((current) => current.map((item) => item._id === selectedId
        ? { ...item, staffLastReadAt: ticket.staffLastReadAt }
        : item))
    }).catch(() => {})
  }, [selectedId, detail])

  const handleReplyChange = (value: string) => {
    setReply(value)
    if (!selectedId) return
    const isTyping = value.trim().length > 0
    if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current)
    if (isTyping && typingTicketRef.current !== selectedId) {
      if (typingTicketRef.current) realtime.emitTyping(typingTicketRef.current, false)
      realtime.emitTyping(selectedId, true)
      typingTicketRef.current = selectedId
    }
    if (!isTyping && typingTicketRef.current === selectedId) {
      realtime.emitTyping(selectedId, false)
      typingTicketRef.current = null
      return
    }
    if (isTyping) {
      typingStopTimerRef.current = setTimeout(() => {
        realtime.emitTyping(selectedId, false)
        if (typingTicketRef.current === selectedId) typingTicketRef.current = null
      }, 2500)
    }
  }

  const handleSelectTicket = (ticketId: string) => {
    if (ticketId === selectedId) return
    if (typingTicketRef.current) realtime.emitTyping(typingTicketRef.current, false)
    if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current)
    typingTicketRef.current = null
    setReply('')
    setIsInternal(false)
    setReplyFiles([])
    setSelectedCannedId('')
    setDetail(null)
    setSelectedId(ticketId)
  }

  useEffect(() => () => {
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current)
    if (typingTicketRef.current) realtime.emitTyping(typingTicketRef.current, false)
  }, [realtime])

  const queueCount = useMemo(() => summary?.waitingAdmin ?? 0, [summary])
  const supportTabs: Array<TabItem<SupportTab>> = [
    { value: 'tickets', label: 'Yêu cầu', badge: queueCount || undefined },
    ...(canManage ? [
      { value: 'faqs' as const, label: 'Hướng dẫn' },
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
      setError(getSupportErrorMessage(caught, 'Không thể cập nhật yêu cầu.'))
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
      setError(getSupportErrorMessage(caught, 'Không thể gửi phản hồi.'))
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
      setError(getSupportErrorMessage(caught, 'Không thể lưu bài hướng dẫn.'))
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
      setError(getSupportErrorMessage(caught, 'Không thể lưu mẫu trả lời.'))
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
    catch (caught) { setError(getSupportErrorMessage(caught, 'Không thể đổi thứ tự bài hướng dẫn.')); await loadFaqs() }
  }

  const removeFaq = async (faqId: string) => {
    if (!window.confirm('Gỡ bài hướng dẫn này khỏi trang hỗ trợ?')) return
    setError('')
    try { await deleteAdminFaq(faqId); await loadFaqs() }
    catch (caught) { setError(getSupportErrorMessage(caught, 'Không thể gỡ bài hướng dẫn.')) }
  }

  const removeCanned = async (id: string) => {
    if (!window.confirm('Xóa mẫu trả lời này? Thao tác này không thể hoàn tác.')) return
    setError('')
    try { await deleteCannedResponse(id); await loadCanned() }
    catch (caught) { setError(getSupportErrorMessage(caught, 'Không thể xóa mẫu trả lời.')) }
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
        actions={<Tabs items={supportTabs} value={tab} onChange={setTab} ariaLabel="Khu vực hỗ trợ" />}
      />

      {error && <div className="admin-support-error" role="alert">{error}<button type="button" onClick={() => setError('')}>Đóng</button></div>}

      {tab === 'tickets' ? (
        <SupportInboxPanel
          tickets={tickets}
          ticketPagination={ticketPagination}
          selectedId={selectedId}
          detail={detail}
          loading={loading}
          detailLoading={detailLoading}
          submitting={submitting}
          canMarkSpam={canMarkSpam}
          currentUserId={currentUser._id}
          assignees={assignees}
          summary={summary}
          filters={filters}
          reply={reply}
          isInternal={isInternal}
          selectedCannedId={selectedCannedId}
          cannedResponses={cannedResponses}
          customerTypingTicketId={customerTypingTicketId}
          replyFiles={replyFiles}
          statusLabels={statusLabels}
          categoryLabels={categoryLabels}
          priorityLabels={priorityLabels}
          statusTones={statusTones}
          formatDate={formatDate}
          getPersonName={getPersonName}
          onSelectTicket={handleSelectTicket}
          onPageChange={(page) => setFilters((old) => ({ ...old, page }))}
          onFiltersChange={(updater) => setFilters(updater)}
          onRefresh={() => void loadTickets()}
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
          onDelete={removeFaq}
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
          onDelete={removeCanned}
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
