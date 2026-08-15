import { useState } from 'react'
import { AlertTriangle, ImagePlus, MessageSquareText, PanelRightClose, PanelRightOpen, StickyNote } from 'lucide-react'
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
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const selectedTicket = detail?.ticket
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

  return (
    <div className="admin-support-workspace">
      <aside className="admin-support-queue" aria-label="Danh sách ticket">
        <header className="admin-support-queue-header">
          <div>
            <span>Hàng đợi</span>
            <strong>{ticketPagination.totalItems}</strong>
          </div>
          {ticketPagination.totalPages > 1 ? <small>Trang {ticketPagination.page}/{ticketPagination.totalPages}</small> : null}
        </header>
        {loading ? <p className="admin-support-empty">Đang tải ticket...</p> : tickets.length ? tickets.map((ticket) => (
          <button key={ticket._id} type="button" className={`admin-support-ticket status-${ticket.status}${ticket._id === selectedId ? ' is-selected' : ''}${ticket.requiresReply ? ' needs-reply' : ''}`} onClick={() => onSelectTicket(ticket._id)}>
            <span className="admin-support-ticket-top"><strong>{ticket.ticketCode}</strong><time>{formatDate(ticket.lastMessageAt)}</time></span>
            <b title={ticket.subject}>{ticket.subject}</b>
            <span className="admin-support-ticket-customer">{getPersonName(ticket)} <i /> {categoryLabels[ticket.category]}</span>
            <span className="admin-support-ticket-bottom">
              <span>
                {ticket.requiresReply
                  ? <StatusBadge tone="warning">Cần trả lời</StatusBadge>
                  : <StatusBadge tone={statusTones[ticket.status]}>{statusLabels[ticket.status]}</StatusBadge>}
              </span>
              {ticket.priority !== 'normal' ? <StatusBadge tone={priorityTones[ticket.priority]}>{priorityLabels[ticket.priority]}</StatusBadge> : null}
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
            onPageChange={onPageChange}
          />
        ) : null}
      </aside>

      <main className={`admin-support-detail${inspectorOpen ? '' : ' is-inspector-collapsed'}`}>
        {detailLoading ? <p className="admin-support-empty">Đang tải hội thoại...</p> : selectedTicket ? (
          <>
            <header className="admin-support-detail-header">
              <div>
                <p>{selectedTicket.ticketCode}</p>
                <h2>{selectedTicket.subject}</h2>
                <span>{getPersonName(selectedTicket)} · {typeLabels[selectedTicket.type]}</span>
              </div>
              <div className="admin-support-detail-side">
                <div className={`admin-support-detail-badges status-${selectedTicket.status}`}>
                  <StatusBadge tone={statusTones[selectedTicket.status]}>{statusLabels[selectedTicket.status]}</StatusBadge>
                  {selectedTicket.priority !== 'normal' ? <StatusBadge tone={priorityTones[selectedTicket.priority]}>{priorityLabels[selectedTicket.priority]}</StatusBadge> : null}
                  {selectedTicket.requiresReply ? <StatusBadge tone="warning">Cần trả lời</StatusBadge> : null}
                </div>
                {!selectedTicket.assignedTo && (
                  <Button variant="primary" disabled={submitting} onClick={() => void onMutateTicket({ assignedTo: currentUserId })}>
                    Nhận xử lý
                  </Button>
                )}
                <button
                  className="admin-support-inspector-toggle"
                  type="button"
                  aria-expanded={inspectorOpen}
                  aria-controls="support-ticket-inspector"
                  onClick={() => setInspectorOpen((open) => !open)}
                >
                  {inspectorOpen ? <PanelRightClose aria-hidden="true" /> : <PanelRightOpen aria-hidden="true" />}
                  {inspectorOpen ? 'Đóng thông tin' : 'Thông tin'}
                </button>
              </div>
            </header>

            <aside id="support-ticket-inspector" className="admin-support-inspector" aria-label="Điều phối và thông tin ticket">
            <section className="admin-support-actions" aria-labelledby="ticket-actions-title">
              <header className="admin-support-actions-header">
                <div>
                  <strong id="ticket-actions-title">Thông tin phiếu hỗ trợ</strong>
                </div>
                <span className={`admin-support-save-state${submitting ? ' is-saving' : ''}`} aria-live="polite">
                  <i /> {submitting ? 'Đang lưu' : 'Đã lưu'}
                </span>
              </header>

              <div className="admin-support-status-action">
                <div className="admin-support-status-transition">
                  <span>Thao tác nhanh</span>
                  <div className="admin-support-status-options" role="group" aria-label="Cập nhật trạng thái ticket">
                  {allowedTransitions[selectedTicket.status].filter((value) => value !== selectedTicket.status).map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`status-${value}`}
                      disabled={submitting}
                      onClick={() => handleStatusAction(value)}
                    >
                      <i aria-hidden="true" />
                      {statusActionLabels[value]}
                    </button>
                  ))}
                  {allowedTransitions[selectedTicket.status].length === 1 ? <small>Không có thao tác trạng thái tiếp theo</small> : null}
                  </div>
                </div>
              </div>

              <div className="admin-support-assignment">
                <div className="admin-support-assignment-heading">
                  <strong>Phân công &amp; phân loại</strong>
                </div>
                <label className="admin-support-action-field admin-support-action-field--assignee">
                  <span>Người xử lý</span>
                  <select aria-label="Người xử lý" value={typeof selectedTicket.assignedTo === 'string' ? selectedTicket.assignedTo : selectedTicket.assignedTo?._id ?? ''} disabled={submitting} onChange={(event) => void onMutateTicket({ assignedTo: event.target.value || null })}>
                    <option value="">Chưa phân công</option>
                    {assignees.map((person) => <option key={person._id} value={person._id}>{person.name || person.email}</option>)}
                  </select>
                </label>
                <label className="admin-support-action-field">
                  <span>Ưu tiên</span>
                  <select aria-label="Mức ưu tiên" value={selectedTicket.priority} disabled={submitting} onChange={(event) => void onMutateTicket({ priority: event.target.value as SupportPriority })}>
                    {Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="admin-support-action-field admin-support-action-field--category">
                  <span>Danh mục</span>
                  <select aria-label="Danh mục ticket" value={selectedTicket.category} disabled={submitting} onChange={(event) => void onMutateTicket({ category: event.target.value as SupportCategory })}>
                    {Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
              </div>
            </section>

            <section className="admin-support-meta" aria-label="Thông tin ticket">
              <div className="admin-support-meta-group">
                <strong>Khách hàng</strong>
                {typeof selectedTicket.userId === 'object' && selectedTicket.userId && <><span>{selectedTicket.userId.email}</span>{selectedTicket.userId.phone && <span>{selectedTicket.userId.phone}</span>}</>}
                {selectedTicket.guestContact?.email && <span>{selectedTicket.guestContact.email}</span>}
                <span>Tạo lúc {formatDate(selectedTicket.createdAt)}</span>
                {selectedTicket.firstResponseAt && <span>Phản hồi đầu {formatDate(selectedTicket.firstResponseAt)}</span>}
                {selectedTicket.resolvedAt && <span>Giải quyết {formatDate(selectedTicket.resolvedAt)}</span>}
              </div>
              {(selectedTicket.orderId || selectedTicket.couponCode || selectedTicket.context) && (
                <div className="admin-support-meta-group">
                  <strong>Liên kết &amp; nguồn</strong>
                  {selectedTicket.orderId && <a href="/admin/orders">Đơn: {typeof selectedTicket.orderId === 'string' ? selectedTicket.orderId : `${selectedTicket.orderId.orderCode} · ${selectedTicket.orderId.status} · ${selectedTicket.orderId.paymentStatus ?? ''}`}</a>}
                  {selectedTicket.couponCode && <span>Voucher: {selectedTicket.couponCode}</span>}
                  {selectedTicket.context?.source && <span>Nguồn: {selectedTicket.context.source}</span>}
                  {selectedTicket.context?.appPlatform && <span>Nền tảng: {selectedTicket.context.appPlatform}{selectedTicket.context.appVersion ? ` ${selectedTicket.context.appVersion}` : ''}</span>}
                  {selectedTicket.context?.screen && <span>Màn hình: {selectedTicket.context.screen}</span>}
                  {selectedTicket.context?.errorCode && <span>Mã lỗi: {selectedTicket.context.errorCode}</span>}
                </div>
              )}
            </section>
            </aside>

            <section className="admin-support-conversation" aria-label="Hội thoại với khách hàng">
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

            {!['closed', 'spam', 'resolved'].includes(selectedTicket.status) ? <div className={`admin-support-composer${isInternal ? ' is-internal' : ''}`}>
              <div className="admin-support-composer-head">
                <div className="admin-support-compose-modes" role="group" aria-label="Loại nội dung">
                  <button type="button" className={!isInternal ? 'is-active' : ''} aria-pressed={!isInternal} onClick={() => onInternalChange(false)}><MessageSquareText aria-hidden="true" /> Phản hồi khách</button>
                  <button type="button" className={isInternal ? 'is-active' : ''} aria-pressed={isInternal} onClick={() => onInternalChange(true)}><StickyNote aria-hidden="true" /> Ghi chú nội bộ</button>
                </div>
                {canManage && <select value={selectedCannedId} onChange={(event) => onCannedChange(event.target.value)} aria-label="Chọn mẫu trả lời">
                  <option value="">Mẫu trả lời nhanh...</option>
                  {cannedResponses.filter((item) => item.isActive && (!item.category || item.category === selectedTicket.category)).map((item) => <option key={item._id} value={item._id}>{item.title}</option>)}
                </select>}
              </div>
              <textarea rows={4} value={reply} onChange={(event) => onReplyChange(event.target.value)} placeholder={isInternal ? 'Ghi chú này chỉ nhân viên nhìn thấy...' : 'Nhập nội dung phản hồi cho khách hàng...'} maxLength={3000} />
              <div className="admin-support-composer-footer">
                <label className="admin-support-file"><ImagePlus aria-hidden="true" /> Đính kèm ảnh<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => onFilesChange(Array.from(event.target.files ?? []))} /></label>
                <span>Tối đa 3 ảnh, mỗi ảnh 5 MB</span>
                <button className="admin-support-send" type="button" disabled={!reply.trim() || submitting} onClick={() => void onSendReply()}>{submitting ? 'Đang gửi...' : isInternal ? 'Lưu ghi chú' : 'Gửi phản hồi'}</button>
              </div>
            </div> : (
              <div className="admin-support-closed-notice">
                <strong>Ticket hiện không nhận phản hồi</strong>
                <span>Chuyển trạng thái sang “Đang xử lý” nếu cần tiếp tục trao đổi.</span>
              </div>
            )}
            </section>
          </>
        ) : <p className="admin-support-empty">Chọn một ticket để xem chi tiết.</p>}
      </main>

      <Modal
        title="Đánh dấu ticket là spam?"
        description={selectedTicket ? `${selectedTicket.ticketCode} sẽ được đưa ra khỏi hàng đợi xử lý.` : undefined}
        isOpen={isSpamConfirmOpen}
        onClose={() => {
          if (!submitting) setIsSpamConfirmOpen(false)
        }}
        actions={(
          <>
            <Button variant="secondary" disabled={submitting} onClick={() => setIsSpamConfirmOpen(false)}>Hủy</Button>
            <Button variant="danger" disabled={submitting} onClick={() => void handleConfirmSpam()}>
              {submitting ? 'Đang xử lý…' : 'Đánh dấu spam'}
            </Button>
          </>
        )}
      >
        <div className="admin-support-spam-warning">
          <AlertTriangle aria-hidden="true" />
          <div>
            <strong>Chỉ tiếp tục nếu đây thực sự là nội dung rác.</strong>
            <span>Ticket spam sẽ bị khóa phản hồi và không thể chuyển lại sang trạng thái khác.</span>
          </div>
        </div>
      </Modal>
    </div>
  )
}
