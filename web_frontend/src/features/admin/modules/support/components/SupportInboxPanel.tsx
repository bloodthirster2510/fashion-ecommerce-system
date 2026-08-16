import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowUpRight,
  FileText,
  ImagePlus,
  Info,
  LoaderCircle,
  Lock,
  MessageSquareText,
  PanelRightClose,
  PanelRightOpen,
  RotateCcw,
  Send,
  User,
  UserCheck,
  X,
} from 'lucide-react'
import { Button, EmptyState, Modal, Pagination, StatusBadge } from '../../../components/ui'
import type {
  CannedResponse,
  FaqCategory,
  SupportCategory,
  SupportPriority,
  SupportPerson,
  SupportTicket,
  SupportTicketDetail,
  SupportTicketStatus,
  SupportTicketType,
} from '../support.types'

type SupportInboxPanelProps = {
  tickets: SupportTicket[]
  ticketPagination: { page: number; limit: number; totalItems: number; totalPages: number }
  selectedId: string | null
  detail: SupportTicketDetail | null
  loading: boolean
  detailLoading: boolean
  submitting: boolean
  canManage: boolean
  canMarkSpam: boolean
  currentUserId: string
  assignees: SupportPerson[]
  reply: string
  isInternal: boolean
  selectedCannedId: string
  cannedResponses: CannedResponse[]
  customerTypingTicketId: string | null
  replyFiles: File[]
  statusLabels: Record<SupportTicketStatus, string>
  typeLabels: Record<SupportTicketType, string>
  categoryLabels: Record<SupportCategory | FaqCategory, string>
  priorityLabels: Record<SupportPriority, string>
  statusTones: Record<SupportTicketStatus, 'success' | 'warning' | 'danger' | 'info' | 'neutral'>
  priorityTones: Record<SupportPriority, 'success' | 'warning' | 'danger' | 'info' | 'neutral'>
  formatDate: (value: string) => string
  getPersonName: (ticket: SupportTicket) => string
  onSelectTicket: (ticketId: string) => void
  onPageChange: (page: number) => void
  onMutateTicket: (payload: { status?: SupportTicketStatus; priority?: SupportPriority; category?: SupportCategory; assignedTo?: string | null }) => void | Promise<void>
  onCannedChange: (id: string) => void
  onReplyChange: (value: string) => void
  onInternalChange: (value: boolean) => void
  onFilesChange: (files: File[]) => void
  onSendReply: () => void | Promise<void>
}

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/)
  if (!parts.length || !parts[0]) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function SupportInboxPanel({
  tickets,
  ticketPagination,
  selectedId,
  detail,
  loading,
  detailLoading,
  submitting,
  canManage,
  canMarkSpam,
  currentUserId,
  assignees,
  reply,
  isInternal,
  selectedCannedId,
  cannedResponses,
  customerTypingTicketId,
  replyFiles,
  statusLabels,
  typeLabels,
  categoryLabels,
  priorityLabels,
  statusTones,
  priorityTones,
  formatDate,
  getPersonName,
  onSelectTicket,
  onPageChange,
  onMutateTicket,
  onCannedChange,
  onReplyChange,
  onInternalChange,
  onFilesChange,
  onSendReply,
}: SupportInboxPanelProps) {
  const [isSpamConfirmOpen, setIsSpamConfirmOpen] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const threadRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const selectedTicket = detail?.ticket

  useEffect(() => {
    const thread = threadRef.current
    if (!thread) return
    thread.scrollTo({ top: thread.scrollHeight, behavior: 'smooth' })
  }, [customerTypingTicketId, detail?.messages.length, selectedId])

  const allowedTransitions: Record<SupportTicketStatus, SupportTicketStatus[]> = {
    open: ['open', 'in_progress', 'resolved', 'closed', ...(canMarkSpam ? ['spam' as const] : [])],
    in_progress: ['in_progress', 'resolved', 'closed', ...(canMarkSpam ? ['spam' as const] : [])],
    waiting_customer: ['waiting_customer', 'in_progress', 'resolved', 'closed', ...(canMarkSpam ? ['spam' as const] : [])],
    resolved: ['resolved', 'in_progress', 'closed', ...(canMarkSpam ? ['spam' as const] : [])],
    closed: ['closed', 'in_progress'],
    spam: ['spam'],
  }

  const statusActionLabels: Record<SupportTicketStatus, string> = {
    open: 'Đưa về đã tiếp nhận',
    in_progress: ['resolved', 'closed'].includes(selectedTicket?.status ?? '') ? 'Mở lại ticket' : 'Bắt đầu xử lý',
    waiting_customer: 'Chờ khách bổ sung',
    resolved: 'Đánh dấu đã giải quyết',
    closed: 'Đóng ticket',
    spam: 'Đánh dấu spam',
  }

  const handleStatusAction = (status: SupportTicketStatus) => {
    if (status === 'spam') {
      setIsSpamConfirmOpen(true)
      return
    }
    void onMutateTicket({ status })
  }

  const handleConfirmSpam = async () => {
    await onMutateTicket({ status: 'spam' })
    setIsSpamConfirmOpen(false)
  }

  const handleRemoveFile = (index: number) => {
    const next = replyFiles.filter((_, i) => i !== index)
    onFilesChange(next)
  }

  const isAssignedToMe = typeof selectedTicket?.assignedTo === 'object' && selectedTicket?.assignedTo
    ? selectedTicket.assignedTo._id === currentUserId
    : selectedTicket?.assignedTo === currentUserId

  const isTicketClosed = selectedTicket && ['closed', 'spam', 'resolved'].includes(selectedTicket.status)

  return (
    <div className={`admin-support-workspace${inspectorOpen ? ' is-inspector-open' : ' is-inspector-closed'}`}>
      {/* ─── PANE 1: TICKET QUEUE ─── */}
      <aside className="admin-support-queue" aria-label="Danh sách ticket">
        <header className="admin-support-queue-header">
          <div className="admin-support-queue-title">
            <span>Hàng đợi</span>
            <strong className="admin-support-queue-badge">{ticketPagination.totalItems}</strong>
          </div>
          {ticketPagination.totalPages > 1 ? (
            <small className="admin-support-queue-pages">Trang {ticketPagination.page}/{ticketPagination.totalPages}</small>
          ) : null}
        </header>

        <div className="admin-support-queue-list">
          {loading ? (
            <div className="admin-support-loading">
              <LoaderCircle className="admin-support-spin" aria-hidden="true" />
              <span>Đang tải ticket...</span>
            </div>
          ) : tickets.length ? (
            tickets.map((ticket) => {
              const personName = getPersonName(ticket)
              const initials = getInitials(personName)
              const isSelected = ticket._id === selectedId
              const isNeedsReply = ticket.requiresReply

              return (
                <button
                  key={ticket._id}
                  type="button"
                  className={`admin-support-ticket status-${ticket.status}${isSelected ? ' is-selected' : ''}${isNeedsReply ? ' needs-reply' : ''}`}
                  onClick={() => onSelectTicket(ticket._id)}
                >
                  <div className="admin-support-ticket__left">
                    <div className={`admin-support-ticket__avatar status-${ticket.status}`}>
                      {initials}
                    </div>
                  </div>

                  <div className="admin-support-ticket__body">
                    <div className="admin-support-ticket__top">
                      <span className="admin-support-ticket__code">{ticket.ticketCode}</span>
                      <time className="admin-support-ticket__time">{formatDate(ticket.lastMessageAt)}</time>
                    </div>

                    <strong className="admin-support-ticket__subject" title={ticket.subject}>
                      {ticket.subject}
                    </strong>

                    <div className="admin-support-ticket__customer">
                      <span className="admin-support-ticket__name" title={personName}>{personName}</span>
                      <span className="admin-support-ticket__dot">·</span>
                      <span className="admin-support-ticket__category">{categoryLabels[ticket.category]}</span>
                    </div>

                    <div className="admin-support-ticket__footer">
                      <div className="admin-support-ticket__badges">
                        {isNeedsReply ? (
                          <StatusBadge tone="warning">
                            <span className="admin-support-pulse-dot" />
                            Cần phản hồi
                          </StatusBadge>
                        ) : (
                          <StatusBadge tone={statusTones[ticket.status]}>
                            {statusLabels[ticket.status]}
                          </StatusBadge>
                        )}
                        {ticket.priority === 'urgent' ? (
                          <StatusBadge tone="danger">Khẩn cấp</StatusBadge>
                        ) : ticket.priority === 'high' ? (
                          <StatusBadge tone="warning">Ưu tiên cao</StatusBadge>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })
          ) : (
            <EmptyState
              title="Không có ticket phù hợp"
              description="Thử đổi bộ lọc hoặc làm mới hàng đợi để kiểm tra ticket mới."
            />
          )}
        </div>

        {ticketPagination.totalPages > 1 ? (
          <div className="admin-support-queue-pagination">
            <Pagination
              page={ticketPagination.page}
              totalPages={ticketPagination.totalPages}
              totalItems={ticketPagination.totalItems}
              isDisabled={loading}
              onPageChange={onPageChange}
            />
          </div>
        ) : null}
      </aside>

      {/* ─── PANE 2: ACTIVE CONVERSATION WORKSPACE ─── */}
      <main className="admin-support-main">
        {detailLoading ? (
          <div className="admin-support-loading is-main">
            <LoaderCircle className="admin-support-spin" aria-hidden="true" />
            <span>Đang tải nội dung hội thoại...</span>
          </div>
        ) : selectedTicket ? (
          <>
            {/* TICKET WORKSPACE HEADER */}
            <header className="admin-support-detail-header">
              <div className="admin-support-detail-header__main">
                <div className="admin-support-detail-header__meta">
                  <span className="admin-support-code-chip">{selectedTicket.ticketCode}</span>
                  <span className="admin-support-tag-chip">{categoryLabels[selectedTicket.category]}</span>
                  <span className="admin-support-tag-chip is-muted">{typeLabels[selectedTicket.type]}</span>
                </div>
                <h2 className="admin-support-detail-header__title">{selectedTicket.subject}</h2>
                <div className="admin-support-detail-header__customer">
                  <User aria-hidden="true" />
                  <strong>{getPersonName(selectedTicket)}</strong>
                  {typeof selectedTicket.userId === 'object' && selectedTicket.userId?.email ? (
                    <span className="admin-support-customer-sub">({selectedTicket.userId.email})</span>
                  ) : selectedTicket.guestContact?.email ? (
                    <span className="admin-support-customer-sub">({selectedTicket.guestContact.email})</span>
                  ) : null}
                </div>
              </div>

              <div className="admin-support-detail-header__actions">
                <div className="admin-support-detail-badges">
                  {selectedTicket.requiresReply ? (
                    <StatusBadge tone="warning">
                      <span className="admin-support-pulse-dot" />
                      Cần phản hồi
                    </StatusBadge>
                  ) : (
                    <StatusBadge tone={statusTones[selectedTicket.status]}>
                      {statusLabels[selectedTicket.status]}
                    </StatusBadge>
                  )}
                  {selectedTicket.priority !== 'normal' ? (
                    <StatusBadge tone={priorityTones[selectedTicket.priority]}>
                      {priorityLabels[selectedTicket.priority]}
                    </StatusBadge>
                  ) : null}
                </div>

                {!selectedTicket.assignedTo ? (
                  <Button
                    variant="primary"
                    disabled={submitting}
                    onClick={() => void onMutateTicket({ assignedTo: currentUserId })}
                  >
                    <UserCheck aria-hidden="true" />
                    Nhận xử lý
                  </Button>
                ) : null}

                <button
                  className={`admin-support-inspector-btn${inspectorOpen ? ' is-active' : ''}`}
                  type="button"
                  aria-expanded={inspectorOpen}
                  aria-controls="support-ticket-inspector"
                  onClick={() => setInspectorOpen((open) => !open)}
                  title={inspectorOpen ? 'Thu gọn bảng thông tin' : 'Mở bảng thông tin chi tiết'}
                >
                  {inspectorOpen ? <PanelRightClose aria-hidden="true" /> : <PanelRightOpen aria-hidden="true" />}
                  <span>{inspectorOpen ? 'Đóng thông tin' : 'Thông tin chi tiết'}</span>
                </button>
              </div>
            </header>

            {/* CHAT CONVERSATION THREAD */}
            <div className="admin-support-thread" ref={threadRef} aria-live="polite">
              {detail.messages.map((message) => {
                const isCustomer = message.senderType === 'customer'
                const isStaff = message.senderType === 'staff' && !message.isInternal
                const isNote = message.isInternal

                return (
                  <article
                    key={message._id}
                    className={`admin-support-msg${isCustomer ? ' is-customer' : ''}${isStaff ? ' is-staff' : ''}${isNote ? ' is-note' : ''}`}
                  >
                    <div className="admin-support-msg__bubble">
                      <header className="admin-support-msg__header">
                        <div className="admin-support-msg__author">
                          {isNote ? (
                            <span className="admin-support-note-badge">
                              <Lock aria-hidden="true" /> Ghi chú nội bộ (Staff only)
                            </span>
                          ) : isStaff ? (
                            <span className="admin-support-staff-badge">
                              <UserCheck aria-hidden="true" /> Nhân viên hỗ trợ
                            </span>
                          ) : (
                            <span className="admin-support-customer-badge">
                              <User aria-hidden="true" /> {getPersonName(selectedTicket)}
                            </span>
                          )}
                        </div>
                        <time className="admin-support-msg__time">{formatDate(message.createdAt)}</time>
                      </header>

                      <div className="admin-support-msg__content">
                        <p>{message.body}</p>
                      </div>

                      {message.attachments.length > 0 ? (
                        <div className="admin-support-msg__attachments">
                          {message.attachments.map((file) => (
                            <a
                              href={file.url}
                              target="_blank"
                              rel="noreferrer"
                              key={file.publicId}
                              className="admin-support-attachment-thumb"
                              title="Xem ảnh gốc"
                            >
                              <img src={file.url} alt="Ảnh đính kèm" loading="lazy" />
                              <span className="admin-support-attachment-overlay">
                                <ArrowUpRight aria-hidden="true" />
                              </span>
                            </a>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </article>
                )
              })}

              {customerTypingTicketId === selectedTicket._id ? (
                <div className="admin-support-typing-indicator" aria-live="polite">
                  <span className="admin-support-typing-dot" />
                  <span className="admin-support-typing-dot" />
                  <span className="admin-support-typing-dot" />
                  <em>Khách hàng đang nhập tin nhắn...</em>
                </div>
              ) : null}
            </div>

            {/* COMPOSER / REOPEN BANNER */}
            {isTicketClosed ? (
              <div className="admin-support-closed-bar">
                <div className="admin-support-closed-bar__info">
                  <Info aria-hidden="true" />
                  <div>
                    <strong>Ticket hiện ở trạng thái {statusLabels[selectedTicket.status]}.</strong>
                    <span>Khung soạn thảo bị khóa. Bạn có thể mở lại để tiếp tục trao đổi với khách.</span>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  disabled={submitting}
                  onClick={() => void onMutateTicket({ status: 'in_progress' })}
                >
                  <RotateCcw aria-hidden="true" />
                  Mở lại ticket
                </Button>
              </div>
            ) : (
              <div className={`admin-support-composer${isInternal ? ' is-internal-mode' : ''}`}>
                <div className="admin-support-composer__head">
                  <div className="admin-support-composer__tabs" role="group" aria-label="Chế độ soạn thảo">
                    <button
                      type="button"
                      className={`admin-support-composer-tab${!isInternal ? ' is-active' : ''}`}
                      aria-pressed={!isInternal}
                      onClick={() => onInternalChange(false)}
                    >
                      <MessageSquareText aria-hidden="true" />
                      <span>Phản hồi khách hàng</span>
                    </button>

                    <button
                      type="button"
                      className={`admin-support-composer-tab is-note-tab${isInternal ? ' is-active' : ''}`}
                      aria-pressed={isInternal}
                      onClick={() => onInternalChange(true)}
                    >
                      <Lock aria-hidden="true" />
                      <span>Ghi chú nội bộ</span>
                    </button>
                  </div>

                  {canManage ? (
                    <div className="admin-support-composer__canned">
                      <select
                        aria-label="Chọn mẫu trả lời nhanh"
                        value={selectedCannedId}
                        onChange={(event) => onCannedChange(event.target.value)}
                      >
                        <option value="">⚡ Mẫu trả lời nhanh...</option>
                        {cannedResponses
                          .filter((item) => item.isActive && (!item.category || item.category === selectedTicket.category))
                          .map((item) => (
                            <option key={item._id} value={item._id}>
                              {item.title}
                            </option>
                          ))}
                      </select>
                    </div>
                  ) : null}
                </div>

                <div className="admin-support-composer__body">
                  <textarea
                    ref={textareaRef}
                    rows={3}
                    value={reply}
                    onChange={(event) => onReplyChange(event.target.value)}
                    onKeyDown={(event) => {
                      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && reply.trim() && !submitting) {
                        event.preventDefault()
                        void onSendReply()
                      }
                    }}
                    placeholder={
                      isInternal
                        ? 'Nhập ghi chú nội bộ (Khách hàng không nhìn thấy nội dung này)...'
                        : 'Nhập nội dung phản hồi cho khách hàng...'
                    }
                    maxLength={3000}
                    aria-label={isInternal ? 'Nội dung ghi chú nội bộ' : 'Nội dung phản hồi khách hàng'}
                  />
                </div>

                {replyFiles.length > 0 ? (
                  <div className="admin-support-composer__files">
                    {replyFiles.map((file, idx) => (
                      <div className="admin-support-file-chip" key={`${file.name}-${idx}`}>
                        <FileText aria-hidden="true" />
                        <span className="admin-support-file-name" title={file.name}>{file.name}</span>
                        <small>{(file.size / 1024).toFixed(0)} KB</small>
                        <button
                          type="button"
                          className="admin-support-file-remove"
                          onClick={() => handleRemoveFile(idx)}
                          aria-label={`Xóa file ${file.name}`}
                        >
                          <X aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="admin-support-composer__footer">
                  <label className="admin-support-attach-btn">
                    <ImagePlus aria-hidden="true" />
                    <span>Đính kèm ảnh</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      onChange={(event) => onFilesChange(Array.from(event.target.files ?? []))}
                    />
                  </label>

                  <span className="admin-support-composer__hint">
                    Tối đa 3 ảnh (≤ 5MB) · Nhấn <b>Ctrl + Enter</b> để gửi
                  </span>

                  <button
                    className={`admin-support-send-btn${submitting ? ' is-submitting' : ''}${isInternal ? ' is-note-btn' : ''}`}
                    type="button"
                    disabled={!reply.trim() || submitting}
                    onClick={() => void onSendReply()}
                    aria-busy={submitting}
                  >
                    {submitting ? (
                      <>
                        <LoaderCircle className="admin-support-spin" aria-hidden="true" />
                        <span>Đang gửi...</span>
                      </>
                    ) : isInternal ? (
                      <>
                        <Lock aria-hidden="true" />
                        <span>Lưu ghi chú</span>
                      </>
                    ) : (
                      <>
                        <Send aria-hidden="true" />
                        <span>Gửi phản hồi</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="admin-support-empty-state">
            <MessageSquareText aria-hidden="true" />
            <h3>Chưa chọn ticket</h3>
            <p>Vui lòng chọn một phiếu hỗ trợ từ danh sách hàng đợi bên trái để bắt đầu xử lý.</p>
          </div>
        )}
      </main>

      {/* ─── PANE 3: TICKET INSPECTOR & CONTEXT SIDEBAR ─── */}
      {selectedTicket && inspectorOpen ? (
        <aside id="support-ticket-inspector" className="admin-support-inspector" aria-label="Bảng thông tin và điều phối">
          <header className="admin-support-inspector__header">
            <strong>Thông tin &amp; Điều phối</strong>
            <button
              type="button"
              className="admin-support-inspector__close"
              onClick={() => setInspectorOpen(false)}
              aria-label="Đóng bảng thông tin"
            >
              <X aria-hidden="true" />
            </button>
          </header>

          <div className="admin-support-inspector__body">
            {/* QUICK ACTIONS & STATUS */}
            <section className="admin-support-inspector__section">
              <span className="admin-support-inspector__section-title">Thao tác trạng thái</span>
              <div className="admin-support-status-actions" role="group" aria-label="Cập nhật trạng thái ticket">
                {allowedTransitions[selectedTicket.status]
                  .filter((val) => val !== selectedTicket.status)
                  .map((val) => (
                    <button
                      key={val}
                      type="button"
                      className={`admin-support-status-btn status-${val}`}
                      disabled={submitting}
                      onClick={() => handleStatusAction(val)}
                    >
                      <span className="admin-support-status-dot" />
                      <span>{statusActionLabels[val]}</span>
                    </button>
                  ))}
              </div>
            </section>

            {/* ASSIGNMENT & CLASSIFICATION */}
            <section className="admin-support-inspector__section">
              <span className="admin-support-inspector__section-title">Phân công &amp; Phân loại</span>
              <div className="admin-support-field-group">
                <label className="admin-support-field-label">
                  <span>Người xử lý</span>
                  <select
                    value={typeof selectedTicket.assignedTo === 'string' ? selectedTicket.assignedTo : selectedTicket.assignedTo?._id ?? ''}
                    disabled={submitting}
                    onChange={(event) => void onMutateTicket({ assignedTo: event.target.value || null })}
                  >
                    <option value="">Chưa phân công</option>
                    {assignees.map((person) => (
                      <option key={person._id} value={person._id}>
                        {person.name || person.email} {person._id === currentUserId ? '(Tôi)' : ''}
                      </option>
                    ))}
                  </select>
                </label>

                {!isAssignedToMe && selectedTicket.assignedTo ? (
                  <button
                    type="button"
                    className="admin-support-assign-me-btn"
                    disabled={submitting}
                    onClick={() => void onMutateTicket({ assignedTo: currentUserId })}
                  >
                    Giao lại cho tôi
                  </button>
                ) : null}

                <label className="admin-support-field-label">
                  <span>Mức ưu tiên</span>
                  <select
                    value={selectedTicket.priority}
                    disabled={submitting}
                    onChange={(event) => void onMutateTicket({ priority: event.target.value as SupportPriority })}
                  >
                    {Object.entries(priorityLabels).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </label>

                <label className="admin-support-field-label">
                  <span>Danh mục</span>
                  <select
                    value={selectedTicket.category}
                    disabled={submitting}
                    onChange={(event) => void onMutateTicket({ category: event.target.value as SupportCategory })}
                  >
                    {Object.entries(categoryLabels).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            {/* CUSTOMER INFO */}
            <section className="admin-support-inspector__section">
              <span className="admin-support-inspector__section-title">Khách hàng</span>
              <div className="admin-support-card-box">
                <div className="admin-support-customer-profile">
                  <div className="admin-support-customer-profile__avatar">
                    {getInitials(getPersonName(selectedTicket))}
                  </div>
                  <div className="admin-support-customer-profile__info">
                    <strong>{getPersonName(selectedTicket)}</strong>
                    <small>{selectedTicket.userId ? 'Thành viên đã đăng ký' : 'Khách vãng lai'}</small>
                  </div>
                </div>

                <div className="admin-support-info-list">
                  {typeof selectedTicket.userId === 'object' && selectedTicket.userId ? (
                    <>
                      {selectedTicket.userId.email ? (
                        <div className="admin-support-info-row">
                          <span>Email:</span>
                          <a href={`mailto:${selectedTicket.userId.email}`}>{selectedTicket.userId.email}</a>
                        </div>
                      ) : null}
                      {selectedTicket.userId.phone ? (
                        <div className="admin-support-info-row">
                          <span>SĐT:</span>
                          <a href={`tel:${selectedTicket.userId.phone}`}>{selectedTicket.userId.phone}</a>
                        </div>
                      ) : null}
                    </>
                  ) : selectedTicket.guestContact?.email ? (
                    <div className="admin-support-info-row">
                      <span>Email:</span>
                      <a href={`mailto:${selectedTicket.guestContact.email}`}>{selectedTicket.guestContact.email}</a>
                    </div>
                  ) : null}
                </div>
              </div>
            </section>

            {/* RELATED ORDER */}
            {selectedTicket.orderId ? (
              <section className="admin-support-inspector__section">
                <span className="admin-support-inspector__section-title">Đơn hàng liên quan</span>
                <div className="admin-support-card-box is-order">
                  <div className="admin-support-order-preview">
                    <strong>
                      {typeof selectedTicket.orderId === 'string'
                        ? selectedTicket.orderId
                        : selectedTicket.orderId.orderCode}
                    </strong>
                    {typeof selectedTicket.orderId === 'object' ? (
                      <div className="admin-support-order-status-row">
                        <StatusBadge tone="info">{selectedTicket.orderId.status}</StatusBadge>
                        {selectedTicket.orderId.paymentStatus ? (
                          <StatusBadge tone="neutral">{selectedTicket.orderId.paymentStatus}</StatusBadge>
                        ) : null}
                      </div>
                    ) : null}
                    <a
                      href="/admin/orders"
                      className="admin-support-order-link"
                      title="Xem danh sách đơn hàng"
                    >
                      <span>Mở quản lý đơn</span>
                      <ArrowUpRight aria-hidden="true" />
                    </a>
                  </div>
                </div>
              </section>
            ) : null}

            {/* TECHNICAL CONTEXT & SOURCE */}
            {(selectedTicket.couponCode || selectedTicket.context) ? (
              <section className="admin-support-inspector__section">
                <span className="admin-support-inspector__section-title">Ngữ cảnh kỹ thuật</span>
                <div className="admin-support-card-box">
                  <div className="admin-support-info-list">
                    {selectedTicket.couponCode ? (
                      <div className="admin-support-info-row">
                        <span>Voucher:</span>
                        <strong>{selectedTicket.couponCode}</strong>
                      </div>
                    ) : null}
                    {selectedTicket.context?.source ? (
                      <div className="admin-support-info-row">
                        <span>Nguồn:</span>
                        <span>{selectedTicket.context.source}</span>
                      </div>
                    ) : null}
                    {selectedTicket.context?.appPlatform ? (
                      <div className="admin-support-info-row">
                        <span>Nền tảng:</span>
                        <span>{selectedTicket.context.appPlatform} {selectedTicket.context.appVersion ?? ''}</span>
                      </div>
                    ) : null}
                    {selectedTicket.context?.screen ? (
                      <div className="admin-support-info-row">
                        <span>Màn hình:</span>
                        <span>{selectedTicket.context.screen}</span>
                      </div>
                    ) : null}
                    {selectedTicket.context?.errorCode ? (
                      <div className="admin-support-info-row is-error">
                        <span>Mã lỗi:</span>
                        <code>{selectedTicket.context.errorCode}</code>
                      </div>
                    ) : null}
                  </div>
                </div>
              </section>
            ) : null}

            {/* TIMELINE & SLA */}
            <section className="admin-support-inspector__section">
              <span className="admin-support-inspector__section-title">Dòng thời gian</span>
              <div className="admin-support-card-box">
                <div className="admin-support-info-list">
                  <div className="admin-support-info-row">
                    <span>Tạo lúc:</span>
                    <time>{formatDate(selectedTicket.createdAt)}</time>
                  </div>
                  {selectedTicket.firstResponseAt ? (
                    <div className="admin-support-info-row">
                      <span>Phản hồi đầu:</span>
                      <time>{formatDate(selectedTicket.firstResponseAt)}</time>
                    </div>
                  ) : null}
                  {selectedTicket.resolvedAt ? (
                    <div className="admin-support-info-row">
                      <span>Giải quyết:</span>
                      <time>{formatDate(selectedTicket.resolvedAt)}</time>
                    </div>
                  ) : null}
                </div>
              </div>
            </section>
          </div>
        </aside>
      ) : null}

      {/* SPAM CONFIRMATION MODAL */}
      <Modal
        title="Đánh dấu ticket là Spam?"
        description={selectedTicket ? `${selectedTicket.ticketCode} sẽ bị khóa và loại khỏi hàng đợi xử lý.` : undefined}
        isOpen={isSpamConfirmOpen}
        onClose={() => {
          if (!submitting) setIsSpamConfirmOpen(false)
        }}
        actions={(
          <>
            <Button variant="secondary" disabled={submitting} onClick={() => setIsSpamConfirmOpen(false)}>
              Hủy
            </Button>
            <Button variant="danger" disabled={submitting} onClick={() => void handleConfirmSpam()}>
              {submitting ? 'Đang xử lý…' : 'Xác nhận Spam'}
            </Button>
          </>
        )}
      >
        <div className="admin-support-spam-modal-content">
          <AlertTriangle aria-hidden="true" />
          <div>
            <strong>Lưu ý quan trọng:</strong>
            <p>Ticket spam sẽ bị đóng vĩnh viễn và không thể chuyển lại sang các trạng thái thông thường.</p>
          </div>
        </div>
      </Modal>
    </div>
  )
}
