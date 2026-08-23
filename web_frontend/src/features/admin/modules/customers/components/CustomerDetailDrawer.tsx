import { useCallback, useEffect, useState } from 'react'
import { Button, Drawer, StatusBadge, Tabs, type TabItem } from '../../../components/ui'
import type { AdminUser } from '../../auth/adminSession'
import {
  createManagedCustomerNote,
  deleteManagedCustomerNote,
  getManagedCustomerInsights,
  listManagedCustomerNotes,
  updateManagedCustomerNote,
} from '../customer.service'
import type {
  ManagedCustomerInsights,
  ManagedCustomerNote,
  ManagedCustomerNoteAuthor,
  ManagedUser,
} from '../customer.types'
import { formatDate } from '../customer.utils'
import '../customer.css'

type CustomerDetailDrawerProps = {
  user: ManagedUser | null
  currentUser: AdminUser
  isLoading: boolean
  onClose: () => void
  onRequestStatusChange: (user: ManagedUser, nextActive: boolean) => void
  onRequestPasswordReset: (user: ManagedUser) => void
}

type CustomerDetailTab = 'overview' | 'addresses' | 'orders' | 'activity' | 'notes' | 'admin'

const genderLabels = {
  male: 'Nam',
  female: 'Nữ',
} as const

const detailTabs: Array<TabItem<CustomerDetailTab>> = [
  { value: 'overview', label: 'Tổng quan' },
  { value: 'addresses', label: 'Địa chỉ' },
  { value: 'orders', label: 'Đơn hàng' },
  { value: 'activity', label: 'Tương tác' },
  { value: 'notes', label: 'Ghi chú' },
  { value: 'admin', label: 'Quản trị' },
]

const getDisplayName = (user: ManagedUser) => user.name || user.email
const formatCurrency = (value: number) =>
  `${Math.round(value).toLocaleString('vi-VN')} đ`

const activityTypeLabels: Record<ManagedCustomerInsights['activity']['items'][number]['type'], string> = {
  account: 'Tài khoản',
  order: 'Đơn hàng',
  support: 'Hỗ trợ',
  review: 'Đánh giá',
  interaction: 'Tương tác',
  virtual_try_on: 'Phối đồ ảo',
  audit: 'Quản trị',
}

const orderStatusLabels: Record<string, string> = {
  confirmed: 'Chờ xử lý',
  packed: 'Đã đóng gói',
  shipping: 'Đang giao',
  delivered: 'Đã giao',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
  return_requested: 'Chờ duyệt trả',
  return_approved: 'Chờ nhận hàng trả',
  returned: 'Đã nhận trả',
}

const paymentMethodLabels: Record<string, string> = {
  COD: 'Thanh toán khi nhận hàng',
  VNPAY: 'VNPay',
  MOMO: 'MoMo',
  CARD: 'Thẻ ngân hàng',
  BANK: 'Chuyển khoản',
}

const getNoteAuthorLabel = (author: ManagedCustomerNoteAuthor | string) => {
  if (typeof author === 'string') return 'Nhân viên'
  return author.name || author.email || 'Nhân viên'
}

const getNoteAuthorAvatar = (author: ManagedCustomerNoteAuthor | string) =>
  typeof author === 'string' ? null : author.avatarImage

