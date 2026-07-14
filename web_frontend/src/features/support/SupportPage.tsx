import { useCallback, useEffect, useRef, useState } from 'react'
import { MainLayout } from '../../layouts/MainLayout'
import { useAppSelector } from '../../app/hooks'
import { ProfileSidebar } from '../profile/components/ProfileSidebar'
import {
  addMyMessage,
  closeMyTicket,
  createMyTicket,
  createGuestFeedback,
  getMySupportSummary,
  getMyTicket,
  listFaqs,
  listMyTickets,
  markMyTicketRead,
  reopenMyTicket,
  voteFaq,
  verifyGuestFeedback,
} from './support.service'
import { useCustomerSupportRealtime } from './supportSocket'
import type { FaqArticle, SupportCategory, SupportMessage, SupportSummary, SupportTicket, SupportTicketType, TicketDetail } from './support.types'
import './support.css'

const topics: Array<[string, string]> = [['orders', 'Đơn hàng'], ['shipping', 'Giao hàng'], ['returns', 'Đổi trả'], ['payments', 'Thanh toán'], ['promotions', 'Voucher'], ['loyalty', 'Thành viên'], ['account', 'Tài khoản'], ['other', 'Khác']]
const typeLabels: Array<[SupportTicketType, string]> = [['question', 'Câu hỏi'], ['issue', 'Sự cố'], ['complaint', 'Khiếu nại'], ['feedback', 'Góp ý'], ['suggestion', 'Đề xuất']]
const categoryLabels: Array<[SupportCategory, string]> = [
  ['orders', 'Đơn hàng'], ['shipping', 'Giao hàng'], ['returns', 'Đổi trả'],
  ['payments', 'Thanh toán'], ['promotions', 'Voucher'], ['loyalty', 'Thành viên'],
  ['account', 'Tài khoản'], ['product', 'Sản phẩm'], ['app_website', 'Ứng dụng / website'],
  ['service', 'Dịch vụ'], ['other', 'Khác'],
]
const statusLabels: Record<string, string> = { open: 'Đã tiếp nhận', in_progress: 'Đang xử lý', waiting_customer: 'Cần bạn bổ sung', resolved: 'Đã giải quyết', closed: 'Đã đóng' }

