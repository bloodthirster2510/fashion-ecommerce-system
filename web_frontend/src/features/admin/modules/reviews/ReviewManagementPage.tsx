import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { deletePendingReview, getModerationRules, listAdminReviews, replyToReview, setManyReviewStatuses } from './review.service'
import type { AdminReview, ModerationRules, ReviewFilters, ReviewListResponse, ReviewStatus } from './review.types'
import { hasPermission, type AdminUser } from '../auth/adminSession'
import './review.css'

const initialFilters: ReviewFilters = {
  keyword: '', rating: '', status: '', productId: '', period: '', hasImages: '', page: 1,
}

const MIN_ADMIN_REPLY_LENGTH = 10
const MAX_ADMIN_REPLY_LENGTH = 2000

const statusMeta: Record<ReviewStatus, { label: string; className: string }> = {
  pending: { label: 'Chờ duyệt', className: 'is-warning' },
  visible: { label: 'Đã hiển thị', className: 'is-active' },
  hidden: { label: 'Đã ẩn', className: 'is-blocked' },
}

const formatDate = (value: string) => new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
}).format(new Date(value))

const formatOrderItemVariant = (item?: NonNullable<AdminReview['order']>['item']) => {
  if (!item) return ''
  return [item.fitType, item.color, item.size ? `Size ${item.size}` : ''].filter(Boolean).join(' · ')
}

