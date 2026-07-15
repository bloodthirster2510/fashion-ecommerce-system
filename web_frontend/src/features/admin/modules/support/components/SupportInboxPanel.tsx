import { Button, EmptyState, Pagination, StatusBadge } from '../../../components/ui'
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
  const selectedTicket = detail?.ticket
  const allowedTransitions: Record<SupportTicketStatus, SupportTicketStatus[]> = {
    open: ['open', 'in_progress', 'resolved', 'closed', ...(canMarkSpam ? ['spam' as const] : [])],
    in_progress: ['in_progress', 'resolved', 'closed', ...(canMarkSpam ? ['spam' as const] : [])],
    waiting_customer: ['waiting_customer', 'in_progress', 'resolved', 'closed', ...(canMarkSpam ? ['spam' as const] : [])],
    resolved: ['resolved', 'in_progress', 'closed', ...(canMarkSpam ? ['spam' as const] : [])],
    closed: ['closed', 'in_progress'],
    spam: ['spam'],
  }

  return (
    <div className="admin-support-workspace">
      <aside className="admin-support-queue" aria-label="Danh sách ticket">
        {loading ? <p className="admin-support-empty">Đang tải ticket...</p> : tickets.length ? tickets.map((ticket) => (
          <button key={ticket._id} type="button" className={`admin-support-ticket${ticket._id === selectedId ? ' is-selected' : ''}${ticket.requiresReply ? ' needs-reply' : ''}`} onClick={() => onSelectTicket(ticket._id)}>
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
            onPageChange={onPageChange}
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
                  <Button variant="primary" disabled={submitting} onClick={() => void onMutateTicket({ assignedTo: currentUserId })}>
                    Nhận xử lý
                  </Button>
                )}
                <select aria-label="Người xử lý" value={typeof selectedTicket.assignedTo === 'string' ? selectedTicket.assignedTo : selectedTicket.assignedTo?._id ?? ''} disabled={submitting} onChange={(event) => void onMutateTicket({ assignedTo: event.target.value || null })}>
                  <option value="">Chưa phân công</option>
                  {assignees.map((person) => <option key={person._id} value={person._id}>{person.name || person.email}</option>)}
                </select>
                <select aria-label="Mức ưu tiên" value={selectedTicket.priority} disabled={submitting} onChange={(event) => void onMutateTicket({ priority: event.target.value as SupportPriority })}>
                  {Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <select aria-label="Danh mục ticket" value={selectedTicket.category} disabled={submitting} onChange={(event) => void onMutateTicket({ category: event.target.value as SupportCategory })}>
                  {Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <select aria-label="Trạng thái ticket" value={selectedTicket.status} disabled={submitting} onChange={(event) => void onMutateTicket({ status: event.target.value as SupportTicketStatus })}>
                  {allowedTransitions[selectedTicket.status].map((value) => <option key={value} value={value}>{statusLabels[value]}</option>)}
                </select>
              </div>
            </header>

            {(selectedTicket.orderId || selectedTicket.couponCode || selectedTicket.context) && (
              <div className="admin-support-context">
                {selectedTicket.orderId && <a href="/admin/orders">Đơn: {typeof selectedTicket.orderId === 'string' ? selectedTicket.orderId : `${selectedTicket.orderId.orderCode} · ${selectedTicket.orderId.status} · ${selectedTicket.orderId.paymentStatus ?? ''}`}</a>}
                {selectedTicket.couponCode && <span>Voucher: {selectedTicket.couponCode}</span>}
                {selectedTicket.context?.source && <span>Nguồn: {selectedTicket.context.source}</span>}
                {selectedTicket.context?.appPlatform && <span>Nền tảng: {selectedTicket.context.appPlatform}{selectedTicket.context.appVersion ? ` ${selectedTicket.context.appVersion}` : ''}</span>}
                {selectedTicket.context?.screen && <span>Màn hình: {selectedTicket.context.screen}</span>}
                {selectedTicket.context?.errorCode && <span>Mã lỗi: {selectedTicket.context.errorCode}</span>}
              </div>
            )}

            <div className="admin-support-context">
              {typeof selectedTicket.userId === 'object' && selectedTicket.userId && <><span>Email: {selectedTicket.userId.email}</span>{selectedTicket.userId.phone && <span>SĐT: {selectedTicket.userId.phone}</span>}</>}
              {selectedTicket.guestContact?.email && <span>Email khách: {selectedTicket.guestContact.email}</span>}
              <span>Tạo: {formatDate(selectedTicket.createdAt)}</span>
              {selectedTicket.firstResponseAt && <span>Phản hồi đầu: {formatDate(selectedTicket.firstResponseAt)}</span>}
              {selectedTicket.resolvedAt && <span>Giải quyết: {formatDate(selectedTicket.resolvedAt)}</span>}
            </div>

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

            {!['closed', 'spam', 'resolved'].includes(selectedTicket.status) && <div className="admin-support-composer">
              {canManage && <select value={selectedCannedId} onChange={(event) => onCannedChange(event.target.value)} aria-label="Chọn mẫu trả lời">
                <option value="">Chọn mẫu trả lời nhanh...</option>
                {cannedResponses.filter((item) => item.isActive && (!item.category || item.category === selectedTicket.category)).map((item) => <option key={item._id} value={item._id}>{item.title}</option>)}
              </select>}
              <textarea rows={4} value={reply} onChange={(event) => onReplyChange(event.target.value)} placeholder={isInternal ? 'Ghi chú chỉ nhân viên nhìn thấy...' : 'Nhập phản hồi cho khách hàng...'} maxLength={3000} />
              <div>
                <label><input type="checkbox" checked={isInternal} onChange={(event) => onInternalChange(event.target.checked)} /> Ghi chú nội bộ</label>
                <label className="admin-support-file">Đính kèm ảnh<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => onFilesChange(Array.from(event.target.files ?? []))} /></label>
                <button type="button" disabled={!reply.trim() || submitting} onClick={() => void onSendReply()}>{submitting ? 'Đang gửi...' : isInternal ? 'Lưu ghi chú' : 'Gửi phản hồi'}</button>
              </div>
            </div>}
          </>
        ) : <p className="admin-support-empty">Chọn một ticket để xem chi tiết.</p>}
      </main>
    </div>
  )
}