const navigate = (path: string) => {
  window.history.pushState(null, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function SupportPage() {
  const currentUser = useAppSelector((state) => state.auth.currentUser)
  const path = window.location.pathname
  const accountMode = path.startsWith('/account/support')
  const ticketId = path.match(/^\/account\/support\/tickets\/([^/]+)$/)?.[1]
  const createMode = path === '/account/support/new'
  const guestFeedbackMode = path === '/support/feedback'
  const verifyMode = path === '/support/verify'
  const query = new URLSearchParams(window.location.search)
  const requestedCategory = query.get('category') as SupportCategory | null
  const initialCategory = categoryLabels.some(([value]) => value === requestedCategory) ? requestedCategory ?? 'other' : 'other'
  const initialOrderId = query.get('orderId') ?? ''
  const initialCouponCode = query.get('couponCode') ?? ''
  const initialErrorCode = query.get('errorCode') ?? ''
  const requestedSource = query.get('source')
  const contextSource = ['support_home', 'order_detail', 'payment_result', 'coupon', 'loyalty', 'error_screen', 'footer'].includes(requestedSource ?? '')
    ? requestedSource as 'support_home' | 'order_detail' | 'payment_result' | 'coupon' | 'loyalty' | 'error_screen' | 'footer'
    : 'support_home'
  const [faqs, setFaqs] = useState<FaqArticle[]>([])
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [summary, setSummary] = useState<SupportSummary | null>(null)
  const [detail, setDetail] = useState<TicketDetail | null>(null)
  const [search, setSearch] = useState('')
  const [topic, setTopic] = useState(() => new URLSearchParams(window.location.search).get('topic') ?? '')
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadHome = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const faqResult = await listFaqs(search, topic)
      setFaqs(faqResult.items)
      if (currentUser) {
        const [ticketResult, nextSummary] = await Promise.all([listMyTickets(), getMySupportSummary()])
        setTickets(ticketResult.items); setSummary(nextSummary)
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Không thể tải hỗ trợ.') }
    finally { setLoading(false) }
  }, [currentUser, search, topic])

  useEffect(() => { if (!ticketId && !createMode && !guestFeedbackMode && !verifyMode) void loadHome() }, [createMode, guestFeedbackMode, loadHome, ticketId, verifyMode])
  useEffect(() => {
    if (!ticketId || !currentUser) return
    setLoading(true)
    getMyTicket(ticketId).then(async (value) => { setDetail(value); if (value.ticket.lastMessageSender === 'staff') await markMyTicketRead(ticketId) }).catch((caught) => setError(caught instanceof Error ? caught.message : 'Không thể tải ticket.')).finally(() => setLoading(false))
  }, [currentUser, ticketId])

  const content = accountMode && !currentUser ? <AccountSupportLoginRequired />
    : verifyMode ? <GuestVerification />
    : guestFeedbackMode ? <GuestFeedbackForm />
    : createMode ? <TicketForm initialCategory={initialCategory} initialOrderId={initialOrderId} initialCouponCode={initialCouponCode} contextSource={contextSource} contextErrorCode={initialErrorCode} onCreated={(id) => navigate(`/account/support/tickets/${id}`)} />
    : ticketId ? <TicketConversation ticketId={ticketId} detail={detail} loading={loading} error={error} onReload={() => getMyTicket(ticketId).then(setDetail)} />
      : <SupportHome faqs={faqs} tickets={tickets} summary={summary} search={search} topic={topic} expandedFaq={expandedFaq} loading={loading} error={error} loggedIn={Boolean(currentUser)} onSearch={setSearch} onTopic={setTopic} onExpand={setExpandedFaq} onReload={loadHome} onVote={async (id, value) => { try { await voteFaq(id, value); await loadHome() } catch (caught) { setError(caught instanceof Error ? caught.message : 'Không thể ghi nhận đánh giá.') } }} />

  return <MainLayout><main className="customer-support-page"><div className={accountMode ? 'account-shell' : 'customer-support-public-shell'}>{accountMode && <ProfileSidebar name={currentUser?.name} avatarImage={currentUser?.avatarImage} selectedKey="support" />}<section className={accountMode ? 'account-content customer-support-content' : 'customer-support-content'}>{content}</section></div></main></MainLayout>
}

function AccountSupportLoginRequired() {
  return <div className="customer-support-stack"><header className="customer-support-heading"><h1>Đăng nhập để tiếp tục</h1><span>Ticket hỗ trợ có thể chứa thông tin đơn hàng và chỉ hiển thị cho chủ tài khoản.</span></header><a className="customer-support-primary" href={`/account?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`}>Đăng nhập / Tài khoản</a></div>
}

function SupportHome(props: {
  faqs: FaqArticle[]; tickets: SupportTicket[]; summary: SupportSummary | null; search: string; topic: string;
  expandedFaq: string | null; loading: boolean; error: string; loggedIn: boolean;
  onSearch: (value: string) => void; onTopic: (value: string) => void; onExpand: (id: string | null) => void; onReload: () => void;
  onVote: (id: string, value: 'helpful' | 'not_helpful') => Promise<void>;
}) {
  return <div className="customer-support-stack"><header className="customer-support-heading"><h1>Hỗ trợ khách hàng</h1><span>Tìm câu trả lời nhanh hoặc gửi yêu cầu để shop hỗ trợ đúng vấn đề.</span></header>
    <section className="customer-support-search"><input value={props.search} onChange={(event) => props.onSearch(event.target.value)} placeholder="Bạn cần hỗ trợ vấn đề gì?" /><button type="button" onClick={props.onReload}>Tìm kiếm</button></section>
    {props.error && <div className="customer-support-error" role="alert">{props.error}</div>}
    <div className="customer-support-topics">{topics.map(([value, label]) => <button key={value} type="button" className={props.topic === value ? 'is-active' : ''} onClick={() => props.onTopic(props.topic === value ? '' : value)}>{label}</button>)}</div>
    <section className="customer-support-panel"><div className="customer-support-section-title"><div><h2>Câu hỏi thường gặp</h2><span>Nhấn vào câu hỏi để xem hướng dẫn.</span></div></div>{props.loading ? <p>Đang tải...</p> : props.faqs.length ? props.faqs.map((faq) => <article className="customer-support-faq" key={faq._id}><button type="button" aria-expanded={props.expandedFaq === faq._id} onClick={() => props.onExpand(props.expandedFaq === faq._id ? null : faq._id)}><strong>{faq.question}</strong><span>{props.expandedFaq === faq._id ? '−' : '+'}</span></button>{props.expandedFaq === faq._id && <><p>{faq.answer}</p>{props.loggedIn && <div className="customer-support-vote" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}><span>Câu trả lời này hữu ích?</span><button style={{ width: 'auto', padding: '6px 10px', border: '1px solid #d5e0e5', borderRadius: 8 }} type="button" onClick={() => void props.onVote(faq._id, 'helpful')}>Có ({faq.helpfulCount})</button><button style={{ width: 'auto', padding: '6px 10px', border: '1px solid #d5e0e5', borderRadius: 8 }} type="button" onClick={() => void props.onVote(faq._id, 'not_helpful')}>Chưa ({faq.notHelpfulCount})</button></div>}</>}</article>) : <p>Chưa tìm thấy câu trả lời phù hợp.</p>}</section>
    {props.loggedIn ? <section className="customer-support-panel"><div className="customer-support-section-title"><div><h2>Yêu cầu của tôi</h2><span>Theo dõi phản hồi mới từ shop.</span></div>{props.summary?.total ? <b>{props.summary.total}</b> : null}</div><div className="customer-support-ticket-list">{props.tickets.map((ticket) => <button type="button" key={ticket._id} onClick={() => navigate(`/account/support/tickets/${ticket._id}`)}><span><strong>{ticket.ticketCode}</strong>{ticket.subject}</span><em>{statusLabels[ticket.status]}</em></button>)}</div><button className="customer-support-primary" type="button" onClick={() => navigate('/account/support/new')}>Gửi yêu cầu hỗ trợ</button></section>
      : <section className="customer-support-panel customer-support-login"><h2>Bạn cần shop hỗ trợ riêng?</h2><p>Đăng nhập để tạo và theo dõi ticket. FAQ vẫn luôn xem được mà không cần tài khoản.</p><a href="/account">Đăng nhập / Tài khoản</a></section>}
    <section className="customer-support-contact"><div><h2>Liên hệ với chúng tôi</h2><p>Hotline: 0123 456 789</p><p>Email: cuahang@gmail.com</p><p>Giờ hỗ trợ: 8:30 – 21:45 mỗi ngày</p></div><button type="button" onClick={() => navigate(props.loggedIn ? '/account/support/new' : '/support/feedback')}>Gửi góp ý</button></section>
  </div>
}

