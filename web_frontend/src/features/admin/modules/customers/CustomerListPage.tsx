import { useCallback, useEffect, useState } from 'react'
import {
  Button,
  DataTable,
  EmptyState,
  Field,
  FilterBar,
  Modal,
  PageHeader,
  Pagination,
  StatusBadge,
  type DataTableColumn,
} from '../../components/ui'
import type { AdminUser } from '../auth/adminSession'
import { CustomerDetailDrawer } from './components/CustomerDetailDrawer'
import { formatDate } from './customer.utils'
import {
  forceManagedUserPasswordReset,
  getManagedUser,
  getManagedUserSummary,
  listManagedUsers,
  updateManagedUserStatus,
} from './customer.service'
import { CustomerKpiSummary } from './components/CustomerKpiSummary'
import type { ManagedUser, ManagedUserSummary } from './customer.types'

type CustomerListPageProps = {
  currentUser: AdminUser
}

type StatusFilter = 'all' | 'active' | 'blocked'

type Notice = {
  type: 'success' | 'error'
  message: string
}

type PendingAction =
  | {
      type: 'status'
      user: ManagedUser
      nextActive: boolean
    }
  | {
      type: 'reset'
      user: ManagedUser
    }

const pageSize = 10

const emptySummary: ManagedUserSummary = {
  total: 0,
  active: 0,
  blocked: 0,
  completedProfiles: 0,
  activeLast30Days: 0,
  newLast7Days: 0,
}

const statusFilterLabels: Record<StatusFilter, string> = {
  all: 'Tất cả',
  active: 'Đang hoạt động',
  blocked: 'Đã khóa',
}

const getUserTitle = (user: ManagedUser) => user.name || user.email

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Không thể xử lý yêu cầu'