export function CustomerDetailDrawer({
  user,
  currentUser,
  isLoading,
  onClose,
  onRequestStatusChange,
  onRequestPasswordReset,
}: CustomerDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<CustomerDetailTab>('overview')
  const [insights, setInsights] = useState<ManagedCustomerInsights | null>(null)
  const [activityPage, setActivityPage] = useState(1)
  const [isInsightsLoading, setIsInsightsLoading] = useState(false)
  const [insightsError, setInsightsError] = useState('')
  const [notes, setNotes] = useState<ManagedCustomerNote[]>([])
  const [isNotesLoading, setIsNotesLoading] = useState(false)
  const [notesError, setNotesError] = useState('')
  const [noteInput, setNoteInput] = useState('')
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [isNoteSaving, setIsNoteSaving] = useState(false)
  const canManageCustomers =
    currentUser.role === 'admin' || currentUser.permissions?.includes('customers.manage') === true
  const canManageUser = Boolean(user && canManageCustomers && currentUser._id !== user._id)

  const loadInsights = useCallback(async () => {
    if (!user?._id) return

    setIsInsightsLoading(true)
    setInsightsError('')
    try {
      setInsights(await getManagedCustomerInsights(user._id, activityPage))
    } catch (error) {
      setInsightsError(error instanceof Error ? error.message : 'Không thể tải dữ liệu khách hàng')
    } finally {
      setIsInsightsLoading(false)
    }
  }, [activityPage, user])

  const loadNotes = useCallback(async () => {
    if (!user?._id) return

    setIsNotesLoading(true)
    setNotesError('')
    try {
      setNotes(await listManagedCustomerNotes(user._id))
    } catch (error) {
      setNotesError(error instanceof Error ? error.message : 'Không thể tải ghi chú')
    } finally {
      setIsNotesLoading(false)
    }
  }, [user])

  useEffect(() => {
    setActiveTab('overview')
    setActivityPage(1)
    setInsights(null)
    setInsightsError('')
    setNotes([])
    setNotesError('')
    setNoteInput('')
    setEditingNoteId(null)
  }, [user?._id])

  useEffect(() => {
    if (activeTab === 'orders' || activeTab === 'activity') {
      void loadInsights()
    }
  }, [activeTab, loadInsights])

  useEffect(() => {
    if (activeTab === 'notes') {
      void loadNotes()
    }
  }, [activeTab, loadNotes])

  const handleNoteSubmit = async () => {
    const content = noteInput.trim()
    if (!user?._id || !content || !canManageUser) return

    setIsNoteSaving(true)
    setNotesError('')
    try {
      if (editingNoteId) {
        await updateManagedCustomerNote(user._id, editingNoteId, content)
      } else {
        await createManagedCustomerNote(user._id, content)
      }
      setNoteInput('')
      setEditingNoteId(null)
      await loadNotes()
      if (insights) void loadInsights()
    } catch (error) {
      setNotesError(error instanceof Error ? error.message : 'Không thể lưu ghi chú')
    } finally {
      setIsNoteSaving(false)
    }
  }

  const handleEditNote = (note: ManagedCustomerNote) => {
    setEditingNoteId(note._id)
    setNoteInput(note.content)
  }

  const handleDeleteNote = async (note: ManagedCustomerNote) => {
    if (!user?._id || !canManageUser) return
    if (!window.confirm('Xóa ghi chú nội bộ này?')) return

    setIsNoteSaving(true)
    setNotesError('')
    try {
      await deleteManagedCustomerNote(user._id, note._id)
      if (editingNoteId === note._id) {
        setEditingNoteId(null)
        setNoteInput('')
      }
      await loadNotes()
      if (insights) void loadInsights()
    } catch (error) {
      setNotesError(error instanceof Error ? error.message : 'Không thể xóa ghi chú')
    } finally {
      setIsNoteSaving(false)
    }
  }

  if (!user) {
    return null
  }

  const addresses = user.address ?? []
  const primaryAddress = addresses.find((address) => address.isDefault) ?? addresses[0]
  const profileLabel = user.profileCompleted ? 'Đủ thông tin' : 'Thiếu thông tin'

  return (
    <Drawer
      isOpen={Boolean(user)}
      title={getDisplayName(user)}
      description={user.email}
      onClose={onClose}
    >
      {isLoading ? <div className="admin-drawer-loading">Đang tải chi tiết...</div> : null}

      <section className="admin-customer-summary" aria-label="Tóm tắt khách hàng">
        <span className="admin-customer-avatar" aria-hidden="true">
          <span>{getDisplayName(user).trim().charAt(0).toUpperCase() || 'U'}</span>
          {user.avatarImage ? (
            <img
              src={user.avatarImage}
              alt=""
              onError={(event) => { event.currentTarget.style.display = 'none' }}
            />
          ) : null}
        </span>
        <div>
          <strong>{getDisplayName(user)}</strong>
          <span>{user.phone || 'Chưa có số điện thoại'}</span>
        </div>
        <StatusBadge tone={user.isActive ? 'success' : 'danger'}>
          {user.isActive ? 'Đang hoạt động' : 'Đã khóa'}
        </StatusBadge>
      </section>

      <Tabs
        items={detailTabs.map((tab) =>
          tab.value === 'addresses' ? { ...tab, badge: addresses.length } : tab,
        )}
        value={activeTab}
        onChange={setActiveTab}
        ariaLabel="Thông tin khách hàng"
      />

      {activeTab === 'overview' ? (
        <section className="admin-drawer-section admin-drawer-tab-panel" aria-label="Tổng quan khách hàng">
          <div className="admin-detail-grid">
            <div>
              <span>Email</span>
              <strong>{user.email}</strong>
            </div>
            <div>
              <span>Hồ sơ</span>
              <strong>{profileLabel}</strong>
            </div>
            <div>
              <span>Giới tính</span>
              <strong>{user.gender ? genderLabels[user.gender] : 'Chưa có'}</strong>
            </div>
            <div>
              <span>Ngày sinh</span>
              <strong>{formatDate(user.dateOfBirth)}</strong>
            </div>
            <div>
              <span>Điểm tích lũy</span>
              <strong>{(user.loyaltyPoint ?? 0).toLocaleString('vi-VN')}</strong>
            </div>
            <div>
              <span>Địa chỉ mặc định</span>
              <strong>{primaryAddress ? primaryAddress.province || 'Đã lưu' : 'Chưa có'}</strong>
            </div>
            <div>
              <span>Ngày tạo</span>
              <strong>{formatDate(user.createdAt)}</strong>
            </div>
            <div>
              <span>Cập nhật gần nhất</span>
              <strong>{formatDate(user.updatedAt)}</strong>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === 'addresses' ? (
        <section className="admin-drawer-section admin-drawer-tab-panel" aria-label="Địa chỉ khách hàng">
          {addresses.length > 0 ? (
            <div className="admin-address-list">
              {addresses.map((address, index) => (
                <div className="admin-address-block" key={address._id ?? `${address.streetName}-${index}`}>
                  <div className="admin-address-block__header">
                    <strong>{address.customerName || getDisplayName(user)}</strong>
                    {address.isDefault ? <StatusBadge tone="neutral">Mặc định</StatusBadge> : null}
                  </div>
                  <span>{address.phoneNumber || user.phone || 'Chưa có số điện thoại'}</span>
                  <p>
                    {[address.streetName, address.ward, address.district, address.province]
                      .filter(Boolean)
                      .join(', ') || 'Chưa có địa chỉ chi tiết'}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="admin-muted-text">Khách hàng chưa lưu địa chỉ.</p>
          )}
        </section>
      ) : null}

      {activeTab === 'orders' ? (
        <section className="admin-drawer-section admin-drawer-tab-panel" aria-label="Đơn hàng khách hàng">
          {isInsightsLoading && !insights ? (
            <div className="admin-drawer-loading">Đang tải đơn hàng...</div>
          ) : null}
          {insightsError ? <p className="admin-customer-error" role="alert">{insightsError}</p> : null}
          {insights ? (
            <>
              <div className="admin-customer-order-summary">
                <div>
                  <span>Tổng đơn</span>
                  <strong>{insights.orders.totalOrders.toLocaleString('vi-VN')}</strong>
                </div>
                <div>
                  <span>Đơn thành công</span>
                  <strong>{insights.orders.successfulOrders.toLocaleString('vi-VN')}</strong>
                </div>
                <div>
                  <span>Tổng chi tiêu</span>
                  <strong>{formatCurrency(insights.orders.totalSpent)}</strong>
                </div>
              </div>
              {insights.orders.recentOrders.length > 0 ? (
                <div className="admin-customer-order-list">
                  {insights.orders.recentOrders.map((order) => (
                    <article key={order._id} className="admin-customer-order">
                      <div>
                        <strong>{order.orderCode}</strong>
                        <span>
                          {formatDate(order.createdAt)} · {paymentMethodLabels[order.paymentMethod] ?? 'Thanh toán khác'}
                        </span>
                      </div>
                      <div className="admin-customer-order__status">
                        <StatusBadge
                          tone={
                            order.status === 'completed' || order.status === 'delivered'
                              ? 'success'
                              : order.status === 'cancelled' || order.status === 'returned'
                                ? 'danger'
                                : 'neutral'
                          }
                        >
                          {orderStatusLabels[order.status] ?? 'Đang cập nhật'}
                        </StatusBadge>
                        <strong>{formatCurrency(order.totalAmount)}</strong>
                      </div>
                      <a href={`/admin/orders?keyword=${encodeURIComponent(order.orderCode)}`}>
                        Tra cứu đơn
                      </a>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="admin-muted-text">Khách hàng chưa có đơn hàng.</p>
              )}
            </>
          ) : null}
        </section>
      ) : null}

      {activeTab === 'activity' ? (
        <section className="admin-drawer-section admin-drawer-tab-panel" aria-label="Tương tác khách hàng">
          {isInsightsLoading && !insights ? (
            <div className="admin-drawer-loading">Đang tải tương tác...</div>
          ) : null}
          {insightsError ? <p className="admin-customer-error" role="alert">{insightsError}</p> : null}
          {insights?.activity.items.length ? (
            <div className="admin-customer-timeline">
              {insights.activity.items.map((item) => (
                <article key={item.id} className="admin-customer-timeline__item">
                  <span className={`is-${item.type}`}>{activityTypeLabels[item.type]}</span>
                  <div>
                    <strong>{item.title}</strong>
                    {item.actor ? (
                      <p className="admin-customer-activity-actor">
                        <span className="admin-customer-activity-actor__avatar" aria-hidden="true">
                          <span>
                            {(item.actor.name || item.actor.email || 'N').trim().charAt(0).toUpperCase()}
                          </span>
                          {item.actor.avatarImage ? (
                            <img
                              src={item.actor.avatarImage}
                              alt=""
                              onError={(event) => { event.currentTarget.style.display = 'none' }}
                            />
                          ) : null}
                        </span>
                        <span>{item.description}</span>
                      </p>
                    ) : <p>{item.description}</p>}
                    <time dateTime={item.occurredAt}>{formatDate(item.occurredAt)}</time>
                  </div>
                </article>
              ))}
            </div>
          ) : insights ? (
            <p className="admin-muted-text">Chưa có tương tác được ghi nhận.</p>
          ) : null}
          {insights && insights.activity.pagination.totalPages > 1 ? (
            <div className="admin-customer-pagination">
              <Button
                variant="secondary"
                disabled={activityPage <= 1 || isInsightsLoading}
                onClick={() => setActivityPage((page) => Math.max(1, page - 1))}
              >
                Trước
              </Button>
              <span>
                Trang {insights.activity.pagination.page}/{insights.activity.pagination.totalPages}
              </span>
              <Button
                variant="secondary"
                disabled={
                  activityPage >= insights.activity.pagination.totalPages || isInsightsLoading
                }
                onClick={() => setActivityPage((page) => page + 1)}
              >
                Sau
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}

      {activeTab === 'notes' ? (
        <section className="admin-drawer-section admin-drawer-tab-panel" aria-label="Ghi chú nội bộ">
          {canManageUser ? (
            <div className="admin-customer-note-form">
              <label htmlFor="customer-note">
                {editingNoteId ? 'Sửa ghi chú' : 'Thêm ghi chú'}
              </label>
              <textarea
                id="customer-note"
                value={noteInput}
                maxLength={2000}
                rows={4}
                placeholder="Thông tin nội bộ chỉ dành cho nhân viên..."
                onChange={(event) => setNoteInput(event.target.value)}
              />
              <div>
                {editingNoteId ? (
                  <Button
                    variant="secondary"
                    disabled={isNoteSaving}
                    onClick={() => {
                      setEditingNoteId(null)
                      setNoteInput('')
                    }}
                  >
                    Hủy sửa
                  </Button>
                ) : null}
                <Button
                  variant="primary"
                  disabled={!noteInput.trim() || isNoteSaving}
                  onClick={() => void handleNoteSubmit()}
                >
                  {isNoteSaving ? 'Đang lưu...' : editingNoteId ? 'Lưu thay đổi' : 'Thêm ghi chú'}
                </Button>
              </div>
            </div>
          ) : (
            <p className="admin-permission-note">
              Bạn không có quyền thêm, sửa hoặc xóa ghi chú nội bộ.
            </p>
          )}
          {notesError ? <p className="admin-customer-error" role="alert">{notesError}</p> : null}
          {isNotesLoading && notes.length === 0 ? (
            <div className="admin-drawer-loading">Đang tải ghi chú...</div>
          ) : null}
          {notes.length > 0 ? (
            <div className="admin-customer-note-list">
              {notes.map((note) => (
                <article key={note._id} className="admin-customer-note">
                  <p>{note.content}</p>
                  <footer>
                    <span className="admin-customer-note__author">
                      <span className="admin-customer-note__author-avatar" aria-hidden="true">
                        <span>{getNoteAuthorLabel(note.createdBy).trim().charAt(0).toUpperCase()}</span>
                        {getNoteAuthorAvatar(note.createdBy) ? (
                          <img
                            src={getNoteAuthorAvatar(note.createdBy) ?? undefined}
                            alt=""
                            onError={(event) => { event.currentTarget.style.display = 'none' }}
                          />
                        ) : null}
                      </span>
                      <span>
                        {getNoteAuthorLabel(note.createdBy)} · {formatDate(note.createdAt)}
                        {note.updatedAt !== note.createdAt ? ' · đã sửa' : ''}
                      </span>
                    </span>
                    {canManageUser ? (
                      <div>
                        <button type="button" onClick={() => handleEditNote(note)}>Sửa</button>
                        <button
                          type="button"
                          disabled={isNoteSaving}
                          onClick={() => void handleDeleteNote(note)}
                        >
                          Xóa
                        </button>
                      </div>
                    ) : null}
                  </footer>
                </article>
              ))}
            </div>
          ) : !isNotesLoading ? (
            <p className="admin-muted-text">Chưa có ghi chú nội bộ.</p>
          ) : null}
        </section>
      ) : null}

      {activeTab === 'admin' ? (
        <section className="admin-drawer-section admin-drawer-tab-panel" aria-label="Quản trị tài khoản">
          <div className="admin-detail-row">
            <span>Trạng thái đăng nhập</span>
            <StatusBadge tone={user.isActive ? 'success' : 'danger'}>
              {user.isActive ? 'Đang hoạt động' : 'Đã khóa'}
            </StatusBadge>
          </div>

          <div className="admin-drawer-actions">
            <Button
              variant={user.isActive ? 'danger' : 'primary'}
              disabled={!canManageUser}
              onClick={() => onRequestStatusChange(user, !user.isActive)}
            >
              {user.isActive ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
            </Button>
            <Button
              variant="secondary"
              disabled={!canManageUser}
              onClick={() => onRequestPasswordReset(user)}
            >
              Yêu cầu đổi mật khẩu
            </Button>
          </div>

          {!canManageUser ? (
            <p className="admin-permission-note">
              Bạn không có quyền đổi trạng thái hoặc yêu cầu đổi mật khẩu cho tài khoản này.
            </p>
          ) : null}
        </section>
      ) : null}
    </Drawer>
  )
}