function GuestFeedbackForm() {
  const [name, setName] = useState(''); const [email, setEmail] = useState('')
  const [type, setType] = useState<'feedback' | 'suggestion'>('feedback'); const [category, setCategory] = useState<SupportCategory>('other')
  const [subject, setSubject] = useState(''); const [body, setBody] = useState(''); const [website, setWebsite] = useState('')
  const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [sent, setSent] = useState(false)
  const savingRef = useRef(false)
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (savingRef.current) return; savingRef.current = true; setSaving(true); setError('')
    try { await createGuestFeedback({ name, email, type, category, subject, body, website }); setSent(true) }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Không thể gửi góp ý.') }
    finally { savingRef.current = false; setSaving(false) }
  }
  if (sent) return <div className="customer-support-stack"><header className="customer-support-heading"><h1>Kiểm tra email của bạn</h1><span>Chúng tôi đã gửi liên kết xác minh. Góp ý chỉ xuất hiện với đội CSKH sau khi bạn xác minh trong 30 phút.</span></header><button className="customer-support-primary" type="button" onClick={() => navigate('/support')}>Về trang hỗ trợ</button></div>
  return <div className="customer-support-stack"><header className="customer-support-heading"><button type="button" onClick={() => navigate('/support')}>← Quay lại</button><h1>Gửi góp ý không cần tài khoản</h1><span>Chúng tôi sẽ xác minh email để hạn chế spam và có thể phản hồi cho bạn.</span></header>{error && <div className="customer-support-error">{error}</div>}<form className="customer-support-form" onSubmit={submit}><label>Họ tên<input value={name} minLength={2} maxLength={100} required onChange={(event) => setName(event.target.value)} /></label><label>Email<input type="email" value={email} maxLength={254} required onChange={(event) => setEmail(event.target.value)} /></label><label>Loại<select value={type} onChange={(event) => setType(event.target.value as 'feedback' | 'suggestion')}><option value="feedback">Góp ý</option><option value="suggestion">Đề xuất</option></select></label><label>Chủ đề<select value={category} onChange={(event) => setCategory(event.target.value as SupportCategory)}>{categoryLabels.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Tiêu đề<input value={subject} minLength={5} maxLength={150} required onChange={(event) => setSubject(event.target.value)} /></label><label>Nội dung<textarea value={body} minLength={10} maxLength={3000} rows={8} required onChange={(event) => setBody(event.target.value)} /></label><label className="customer-support-honeypot" aria-hidden="true">Website<input value={website} tabIndex={-1} autoComplete="off" onChange={(event) => setWebsite(event.target.value)} /></label><footer><button type="button" onClick={() => navigate('/support')}>Hủy</button><button className="customer-support-primary" disabled={saving} type="submit">{saving ? 'Đang gửi...' : 'Gửi và xác minh email'}</button></footer></form></div>
}

