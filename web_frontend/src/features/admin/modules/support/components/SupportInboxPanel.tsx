import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowUpRight,
  FileText,
  Flame,
  ImagePlus,
  Info,
  LoaderCircle,
  Lock,
  MessageSquareText,
  PanelRightClose,
  PanelRightOpen,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  UserCheck,
  X,
} from 'lucide-react'
import { Button, EmptyState, Modal, Pagination, StatusBadge } from '../../../components/ui'
import type { SupportFilters } from '../support.service'
import type {
  CannedResponse,
  FaqCategory,
  SupportCategory,
  SupportPriority,
  SupportPerson,
  SupportSummary,
  SupportTicket,
  SupportTicketDetail,
  SupportTicketStatus,
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
  summary: SupportSummary | null
  filters: SupportFilters
  reply: string
  isInternal: boolean
  selectedCannedId: string
  cannedResponses: CannedResponse[]
  customerTypingTicketId: string | null
  replyFiles: File[]
  statusLabels: Record<SupportTicketStatus, string>
  categoryLabels: Record<SupportCategory | FaqCategory, string>
  priorityLabels: Record<SupportPriority, string>
  statusTones: Record<SupportTicketStatus, 'success' | 'warning' | 'danger' | 'info' | 'neutral'>
  formatDate: (value: string) => string
  getPersonName: (ticket: SupportTicket) => string
  onSelectTicket: (ticketId: string) => void
  onPageChange: (page: number) => void
  onFiltersChange: (updater: (filters: SupportFilters) => SupportFilters) => void
  onRefresh: () => void
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
  summary,
  filters,
  reply,
  isInternal,
  selectedCannedId,
  cannedResponses,
  customerTypingTicketId,
  replyFiles,
  statusLabels,
  categoryLabels,
  priorityLabels,
  statusTones,
  formatDate,
  getPersonName,
  onSelectTicket,
  onPageChange,
  onFiltersChange,
  onRefresh,
  onMutateTicket,
  onCannedChange,
  onReplyChange,
  onInternalChange,
  onFilesChange,
  onSendReply,
}: SupportInboxPanelProps) {
  const [isSpamConfirmOpen, setIsSpamConfirmOpen] = useState(false)
  // Mặc định đóng inspector để khung chat rộng tối đa
  const [inspectorOpen, setInspectorOpen] = useState(false)
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

  const handleStatusChange = (status: SupportTicketStatus) => {
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

  const activeView = filters.assignedTo === currentUserId
    ? 'mine'
    : filters.assignedTo === 'unassigned'
      ? 'unassigned'
      : filters.requiresReply === true
        ? 'reply'
        : 'all'

  const selectView = (view: 'all' | 'reply' | 'mine' | 'unassigned') => {
    onFiltersChange((old) => ({
      ...old,
      page: 1,
      assignedTo: view === 'mine' ? currentUserId : view === 'unassigned' ? 'unassigned' : 'all',
      requiresReply: view === 'reply' ? true : 'all',
    }))
  }

  return (
    <div className={`admin-support-workspace${inspectorOpen ? ' is-inspector-open' : ' is-inspector-closed'}`}>
      {/* ─── CỘT 1: HÀNG ĐỢI TICKET (LEFT SIDEBAR) ─── */}
      <aside className="admin-support-queue" aria-label="Danh sách cuộc hội thoại">
        {/* HEADER HÀNG ĐỢI: TÌM KIẾM & NÚT LÀM MỚI */}
        <header className="admin-support-queue-header">
          <div className="admin-support-queue-search">
            <Search aria-hidden="true" />
            <input
              placeholder="Tìm khách, mã ticket..."
              value={filters.search ?? ''}
              onChange={(e) => onFiltersChange((old) => ({ ...old, search: e.target.value, page: 1 }))}
              aria-label="Tìm kiếm cuộc hội thoại"
            />
            {filters.search ? (
              <button
                type="button"
                className="admin-support-search-clear"
                onClick={() => onFiltersChange((old) => ({ ...old, search: '', page: 1 }))}
                aria-label="Xóa từ khóa tìm kiếm"
              >
                <X aria-hidden="true" />
              </button>
            ) : null}
          </div>

          <button
            type="button"
            className="admin-support-refresh-icon-btn"
            title="Làm mới danh sách"
            aria-label="Làm mới danh sách"
            onClick={onRefresh}
          >
            <RefreshCw aria-hidden="true" />
          </button>
        </header>

        {/* BỘ LỌC NHANH: TẤT CẢ / CẦN TRẢ LỜI / CỦA TÔI / CHƯA NHẬN */}
        <div className="admin-support-queue-tabs" role="group" aria-label="Chế độ xem hàng đợi">
          <button
            type="button"
            className={`admin-support-queue-tab${activeView === 'all' ? ' is-active' : ''}`}
            onClick={() => selectView('all')}
          >
            Tất cả {ticketPagination.totalItems > 0 ? `(${ticketPagination.totalItems})` : ''}
          </button>
          <button
            type="button"
            className={`admin-support-queue-tab is-urgent${activeView === 'reply' ? ' is-active' : ''}`}
            onClick={() => selectView('reply')}
          >
            <Flame aria-hidden="true" />
            Cần trả lời {summary?.waitingAdmin ? `(${summary.waitingAdmin})` : ''}
          </button>
          <button
            type="button"
            className={`admin-support-queue-tab${activeView === 'mine' ? ' is-active' : ''}`}
            onClick={() => selectView('mine')}
          >
            Của tôi
          </button>
          <button
            type="button"
            className={`admin-support-queue-tab${activeView === 'unassigned' ? ' is-active' : ''}`}
            onClick={() => selectView('unassigned')}
          >
            Chưa nhận {summary?.unassigned ? `(${summary.unassigned})` : ''}
          </button>
        </div>

        {/* DANH SÁCH TICKET TINH GỌN */}
        <div className="admin-support-queue-list">
          {loading ? (
            <div className="admin-support-loading">
              <LoaderCircle className="admin-support-spin" aria-hidden="true" />
              <span>Đang tải...</span>
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
                  className={`admin-support-ticket${isSelected ? ' is-selected' : ''}${isNeedsReply ? ' needs-reply' : ''}`}
                  onClick={() => onSelectTicket(ticket._id)}
                >
                  <div className={`admin-support-ticket__avatar status-${ticket.status}`}>
                    {initials}
                  </div>

                  <div className="admin-support-ticket__info">
                    <div className="admin-support-ticket__row1">
                      <strong className="admin-support-ticket__name" title={personName}>
                        {personName}
                      </strong>
                      <time className="admin-support-ticket__time">
                        {formatDate(ticket.lastMessageAt)}
                      </time>
                    </div>

                    <p className="admin-support-ticket__preview" title={ticket.subject}>
                      {ticket.subject}
                    </p>

                    <div className="admin-support-ticket__row2">
                      {isNeedsReply ? (
                        <span className="admin-support-badge is-warning">
                          <span className="admin-support-dot is-orange" />
                          Cần trả lời
                        </span>
                      ) : (
                        <span className={`admin-support-badge tone-${statusTones[ticket.status]}`}>
                          {statusLabels[ticket.status]}
                        </span>
                      )}

                      {ticket.priority === 'urgent' ? (
                        <span className="admin-support-badge is-danger">Khẩn cấp</span>
                      ) : null}
                    </div>
                  </div>
                </button>
              )
            })
          ) : (
            <EmptyState
              title="Không có cuộc hội thoại"
              description="Không tìm thấy ticket nào trong mục này."
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

      {/* ─── CỘT 2: KHUNG HỘI THOẠI CHÍNH (CỰC RỘNG & THOÁNG) ─── */}
      <main className="admin-support-main">
        {detailLoading ? (
          <div className="admin-support-loading is-main">
            <LoaderCircle className="admin-support-spin" aria-hidden="true" />
            <span>Đang tải tin nhắn...</span>
          </div>
        ) : selectedTicket ? (
          <>
            {/* CHAT HEADER: TÊN KHÁCH + TRẠNG THÁI + NÚT THÔNG TIN */}
            <header className="admin-support-chat-header">
              <div className="admin-support-chat-header__left">
                <div className="admin-support-chat-header__avatar">
                  {getInitials(getPersonName(selectedTicket))}
                </div>
                <div className="admin-support-chat-header__titles">
                  <div className="admin-support-chat-header__name-row">
                    <h2>{getPersonName(selectedTicket)}</h2>
                    <span className="admin-support-code-chip">{selectedTicket.ticketCode}</span>
                    <span className="admin-support-category-chip">{categoryLabels[selectedTicket.category]}</span>
                  </div>
                  <span className="admin-support-chat-header__subject" title={selectedTicket.subject}>
                    {selectedTicket.subject}
                  </span>
                </div>
              </div>

              <div className="admin-support-chat-header__right">
                {/* NÚT NHẬN XỬ LÝ NHANH */}
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

                {/* DROPDOWN CHUYỂN TRẠNG THÁI GỌN GÀNG */}
                <select
                  className={`admin-support-status-select tone-${statusTones[selectedTicket.status]}`}
                  value={selectedTicket.status}
                  disabled={submitting}
                  onChange={(e) => handleStatusChange(e.target.value as SupportTicketStatus)}
                  aria-label="Thay đổi trạng thái"
                >
                  {allowedTransitions[selectedTicket.status].map((st) => (
                    <option key={st} value={st}>
                      {statusLabels[st]}
                    </option>
                  ))}
                </select>

                {/* NÚT TOGGLE THÔNG TIN CHI TIẾT */}
                <button
                  type="button"
                  className={`admin-support-toggle-inspector-btn${inspectorOpen ? ' is-active' : ''}`}
                  onClick={() => setInspectorOpen((prev) => !prev)}
                  title={inspectorOpen ? 'Thu gọn thông tin' : 'Mở bảng thông tin chi tiết'}
                  aria-label="Mở bảng thông tin"
                >
                  {inspectorOpen ? <PanelRightClose aria-hidden="true" /> : <PanelRightOpen aria-hidden="true" />}
                  <span>{inspectorOpen ? 'Đóng thông tin' : 'Thông tin'}</span>
                </button>
              </div>
            </header>

            {/* VÙNG TIN NHẮN (CHAT THREAD) RỘNG RÃI */}
            <div className="admin-support-thread" ref={threadRef} aria-live="polite">
              {detail.messages.map((message) => {
                const isCustomer = message.senderType === 'customer'
                const isStaff = message.senderType === 'staff' && !message.isInternal
                const isNote = message.isInternal

                return (
                  <div
                    key={message._id}
                    className={`admin-support-bubble-row${isCustomer ? ' is-customer' : ''}${isStaff ? ' is-staff' : ''}${isNote ? ' is-note' : ''}`}
                  >
                    <div className="admin-support-bubble">
                      <div className="admin-support-bubble__meta">
                        <strong>
                          {isNote
                            ? '🔒 Ghi chú nội bộ'
                            : isStaff
                              ? 'Nhân viên hỗ trợ'
                              : getPersonName(selectedTicket)}
                        </strong>
                        <time>{formatDate(message.createdAt)}</time>
                      </div>

                      <div className="admin-support-bubble__text">
                        <p>{message.body}</p>
                      </div>

                      {message.attachments.length > 0 ? (
                        <div className="admin-support-bubble__images">
                          {message.attachments.map((file) => (
                            <a
                              href={file.url}
                              target="_blank"
                              rel="noreferrer"
                              key={file.publicId}
                              className="admin-support-image-item"
                              title="Xem ảnh phóng to"
                            >
                              <img src={file.url} alt="Ảnh đính kèm" loading="lazy" />
                              <span className="admin-support-image-zoom">
                                <ArrowUpRight aria-hidden="true" />
                              </span>
                            </a>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                )
              })}

              {customerTypingTicketId === selectedTicket._id ? (
                <div className="admin-support-typing-bar" aria-live="polite">
                  <span className="admin-support-typing-dot" />
                  <span className="admin-support-typing-dot" />
                  <span className="admin-support-typing-dot" />
                  <span>Khách hàng đang soạn tin...</span>
                </div>
              ) : null}
            </div>

            {/* KHUNG SOẠN THẢO (COMPOSER) */}
            {isTicketClosed ? (
              <div className="admin-support-closed-banner">
                <div className="admin-support-closed-banner__text">
                  <Info aria-hidden="true" />
                  <span>
                    Ticket đang ở trạng thái <b>{statusLabels[selectedTicket.status]}</b>.
                  </span>
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
              <div className={`admin-support-composer${isInternal ? ' is-note-mode' : ''}`}>
                {/* TOOLBAR SOẠN THẢO GỌN NHẸ */}
                <div className="admin-support-composer__tools">
                  <div className="admin-support-composer__mode-switch">
                    <button
                      type="button"
                      className={`admin-support-composer__mode-btn${!isInternal ? ' is-active' : ''}`}
                      onClick={() => onInternalChange(false)}
                    >
                      <MessageSquareText aria-hidden="true" />
                      Phản hồi khách
                    </button>
                    <button
                      type="button"
                      className={`admin-support-composer__mode-btn is-note${isInternal ? ' is-active' : ''}`}
                      onClick={() => onInternalChange(true)}
                    >
                      <Lock aria-hidden="true" />
                      Ghi chú nội bộ
                    </button>
                  </div>

                  {canManage ? (
                    <select
                      className="admin-support-canned-dropdown"
                      value={selectedCannedId}
                      onChange={(e) => onCannedChange(e.target.value)}
                      aria-label="Chọn mẫu trả lời nhanh"
                    >
                      <option value="">⚡ Chọn mẫu trả lời nhanh...</option>
                      {cannedResponses
                        .filter((item) => item.isActive && (!item.category || item.category === selectedTicket.category))
                        .map((item) => (
                          <option key={item._id} value={item._id}>
                            {item.title}
                          </option>
                        ))}
                    </select>
                  ) : null}
                </div>

                {/* TEXTAREA NHẬP TIN NHẮN */}
                <textarea
                  ref={textareaRef}
                  rows={3}
                  value={reply}
                  onChange={(e) => onReplyChange(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && reply.trim() && !submitting) {
                      e.preventDefault()
                      void onSendReply()
                    }
                  }}
                  placeholder={
                    isInternal
                      ? 'Nhập ghi chú nội bộ (Chỉ nhân viên & admin nhìn thấy)...'
                      : 'Nhập nội dung phản hồi cho khách hàng...'
                  }
                  maxLength={3000}
                  aria-label={isInternal ? 'Ghi chú nội bộ' : 'Tin nhắn phản hồi'}
                />

                {/* DANH SÁCH ẢNH ĐÍNH KÈM XEM TRƯỚC */}
                {replyFiles.length > 0 ? (
                  <div className="admin-support-composer__file-preview">
                    {replyFiles.map((file, idx) => (
                      <div className="admin-support-file-chip" key={`${file.name}-${idx}`}>
                        <FileText aria-hidden="true" />
                        <span className="admin-support-file-name" title={file.name}>{file.name}</span>
                        <button
                          type="button"
                          className="admin-support-file-remove"
                          onClick={() => handleRemoveFile(idx)}
                          aria-label={`Bỏ file ${file.name}`}
                        >
                          <X aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                {/* FOOTER: ĐÍNH KÈM + NÚT GỬI */}
                <div className="admin-support-composer__footer">
                  <label className="admin-support-attach-action">
                    <ImagePlus aria-hidden="true" />
                    <span>Đính kèm ảnh</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      onChange={(e) => onFilesChange(Array.from(e.target.files ?? []))}
                    />
                  </label>

                  <span className="admin-support-composer__shortcut">
                    Nhấn <b>Ctrl + Enter</b> để gửi
                  </span>

                  <button
                    className={`admin-support-send-action${isInternal ? ' is-note' : ''}`}
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
          <div className="admin-support-empty-view">
            <MessageSquareText aria-hidden="true" />
            <h3>Chưa chọn cuộc hội thoại</h3>
            <p>Chọn một ticket ở danh sách bên trái để xem tin nhắn và phản hồi khách hàng.</p>
          </div>
        )}
      </main>

      {/* ─── CỘT 3: BẢNG THÔNG TIN CHI TIẾT (INSPECTOR - MẶC ĐỊNH ĐÓNG) ─── */}
      {selectedTicket && inspectorOpen ? (
        <aside className="admin-support-inspector" aria-label="Bảng thông tin chi tiết">
          <header className="admin-support-inspector__header">
            <strong>Thông tin &amp; Điều phối</strong>
            <button
              type="button"
              className="admin-support-inspector__close-btn"
              onClick={() => setInspectorOpen(false)}
              aria-label="Đóng bảng thông tin"
            >
              <X aria-hidden="true" />
            </button>
          </header>

          <div className="admin-support-inspector__body">
            {/* THÔNG TIN KHÁCH HÀNG */}
            <div className="admin-support-inspector-group">
              <span className="admin-support-inspector-group__title">Khách hàng</span>
              <div className="admin-support-info-card">
                <div className="admin-support-customer-row">
                  <div className="admin-support-customer-avatar">
                    {getInitials(getPersonName(selectedTicket))}
                  </div>
                  <div>
                    <strong>{getPersonName(selectedTicket)}</strong>
                    <small>{selectedTicket.userId ? 'Thành viên' : 'Khách vãng lai'}</small>
                  </div>
                </div>

                <div className="admin-support-info-lines">
                  {typeof selectedTicket.userId === 'object' && selectedTicket.userId?.email ? (
                    <div className="admin-support-info-line">
                      <span>Email:</span>
                      <a href={`mailto:${selectedTicket.userId.email}`}>{selectedTicket.userId.email}</a>
                    </div>
                  ) : selectedTicket.guestContact?.email ? (
                    <div className="admin-support-info-line">
                      <span>Email:</span>
                      <a href={`mailto:${selectedTicket.guestContact.email}`}>{selectedTicket.guestContact.email}</a>
                    </div>
                  ) : null}

                  {typeof selectedTicket.userId === 'object' && selectedTicket.userId?.phone ? (
                    <div className="admin-support-info-line">
                      <span>SĐT:</span>
                      <a href={`tel:${selectedTicket.userId.phone}`}>{selectedTicket.userId.phone}</a>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* ĐƠN HÀNG LIÊN QUAN */}
            {selectedTicket.orderId ? (
              <div className="admin-support-inspector-group">
                <span className="admin-support-inspector-group__title">Đơn hàng liên quan</span>
                <div className="admin-support-info-card is-order">
                  <div className="admin-support-order-row">
                    <strong>
                      {typeof selectedTicket.orderId === 'string'
                        ? selectedTicket.orderId
                        : selectedTicket.orderId.orderCode}
                    </strong>
                    {typeof selectedTicket.orderId === 'object' ? (
                      <StatusBadge tone="info">{selectedTicket.orderId.status}</StatusBadge>
                    ) : null}
                  </div>
                  <a href="/admin/orders" className="admin-support-order-view-link">
                    <span>Xem quản lý đơn</span>
                    <ArrowUpRight aria-hidden="true" />
                  </a>
                </div>
              </div>
            ) : null}

            {/* PHÂN CÔNG & PHÂN LOẠI */}
            <div className="admin-support-inspector-group">
              <span className="admin-support-inspector-group__title">Phân công &amp; Phân loại</span>
              <div className="admin-support-fields-block">
                <label>
                  <span>Người xử lý</span>
                  <select
                    value={typeof selectedTicket.assignedTo === 'string' ? selectedTicket.assignedTo : selectedTicket.assignedTo?._id ?? ''}
                    disabled={submitting}
                    onChange={(e) => void onMutateTicket({ assignedTo: e.target.value || null })}
                  >
                    <option value="">Chưa phân công</option>
                    {assignees.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name || p.email} {p._id === currentUserId ? '(Tôi)' : ''}
                      </option>
                    ))}
                  </select>
                </label>

                {!isAssignedToMe && selectedTicket.assignedTo ? (
                  <button
                    type="button"
                    className="admin-support-reassign-btn"
                    disabled={submitting}
                    onClick={() => void onMutateTicket({ assignedTo: currentUserId })}
                  >
                    Giao lại cho tôi
                  </button>
                ) : null}

                <label>
                  <span>Mức ưu tiên</span>
                  <select
                    value={selectedTicket.priority}
                    disabled={submitting}
                    onChange={(e) => void onMutateTicket({ priority: e.target.value as SupportPriority })}
                  >
                    {Object.entries(priorityLabels).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Danh mục</span>
                  <select
                    value={selectedTicket.category}
                    disabled={submitting}
                    onChange={(e) => void onMutateTicket({ category: e.target.value as SupportCategory })}
                  >
                    {Object.entries(categoryLabels).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {/* NGỮ CẢNH & THIẾT BỊ */}
            {selectedTicket.context ? (
              <div className="admin-support-inspector-group">
                <span className="admin-support-inspector-group__title">Kỹ thuật &amp; Thiết bị</span>
                <div className="admin-support-info-card">
                  <div className="admin-support-info-lines">
                    {selectedTicket.context.appPlatform ? (
                      <div className="admin-support-info-line">
                        <span>Nền tảng:</span>
                        <strong>{selectedTicket.context.appPlatform} {selectedTicket.context.appVersion ?? ''}</strong>
                      </div>
                    ) : null}
                    {selectedTicket.context.screen ? (
                      <div className="admin-support-info-line">
                        <span>Màn hình:</span>
                        <span>{selectedTicket.context.screen}</span>
                      </div>
                    ) : null}
                    {selectedTicket.context.errorCode ? (
                      <div className="admin-support-info-line">
                        <span>Mã lỗi:</span>
                        <code>{selectedTicket.context.errorCode}</code>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            {/* DÒNG THỜI GIAN */}
            <div className="admin-support-inspector-group">
              <span className="admin-support-inspector-group__title">Thời gian</span>
              <div className="admin-support-info-card">
                <div className="admin-support-info-lines">
                  <div className="admin-support-info-line">
                    <span>Tạo lúc:</span>
                    <time>{formatDate(selectedTicket.createdAt)}</time>
                  </div>
                  {selectedTicket.firstResponseAt ? (
                    <div className="admin-support-info-line">
                      <span>Phản hồi đầu:</span>
                      <time>{formatDate(selectedTicket.firstResponseAt)}</time>
                    </div>
                  ) : null}
                  {selectedTicket.resolvedAt ? (
                    <div className="admin-support-info-line">
                      <span>Giải quyết:</span>
                      <time>{formatDate(selectedTicket.resolvedAt)}</time>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </aside>
      ) : null}

      {/* MODAL XÁC NHẬN SPAM */}
      <Modal
        title="Đánh dấu ticket là Spam?"
        description={selectedTicket ? `${selectedTicket.ticketCode} sẽ bị khóa vĩnh viễn.` : undefined}
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
        <div className="admin-support-spam-dialog">
          <AlertTriangle aria-hidden="true" />
          <p>Ticket spam sẽ bị đóng vĩnh viễn và loại bỏ khỏi danh sách xử lý.</p>
        </div>
      </Modal>
    </div>
  )
}