export function CustomerListPage({ currentUser }: CustomerListPageProps) {
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null)
  const [keywordInput, setKeywordInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [page, setPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [summary, setSummary] = useState<ManagedUserSummary>(emptySummary)
  const [isSummaryLoading, setIsSummaryLoading] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isDrawerLoading, setIsDrawerLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [notice, setNotice] = useState<Notice | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)

  const canEditUsers =
    currentUser.role === 'admin' || currentUser.permissions?.includes('customers.manage') === true

  const summaryMeta = keyword ? 'Theo từ khóa hiện tại' : 'Toàn bộ khách mua hàng'

  const loadCustomerSummary = useCallback(async () => {
    setIsSummaryLoading(true)

    try {
      setSummary(await getManagedUserSummary(keyword))
    } catch {
      setSummary(emptySummary)
    } finally {
      setIsSummaryLoading(false)
    }
  }, [keyword])

  const loadUsers = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage('')

    try {
      const result = await listManagedUsers({
        keyword,
        role: 'user',
        status: statusFilter,
        page,
        limit: pageSize,
      })

      setUsers(result.items)
      setTotalItems(result.totalItems)
      setTotalPages(Math.max(1, result.totalPages))
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }, [keyword, page, statusFilter])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setPage(1)
      setKeyword(keywordInput.trim())
    }, 320)

    return () => window.clearTimeout(handle)
  }, [keywordInput])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  useEffect(() => {
    void loadCustomerSummary()
  }, [loadCustomerSummary])

  const updateUserInState = (updatedUser: ManagedUser) => {
    setUsers((currentUsers) =>
      currentUsers.map((user) => (user._id === updatedUser._id ? updatedUser : user)),
    )
    setSelectedUser((currentUserDetail) =>
      currentUserDetail?._id === updatedUser._id ? updatedUser : currentUserDetail,
    )
  }

  const handleOpenUser = async (user: ManagedUser) => {
    setSelectedUser(user)
    setIsDrawerLoading(true)
    setNotice(null)

    try {
      const detail = await getManagedUser(user._id)
      setSelectedUser(detail)
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setIsDrawerLoading(false)
    }
  }

  const requestStatusChange = (user: ManagedUser, nextActive: boolean) => {
    if (user.isActive === nextActive) {
      return
    }

    setPendingAction({ type: 'status', user, nextActive })
  }

  const requestPasswordReset = (user: ManagedUser) => {
    setPendingAction({ type: 'reset', user })
  }

  const handleConfirmAction = async () => {
    if (!pendingAction) {
      return
    }

    setActionLoading(true)
    setNotice(null)

    try {
      if (pendingAction.type === 'status') {
        const updatedUser = await updateManagedUserStatus(
          pendingAction.user._id,
          pendingAction.nextActive,
        )
        updateUserInState(updatedUser)
        void loadCustomerSummary()
        setNotice({
          type: 'success',
          message: pendingAction.nextActive
            ? 'Đã mở khóa tài khoản'
            : 'Đã khóa tài khoản',
        })
      }

      if (pendingAction.type === 'reset') {
        const delivery = await forceManagedUserPasswordReset(pendingAction.user._id)
        setNotice({
          type: 'success',
          message: delivery.mode === 'mock'
            ? 'Email thử nghiệm đã được tạo. Vui lòng kiểm tra hộp thư thử nghiệm.'
            : 'Email hướng dẫn đổi mật khẩu đã được gửi tới khách hàng.',
        })
      }

      setPendingAction(null)
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
      setPendingAction(null)
    } finally {
      setActionLoading(false)
    }
  }

  const changeStatusFilter = (value: StatusFilter) => {
    setStatusFilter(value)
    setPage(1)
  }

  const confirmTitle = pendingAction
    ? pendingAction.type === 'status'
      ? pendingAction.nextActive
        ? 'Mở khóa tài khoản?'
        : 'Khóa tài khoản?'
      : 'Yêu cầu đổi mật khẩu?'
    : ''

  const confirmBody = pendingAction
    ? pendingAction.type === 'status'
      ? `${getUserTitle(pendingAction.user)} sẽ ${
          pendingAction.nextActive ? 'được phép đăng nhập lại' : 'không thể đăng nhập'
        }.`
      : `Hệ thống sẽ thu hồi phiên đăng nhập hiện tại của ${getUserTitle(pendingAction.user)}.`
    : ''

  const columns: Array<DataTableColumn<ManagedUser>> = [
    {
      key: 'customer',
      header: 'Khách hàng',
      render: (user) => (
        <div className="admin-user-cell">
          <span className="admin-user-avatar" aria-hidden="true">
            <span>{getUserTitle(user).trim().charAt(0).toUpperCase() || 'U'}</span>
            {user.avatarImage ? (
              <img
                src={user.avatarImage}
                alt=""
                onError={(event) => { event.currentTarget.style.display = 'none' }}
              />
            ) : null}
          </span>
          <div>
            <strong>{getUserTitle(user)}</strong>
            <small>{user.email}</small>
          </div>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Liên hệ',
      render: (user) => (
        <div className="admin-contact-cell">
          <span>{user.phone || 'Chưa có số điện thoại'}</span>
          <small>{user.email}</small>
        </div>
      ),
    },
    {
      key: 'profile',
      header: 'Hồ sơ',
      render: (user) => (
        <StatusBadge tone={user.profileCompleted ? 'info' : 'neutral'}>
          {user.profileCompleted ? 'Đủ thông tin' : 'Thiếu thông tin'}
        </StatusBadge>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (user) => (
        <StatusBadge tone={user.isActive ? 'success' : 'danger'}>
          {user.isActive ? 'Đang hoạt động' : 'Đã khóa'}
        </StatusBadge>
      ),
    },
    {
      key: 'points',
      header: 'Điểm tích lũy',
      render: (user) => (user.loyaltyPoint ?? 0).toLocaleString('vi-VN'),
    },
    {
      key: 'createdAt',
      header: 'Ngày tạo',
      render: (user) => formatDate(user.createdAt),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      render: (user) => {
        const canManageRow = canEditUsers && currentUser._id !== user._id

        return (
          <div className="admin-row-actions" onClick={(event) => event.stopPropagation()}>
            <Button variant="secondary" onClick={() => void handleOpenUser(user)}>
              Xem
            </Button>
            <Button
              variant={user.isActive ? 'danger' : 'secondary'}
              disabled={!canManageRow}
              onClick={() => requestStatusChange(user, !user.isActive)}
            >
              {user.isActive ? 'Khóa' : 'Mở'}
            </Button>
          </div>
        )
      },
    },
  ]

  return (
    <section className="admin-ui-page admin-customer-page" aria-busy={isLoading}>
      <PageHeader
        title="Khách hàng"
        description="Quản lý tài khoản khách mua hàng, thông tin liên hệ, trạng thái đăng nhập và điểm tích lũy."
        breadcrumbs={['Khách hàng', 'Danh sách']}
        actions={(
          <Button variant="secondary" onClick={() => void loadUsers()}>
            Làm mới
          </Button>
        )}
      />

      <CustomerKpiSummary summary={summary} isLoading={isSummaryLoading} meta={summaryMeta} />

      <FilterBar>
        <Field label="Tìm kiếm" grow>
          <input
            type="search"
            value={keywordInput}
            onChange={(event) => setKeywordInput(event.target.value)}
            placeholder="Tìm theo tên, email hoặc số điện thoại"
          />
        </Field>

        <Field label="Trạng thái">
          <select
            value={statusFilter}
            onChange={(event) => changeStatusFilter(event.target.value as StatusFilter)}
          >
            {Object.entries(statusFilterLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </FilterBar>

      {notice ? (
        <p className={`admin-notice is-${notice.type}`} role="status">
          {notice.message}
        </p>
      ) : null}

      {errorMessage ? (
        <EmptyState
          title="Không tải được danh sách"
          description={errorMessage}
          role="alert"
          action={(
            <Button variant="secondary" onClick={() => void loadUsers()}>
              Thử lại
            </Button>
          )}
        />
      ) : (
        <DataTable
          columns={columns}
          items={users}
          getRowKey={(user) => user._id}
          isLoading={isLoading}
          emptyText="Không tìm thấy khách hàng phù hợp."
          onRowClick={(user) => void handleOpenUser(user)}
        />
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        totalItems={totalItems}
        isDisabled={isLoading}
        onPageChange={setPage}
      />

      <CustomerDetailDrawer
        user={selectedUser}
        currentUser={currentUser}
        isLoading={isDrawerLoading}
        onClose={() => setSelectedUser(null)}
        onRequestStatusChange={requestStatusChange}
        onRequestPasswordReset={requestPasswordReset}
      />

      <Modal
        isOpen={Boolean(pendingAction)}
        title={confirmTitle}
        description={confirmBody}
        onClose={() => setPendingAction(null)}
        actions={(
          <>
            <Button
              variant="secondary"
              disabled={actionLoading}
              onClick={() => setPendingAction(null)}
            >
              Hủy
            </Button>
            <Button
              variant="primary"
              disabled={actionLoading}
              onClick={() => void handleConfirmAction()}
            >
              {actionLoading ? 'Đang xử lý...' : 'Xác nhận'}
            </Button>
          </>
        )}
      />
    </section>
  )
}