export function ReviewManagementPage({ currentUser }: { currentUser: AdminUser }) {
  const [filters, setFilters] = useState(initialFilters)
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  const [data, setData] = useState<ReviewListResponse | null>(null)
  const [rules, setRules] = useState<ModerationRules | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [showRules, setShowRules] = useState(false)
  const [replyingReview, setReplyingReview] = useState<AdminReview | null>(null)
  const [reply, setReply] = useState('')
  const [replyError, setReplyError] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const tableShellRef = useRef<HTMLDivElement>(null)
  const stickyScrollbarRef = useRef<HTMLDivElement>(null)
  const stickyScrollbarContentRef = useRef<HTMLDivElement>(null)
  const { rating, status, productId, period, hasImages, page } = filters
  const canModerate = hasPermission(currentUser, 'reviews.moderate')
  const canReply = hasPermission(currentUser, 'reviews.reply')

  useEffect(() => {
    // Debounce keyword để admin gõ tìm kiếm không bắn request cho từng phím.
    const timer = window.setTimeout(() => setDebouncedKeyword(filters.keyword), 350)
    return () => window.clearTimeout(timer)
  }, [filters.keyword])

  const loadReviews = useCallback(async () => {
    setLoading(true)
    try {
      const result = await listAdminReviews({
        keyword: debouncedKeyword, rating, status, productId, period, hasImages, page,
      })
      setData(result)
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Không thể tải đánh giá' })
    } finally {
      setLoading(false)
    }
  }, [rating, status, productId, period, hasImages, page, debouncedKeyword])

  useEffect(() => { void loadReviews() }, [loadReviews])
  useEffect(() => { void getModerationRules().then(setRules).catch(() => undefined) }, [])
  useEffect(() => {
    // Chỉ review pending mới được bulk approve; khi đổi trang/lọc thì bỏ các id không còn hợp lệ.
    const pendingIds = new Set(
      data?.items.filter((review) => review.status === 'pending').map((review) => review._id) ?? [],
    )
    setSelectedIds((current) => current.filter((id) => pendingIds.has(id)))
  }, [data])

  useEffect(() => {
    const tableShell = tableShellRef.current
    const stickyScrollbar = stickyScrollbarRef.current
    const stickyScrollbarContent = stickyScrollbarContentRef.current
    if (!tableShell || !stickyScrollbar || !stickyScrollbarContent) return

    let isSyncing = false
    const updateStickyScrollbar = () => {
      // Bảng review nhiều cột nên scrollbar dưới cùng có thể khuất khỏi viewport.
      // Thanh sticky này chỉ hiện khi bảng đang tràn ngang và đáy bảng nằm dưới màn hình.
      const rect = tableShell.getBoundingClientRect()
      const hasHorizontalOverflow = tableShell.scrollWidth > tableShell.clientWidth
      const tableCrossesViewportBottom = rect.top < window.innerHeight && rect.bottom > window.innerHeight

      stickyScrollbar.hidden = !hasHorizontalOverflow || !tableCrossesViewportBottom
      stickyScrollbar.style.left = `${Math.max(0, rect.left)}px`
      stickyScrollbar.style.width = `${Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(0, rect.left))}px`
      stickyScrollbarContent.style.width = `${tableShell.scrollWidth}px`
      stickyScrollbar.scrollLeft = tableShell.scrollLeft
    }
    const syncScroll = (source: HTMLDivElement, target: HTMLDivElement) => {
      // Guard tránh hai scrollbar bắn event qua lại vô hạn.
      if (isSyncing) return
      isSyncing = true
      target.scrollLeft = source.scrollLeft
      window.requestAnimationFrame(() => { isSyncing = false })
    }
    const handleTableScroll = () => syncScroll(tableShell, stickyScrollbar)
    const handleStickyScroll = () => syncScroll(stickyScrollbar, tableShell)
    const resizeObserver = new ResizeObserver(updateStickyScrollbar)
    const contentScroller = tableShell.closest('.admin-content')

    tableShell.addEventListener('scroll', handleTableScroll)
    stickyScrollbar.addEventListener('scroll', handleStickyScroll)
    window.addEventListener('resize', updateStickyScrollbar)
    window.addEventListener('scroll', updateStickyScrollbar)
    contentScroller?.addEventListener('scroll', updateStickyScrollbar)
    resizeObserver.observe(tableShell)
    resizeObserver.observe(tableShell.firstElementChild ?? tableShell)
    updateStickyScrollbar()

    return () => {
      tableShell.removeEventListener('scroll', handleTableScroll)
      stickyScrollbar.removeEventListener('scroll', handleStickyScroll)
      window.removeEventListener('resize', updateStickyScrollbar)
      window.removeEventListener('scroll', updateStickyScrollbar)
      contentScroller?.removeEventListener('scroll', updateStickyScrollbar)
      resizeObserver.disconnect()
    }
  }, [loading, data?.items.length])

  const updateFilter = (key: keyof ReviewFilters, value: string | number) => {
    // Bất kỳ filter nào ngoài page đều reset về trang đầu để tránh rơi vào trang rỗng.
    setFilters((current) => ({ ...current, [key]: value, ...(key !== 'page' ? { page: 1 } : {}) }))
  }

  const handleBulkApprove = async () => {
    if (!selectedIds.length) return
    setActionLoading(true)
    try {
      // Bulk approve chỉ gửi id đã chọn; backend sẽ dedupe và refresh rating theo product liên quan.
      const result = await setManyReviewStatuses(selectedIds, 'visible')
      setNotice({
        type: 'success',
        message: `Đã duyệt ${result.updatedCount} đánh giá.`,
      })
      setSelectedIds([])
      await loadReviews()
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Không thể xử lý đánh giá đã chọn' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteReview = async (review: AdminReview) => {
    if (!window.confirm('Xóa đánh giá chưa được phê duyệt này?')) return
    setActionLoading(true)
    try {
      await deletePendingReview(review._id)
      setNotice({ type: 'success', message: 'Đã xóa đánh giá chưa được phê duyệt.' })
      setSelectedIds((current) => current.filter((id) => id !== review._id))
      await loadReviews()
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Không thể xóa đánh giá' })
    } finally {
      setActionLoading(false)
    }
  }

  const openReply = (review: AdminReview) => {
    setReplyingReview(review)
    setReply(review.adminReply ?? '')
    setReplyError('')
  }

  const validateReply = (value: string) => {
    const length = value.trim().length
    if (length === 0) return 'Vui lòng nhập nội dung phản hồi.'
    if (length < MIN_ADMIN_REPLY_LENGTH) return `Phản hồi cần ít nhất ${MIN_ADMIN_REPLY_LENGTH} ký tự.`
    if (length > MAX_ADMIN_REPLY_LENGTH) return `Phản hồi không được vượt quá ${MAX_ADMIN_REPLY_LENGTH} ký tự.`
    return ''
  }

  const handleReply = async (event: FormEvent) => {
    event.preventDefault()
    if (!replyingReview) return
    const validationError = validateReply(reply)
    if (validationError) {
      setReplyError(validationError)
      return
    }
    setActionLoading(true)
    try {
      await replyToReview(replyingReview._id, reply.trim())
      setReplyingReview(null)
      setReplyError('')
      setNotice({ type: 'success', message: 'Đã gửi phản hồi của cửa hàng.' })
      await loadReviews()
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Không thể gửi phản hồi' })
    } finally {
      setActionLoading(false)
    }
  }

  const summary = data?.summary ?? { total: 0, high: 0, low: 0, pending: 0 }

  return (
    <section className="admin-reviews-page">
      <header className="admin-page-heading admin-review-heading">
        <div>
          <p>Chăm sóc khách hàng</p>
          <h1>Quản lý đánh giá</h1>
          <span>Theo dõi, kiểm duyệt và xử lý đánh giá của khách hàng.</span>
        </div>
        <button className="admin-secondary-button" type="button" onClick={() => setShowRules(true)}>
          Quy tắc kiểm duyệt
        </button>
      </header>

      <div className="admin-review-stats" aria-label="Thống kê đánh giá">
        <div className="is-total">
          <span>Tổng đánh giá</span><strong>{summary.total}</strong>
        </div>
        <div className="is-high">
          <span>Đánh giá cao</span><strong>{summary.high}</strong>
        </div>
        <div className="is-low">
          <span>Đánh giá thấp</span><strong>{summary.low}</strong>
        </div>
      </div>

      {notice ? <div className={`admin-notice is-${notice.type}`}>{notice.message}</div> : null}

      <div className="admin-review-toolbar">
        <label className="admin-review-search">
          <span className="admin-search-icon" aria-hidden="true">⌕</span>
          <input
            value={filters.keyword}
            placeholder="Tìm theo sản phẩm, người dùng, nội dung..."
            onChange={(event) => updateFilter('keyword', event.target.value)}
          />
        </label>
        <div className="admin-review-filters">
          <select aria-label="Số sao" value={filters.rating} onChange={(event) => updateFilter('rating', event.target.value)}>
            <option value="">Số sao</option>{[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} sao</option>)}
          </select>
          <select aria-label="Trạng thái" value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
            <option value="">Trạng thái</option><option value="pending">Chờ duyệt</option><option value="visible">Đã hiển thị</option><option value="hidden">Đã ẩn</option>
          </select>
          <select aria-label="Sản phẩm" value={filters.productId} onChange={(event) => updateFilter('productId', event.target.value)}>
            <option value="">Sản phẩm</option>{data?.products.map((product) => <option key={product._id} value={product._id}>{product.name}</option>)}
          </select>
          <select aria-label="Thời gian" value={filters.period} onChange={(event) => updateFilter('period', event.target.value)}>
            <option value="">Thời gian</option><option value="today">Hôm nay</option><option value="week">7 ngày qua</option><option value="month">30 ngày qua</option>
          </select>
          <select aria-label="Có ảnh" value={filters.hasImages} onChange={(event) => updateFilter('hasImages', event.target.value)}>
            <option value="">Có ảnh</option><option value="true">Có ảnh</option><option value="false">Không có ảnh</option>
          </select>
        </div>
      </div>

      {canModerate ? <div className="admin-review-bulk-bar">
        <strong>Đã chọn {selectedIds.length} đánh giá</strong>
        <span>Chọn các đánh giá đang chờ duyệt</span>
        <div>
          <button className="admin-link-button" type="button" disabled={actionLoading || selectedIds.length === 0} onClick={() => void handleBulkApprove()}>Duyệt đánh giá</button>
        </div>
      </div> : null}

      <div className="admin-table-shell" ref={tableShellRef}>
        {loading ? <div className="admin-table-loading">Đang tải đánh giá...</div> : !data?.items.length ? (
          <div className="admin-review-empty"><strong>Không tìm thấy đánh giá</strong><span>Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.</span></div>
        ) : (
          <table className="admin-table admin-reviews-table">
            <thead><tr><th className="admin-review-check-cell">{canModerate && data.items.some((review) => review.status === 'pending') ? <input type="checkbox" aria-label="Chọn tất cả đánh giá chờ duyệt trên trang" checked={data.items.filter((review) => review.status === 'pending').every((review) => selectedIds.includes(review._id))} onChange={(event) => setSelectedIds(event.target.checked ? data.items.filter((review) => review.status === 'pending').map((review) => review._id) : [])} /> : null}</th><th>Sản phẩm</th><th>Người dùng</th><th>Đơn hàng</th><th>Số sao</th><th>Đánh giá</th><th>Trạng thái</th><th>Ngày tạo</th><th>Hành động</th></tr></thead>
            <tbody>{data.items.map((review) => {
              const status = statusMeta[review.status]
              const needsAttention = review.status === 'pending'
              const variantLabel = formatOrderItemVariant(review.order?.item)
              return (
                <tr key={review._id} className={needsAttention ? 'needs-attention' : 'is-handled'}>
                  <td className="admin-review-check-cell">{canModerate && review.status === 'pending' ? <input type="checkbox" aria-label={`Chọn đánh giá của ${review.user?.name || 'khách hàng'}`} checked={selectedIds.includes(review._id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...new Set([...current, review._id])] : current.filter((id) => id !== review._id))} /> : null}</td>
                  <td><div className="admin-review-product"><img src={review.product?.image || '/placeholder-product.svg'} alt="" /><div><strong>{review.product?.name ?? 'Sản phẩm đã xóa'}</strong>{variantLabel ? <small>Phân loại: {variantLabel}</small> : null}</div></div></td>
                  <td><div className="admin-review-user">{review.user?.avatarImage ? <img src={review.user.avatarImage} alt="" /> : <span aria-hidden="true" />}<div><strong>{review.user?.name || 'Khách hàng'}</strong><small>{review.user?.email}</small></div></div></td>
                  <td><strong className="admin-order-code">{review.order?.orderCode || review.order?._id.slice(-8).toUpperCase() || '—'}</strong></td>
                  <td><span className="admin-review-stars" aria-label={`${review.rating} sao`}>{'★'.repeat(review.rating)}<i>{'★'.repeat(5 - review.rating)}</i></span></td>
                  <td className="admin-review-comment"><p>{review.comment}</p>{review.images.length ? <div className="admin-review-images">{review.images.slice(0, 5).map((image) => <a key={image._id ?? image.url} href={image.url} target="_blank" rel="noreferrer"><img src={image.thumbnailUrl || image.url} alt="Ảnh đánh giá" /></a>)}</div> : null}{review.moderationReasons.length ? <div className="admin-review-flags">{review.moderationReasons.map((reason) => <span key={reason}>{reason}</span>)}</div> : null}{review.adminReply ? <div className="admin-review-reply"><strong>Phản hồi:</strong> {review.adminReply}</div> : null}</td>
                  <td><span className={`admin-status-pill ${status.className}`}>{status.label}</span></td>
                  <td className="admin-review-date">{formatDate(review.createdAt)}</td>
                  <td><div className="admin-review-actions">
                    {canReply && review.status !== 'hidden' ? <button className="admin-link-button" disabled={actionLoading} type="button" onClick={() => openReply(review)}>{review.adminReply ? 'Sửa phản hồi' : 'Phản hồi'}</button> : null}
                    {canModerate && review.status === 'pending' ? <button className="admin-link-button is-danger" disabled={actionLoading} type="button" onClick={() => void handleDeleteReview(review)}>Xóa</button> : null}
                  </div></td>
                </tr>
              )
            })}</tbody>
          </table>
        )}
      </div>

      <div className="admin-review-sticky-scrollbar" ref={stickyScrollbarRef} hidden aria-hidden="true">
        <div ref={stickyScrollbarContentRef} />
      </div>

      {data && data.pagination.totalPages > 1 ? <footer className="admin-table-footer"><span>Trang {data.pagination.page}/{data.pagination.totalPages} · {data.pagination.totalItems} đánh giá</span><div><button className="admin-secondary-button" disabled={filters.page <= 1} onClick={() => updateFilter('page', filters.page - 1)}>Trước</button><button className="admin-secondary-button" disabled={filters.page >= data.pagination.totalPages} onClick={() => updateFilter('page', filters.page + 1)}>Sau</button></div></footer> : null}

      {showRules ? <RulesDialog rules={rules} onClose={() => setShowRules(false)} /> : null}
      {replyingReview ? <div className="admin-confirm-layer" role="dialog" aria-modal="true"><form className="admin-account-dialog admin-review-reply-dialog" onSubmit={handleReply}><span className="admin-dialog-eyebrow">Phản hồi đánh giá</span><h2>{replyingReview.product?.name}</h2><blockquote>“{replyingReview.comment}”</blockquote><label><span>Nội dung phản hồi</span><textarea autoFocus className={replyError ? 'is-invalid' : ''} value={reply} minLength={MIN_ADMIN_REPLY_LENGTH} maxLength={MAX_ADMIN_REPLY_LENGTH} placeholder="Cảm ơn bạn đã chia sẻ..." onBlur={() => setReplyError(validateReply(reply))} onChange={(event) => { setReply(event.target.value); if (replyError) setReplyError(validateReply(event.target.value)) }} />{replyError ? <small className="admin-field-error">{replyError}</small> : null}</label><div className="admin-dialog-actions"><button className="admin-secondary-button" type="button" onClick={() => { setReplyingReview(null); setReplyError('') }}>Hủy</button><button className="admin-primary-button" disabled={actionLoading || Boolean(validateReply(reply))} type="submit">{actionLoading ? 'Đang gửi...' : 'Gửi phản hồi'}</button></div></form></div> : null}
    </section>
  )
}

function RulesDialog({ rules, onClose }: { rules: ModerationRules | null; onClose: () => void }) {
  return <div className="admin-confirm-layer" role="dialog" aria-modal="true"><div className="admin-account-dialog admin-review-rules-dialog"><span className="admin-dialog-eyebrow">Kiểm duyệt tự động</span><h2>Quy tắc ngôn từ & nội dung</h2><p>Mọi mức sao đều được tự động duyệt bình thường. Chỉ nội dung có dấu hiệu vi phạm dưới đây mới được đưa vào hàng chờ.</p><div className="admin-rule-list"><div><b>01</b><span><strong>Từ ngữ xúc phạm</strong><small>{rules?.offensiveWords.join(', ') || 'Đang tải...'}</small></span></div><div><b>02</b><span><strong>Link quảng cáo</strong><small>Nhận diện URL, website và tên miền trong nội dung.</small></span></div><div><b>03</b><span><strong>Spam lặp lại</strong><small>Nhận diện từ hoặc ký tự lặp bất thường.</small></span></div></div><div className="admin-dialog-actions"><button className="admin-primary-button" type="button" onClick={onClose}>Đóng</button></div></div></div>
}