function GuestVerification() {
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('Đang xác minh góp ý...')
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token') ?? ''
    verifyGuestFeedback(token).then((result) => { setState('success'); setMessage(`Đã xác minh ${result.ticketCode}. Cảm ơn bạn đã góp ý!`) }).catch((caught) => { setState('error'); setMessage(caught instanceof Error ? caught.message : 'Liên kết không hợp lệ hoặc đã hết hạn.') })
  }, [])
  return <div className="customer-support-stack"><header className="customer-support-heading"><h1>{state === 'success' ? 'Xác minh thành công' : state === 'error' ? 'Không thể xác minh' : 'Đang xác minh'}</h1><span>{message}</span></header><button className="customer-support-primary" type="button" onClick={() => navigate('/support')}>Về trang hỗ trợ</button></div>
}

const supportFileTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const selectSupportFiles = (fileList: FileList | null, setError: (message: string) => void) => {
  const selected = Array.from(fileList ?? [])
  if (selected.length > 3) { setError('Chỉ được đính kèm tối đa 3 ảnh.'); return [] }
  if (selected.some((file) => !supportFileTypes.has(file.type))) { setError('Chỉ hỗ trợ ảnh JPEG, PNG hoặc WEBP.'); return [] }
  if (selected.some((file) => file.size > 5 * 1024 * 1024)) { setError('Mỗi ảnh phải có dung lượng không quá 5MB.'); return [] }
  setError('')
  return selected
}

type TicketFormProps = {
  onCreated: (id: string) => void
  initialCategory: SupportCategory
  initialOrderId: string
  initialCouponCode: string
  contextSource: 'support_home' | 'order_detail' | 'payment_result' | 'coupon' | 'loyalty' | 'error_screen' | 'footer'
  contextErrorCode: string
}

function TicketForm({ onCreated, initialCategory, initialOrderId, initialCouponCode, contextSource, contextErrorCode }: TicketFormProps) {
  const [type, setType] = useState<SupportTicketType>('question'); const [category, setCategory] = useState<SupportCategory>(initialCategory)
  const [subject, setSubject] = useState(''); const [body, setBody] = useState(''); const [orderId, setOrderId] = useState(initialOrderId); const [couponCode, setCouponCode] = useState(initialCouponCode)
  const [requiresReply, setRequiresReply] = useState(true); const [files, setFiles] = useState<File[]>([]); const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const orderRequired = ['orders', 'returns', 'payments'].includes(category)
  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (savingRef.current) return; savingRef.current = true; setSaving(true); setError(''); try { const result = await createMyTicket({ type, category, subject, body, requiresReply, orderId: orderId || undefined, couponCode: couponCode || undefined, files, contextSource, contextErrorCode }); onCreated(result.ticket._id) } catch (caught) { setError(caught instanceof Error ? caught.message : 'Không thể gửi yêu cầu.') } finally { savingRef.current = false; setSaving(false) } }
  return <div className="customer-support-stack"><header className="customer-support-heading"><button type="button" onClick={() => navigate('/account/support')}>← Quay lại</button><h1>Gửi yêu cầu hỗ trợ</h1><span>Thông tin có cấu trúc giúp shop xử lý nhanh và chính xác hơn.</span></header>{error && <div className="customer-support-error">{error}</div>}<form className="customer-support-form" onSubmit={submit}><label>Loại yêu cầu<select value={type} onChange={(event) => { const value = event.target.value as SupportTicketType; setType(value); setRequiresReply(!['feedback', 'suggestion'].includes(value)) }}>{typeLabels.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Chủ đề<select value={category} onChange={(event) => setCategory(event.target.value as SupportCategory)}>{categoryLabels.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{orderRequired && <label>ID đơn hàng<input value={orderId} onChange={(event) => setOrderId(event.target.value)} required placeholder="Mở từ chi tiết đơn để được tự điền" /></label>}{category === 'promotions' && <label>Mã voucher<input value={couponCode} onChange={(event) => setCouponCode(event.target.value.toUpperCase())} /></label>}<label>Tiêu đề<input value={subject} minLength={5} maxLength={150} required onChange={(event) => setSubject(event.target.value)} /></label><label>Nội dung<textarea value={body} minLength={10} maxLength={3000} rows={8} required onChange={(event) => setBody(event.target.value)} /></label><label className="customer-support-check"><input type="checkbox" checked={requiresReply} onChange={(event) => setRequiresReply(event.target.checked)} /> Tôi muốn nhận phản hồi từ shop</label><label>Ảnh minh chứng (tối đa 3)<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setFiles(selectSupportFiles(event.target.files, setError))} /></label><footer><button type="button" onClick={() => navigate('/account/support')}>Hủy</button><button className="customer-support-primary" disabled={saving} type="submit">{saving ? 'Đang gửi...' : 'Gửi yêu cầu'}</button></footer></form></div>
}

function TicketConversation({ ticketId, detail, loading, error, onReload }: { ticketId: string; detail: TicketDetail | null; loading: boolean; error: string; onReload: () => void }) {
  const [reply, setReply] = useState(''); const [files, setFiles] = useState<File[]>([]); const [sending, setSending] = useState(false); const [localError, setLocalError] = useState('')
  const [staffTyping, setStaffTyping] = useState(false); const [reopening, setReopening] = useState(false); const [closing, setClosing] = useState(false)
  const [liveMessages, setLiveMessages] = useState<SupportMessage[] | null>(null)
  const [liveTicket, setLiveTicket] = useState<SupportTicket | null>(null)
  const [now] = useState(() => Date.now())
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sendingRef = useRef(false)
  const reopeningRef = useRef(false)
  const closingRef = useRef(false)

  useEffect(() => {
    setLiveMessages(detail ? [...detail.messages] : null)
    setLiveTicket(detail ? detail.ticket : null)
  }, [detail])

  const realtime = useCustomerSupportRealtime({
    onMessage: (id, message) => {
      if (id !== ticketId) return
      setLiveMessages((prev) => prev
        ? (prev.some((m) => m._id === message._id) ? prev : [...prev, message])
        : [message])
      setStaffTyping(false)
    },
    onTyping: (id, isTyping) => {
      if (id !== ticketId) return
      setStaffTyping(isTyping)
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
      if (isTyping) typingTimerRef.current = setTimeout(() => setStaffTyping(false), 4000)
    },
    onUpdated: (id, ticket) => {
      if (id !== ticketId) return
      setLiveTicket(ticket)
    },
  })

  useEffect(() => {
    if (ticketId) realtime.subscribeTicket(ticketId)
    return () => { if (ticketId) realtime.unsubscribeTicket(ticketId) }
  }, [ticketId, realtime])

  const send = async () => {
    if (!liveTicket || !reply.trim() || sendingRef.current) return
    sendingRef.current = true; setSending(true); setLocalError('')
    try { await addMyMessage(liveTicket._id, reply.trim(), files); setReply(''); setFiles([]); onReload() }
    catch (caught) { setLocalError(caught instanceof Error ? caught.message : 'Không thể gửi tin nhắn.') }
    finally { sendingRef.current = false; setSending(false) }
  }

  const handleReplyChange = (value: string) => {
    setReply(value)
    if (liveTicket) realtime.emitTyping(liveTicket._id, value.trim().length > 0)
  }

  const reopen = async () => {
    if (!liveTicket || reopeningRef.current) return
    reopeningRef.current = true; setReopening(true); setLocalError('')
    try { await reopenMyTicket(liveTicket._id); onReload() }
    catch (caught) { setLocalError(caught instanceof Error ? caught.message : 'Không thể mở lại yêu cầu.') }
    finally { reopeningRef.current = false; setReopening(false) }
  }

  const close = async () => {
    if (!liveTicket || closingRef.current) return
    closingRef.current = true; setClosing(true); setLocalError('')
    try { await closeMyTicket(liveTicket._id); onReload() }
    catch (caught) { setLocalError(caught instanceof Error ? caught.message : 'Không thể đóng yêu cầu.') }
    finally { closingRef.current = false; setClosing(false) }
  }

  const messages = liveMessages ?? []
  const ticket = liveTicket ?? detail?.ticket
  if (loading) return <p>Đang tải ticket...</p>
  if (!ticket) return <div className="customer-support-error">{error || 'Không tìm thấy ticket.'}</div>
  const isClosed = ticket.status === 'closed'
  const isResolved = ticket.status === 'resolved'
  const canReopen = isResolved && Boolean(ticket.reopenDeadline) && new Date(ticket.reopenDeadline as string).getTime() >= now
  return <div className="customer-support-stack"><header className="customer-support-heading"><button type="button" onClick={() => navigate('/account/support')}>← Yêu cầu của tôi</button><p>{ticket.ticketCode}</p><h1>{ticket.subject}</h1><span>{statusLabels[ticket.status]}</span></header>{localError && <div className="customer-support-error">{localError}</div>}<section className="customer-support-thread">{messages.map((message) => <article key={message._id} className={message.senderType}><header><strong>{message.senderType === 'staff' ? 'Shop' : 'Bạn'}</strong><time>{new Date(message.createdAt).toLocaleString('vi-VN')}</time></header><p>{message.body}</p>{message.attachments.length > 0 && <div>{message.attachments.map((file) => <a key={file.publicId} href={file.url} target="_blank" rel="noreferrer"><img src={file.url} alt="Ảnh đính kèm" /></a>)}</div>}</article>)}{staffTyping && <p className="customer-support-typing" aria-live="polite">Shop đang gõ...</p>}</section>{!isClosed && !isResolved && <section className="customer-support-reply"><textarea rows={5} value={reply} maxLength={3000} onChange={(event) => handleReplyChange(event.target.value)} placeholder="Bổ sung thông tin cho shop..." /><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setFiles(selectSupportFiles(event.target.files, setLocalError))} /><div><button type="button" disabled={closing} onClick={() => void close()}>{closing ? 'Đang đóng...' : 'Đóng yêu cầu'}</button><button className="customer-support-primary" type="button" disabled={!reply.trim() || sending} onClick={() => void send()}>{sending ? 'Đang gửi...' : 'Gửi tin nhắn'}</button></div></section>}{canReopen && <section className="customer-support-reply customer-support-reopen"><p>Yêu cầu đã được đánh dấu giải quyết. Vấn đề chưa hết? Mở lại để tiếp tục trao đổi.</p><button className="customer-support-primary" type="button" disabled={reopening} onClick={() => void reopen()}>{reopening ? 'Đang mở lại...' : 'Mở lại yêu cầu'}</button></section>}{isResolved && !canReopen && <section className="customer-support-reply customer-support-reopen"><p>Thời hạn mở lại yêu cầu này đã hết. Vui lòng tạo yêu cầu mới nếu bạn vẫn cần hỗ trợ.</p><button className="customer-support-primary" type="button" onClick={() => navigate('/account/support/new')}>Tạo yêu cầu mới</button></section>}</div>
}
