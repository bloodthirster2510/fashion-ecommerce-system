import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AdminUser } from '../auth/adminSession'
import { UserDetailDrawer, formatDate } from './UserDetailDrawer'
import {
  forceManagedUserPasswordReset,
  getManagedUser,
  listManagedUsers,
  updateManagedUserStatus,
  type ManagedUser,
} from './userAdminApi'

type UserListPageProps = {
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

const statusFilterLabels: Record<StatusFilter, string> = {
  all: 'Tất cả trạng thái',
  active: 'Hoạt động',
  blocked: 'Bị khóa',
}

const getUserTitle = (user: ManagedUser) => user.name || user.email

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Không thể xử lý yêu cầu'

export function UserListPage({ currentUser }: UserListPageProps) {
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null)
  const [keywordInput, setKeywordInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [page, setPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [isDrawerLoading, setIsDrawerLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [notice, setNotice] = useState<Notice | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)

  const canEditUsers = currentUser.role === 'admin'

  const activeCount = useMemo(
    () => users.filter((user) => user.isActive).length,
    [users],
  )

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
        setNotice({
          type: 'success',
          message: pendingAction.nextActive
            ? 'Đã mở khóa tài khoản'
            : 'Đã khóa tài khoản',
        })
      }

      if (pendingAction.type === 'reset') {
        await forceManagedUserPasswordReset(pendingAction.user._id)
        setNotice({ type: 'success', message: 'Đã yêu cầu đổi mật khẩu' })
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

  return (
    <section className="admin-users-page" aria-busy={isLoading}>
      <header className="admin-page-heading">
        <div>
          <p>Quản lý tài khoản</p>
          <h1>Khách hàng</h1>
        </div>

        <button className="admin-secondary-button" type="button" onClick={() => void loadUsers()}>
          Làm mới
        </button>
      </header>

      <div className="admin-user-stats" aria-label="Thống kê khách hàng">
        <div>
          <span>Tổng tài khoản</span>
          <strong>{totalItems}</strong>
        </div>
        <div>
          <span>Đang hiển thị</span>
          <strong>{users.length}</strong>
        </div>
        <div>
          <span>Hoạt động</span>
          <strong>{activeCount}</strong>
        </div>
      </div>

      <div className="admin-table-toolbar">
        <label className="admin-user-search">
          <span>Tìm kiếm</span>
          <input
            type="search"
            value={keywordInput}
            onChange={(event) => setKeywordInput(event.target.value)}
            placeholder="Tên, email hoặc số điện thoại"
          />
        </label>

        <label>
          <span>Trạng thái</span>
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
        </label>
      </div>

      {notice ? (
        <p className={`admin-notice is-${notice.type}`} role="status">
          {notice.message}
        </p>
      ) : null}

      {errorMessage ? (
        <div className="admin-empty-state" role="alert">
          <strong>Không tải được danh sách</strong>
          <span>{errorMessage}</span>
          <button className="admin-secondary-button" type="button" onClick={() => void loadUsers()}>
            Thử lại
          </button>
        </div>
      ) : (
        <div className="admin-table-shell">
          <table className="admin-users-table">
            <thead>
              <tr>
                <th>Khách hàng</th>
                <th>Liên hệ</th>
                <th>Trạng thái</th>
                <th>Điểm</th>
                <th>Ngày tạo</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6}>
                    <div className="admin-table-loading">Đang tải danh sách...</div>
                  </td>
                </tr>
              ) : null}

              {!isLoading && users.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="admin-table-loading">Không có tài khoản phù hợp.</div>
                  </td>
                </tr>
              ) : null}

              {!isLoading
                ? users.map((user) => {
                    const canManageRow = canEditUsers && currentUser._id !== user._id

                    return (
                      <tr key={user._id}>
                        <td>
                          <div className="admin-user-cell">
                            <span className="admin-user-avatar" aria-hidden="true">
                              {getUserTitle(user).trim().charAt(0).toUpperCase() || 'U'}
                            </span>
                            <div>
                              <strong>{getUserTitle(user)}</strong>
                              <small>{user.profileCompleted ? 'Đã hoàn thiện hồ sơ' : 'Chưa hoàn thiện hồ sơ'}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="admin-contact-cell">
                            <span>{user.email}</span>
                            <small>{user.phone || 'Chưa có số điện thoại'}</small>
                          </div>
                        </td>
                        <td>
                          <span className={`admin-status-pill ${user.isActive ? 'is-active' : 'is-blocked'}`}>
                            {user.isActive ? 'Hoạt động' : 'Bị khóa'}
                          </span>
                        </td>
                        <td>{user.loyaltyPoint ?? 0}</td>
                        <td>{formatDate(user.createdAt)}</td>
                        <td>
                          <div className="admin-row-actions">
                            <button
                              className="admin-link-button"
                              type="button"
                              onClick={() => void handleOpenUser(user)}
                            >
                              Xem
                            </button>
                            <button
                              className={user.isActive ? 'admin-danger-link' : 'admin-link-button'}
                              type="button"
                              disabled={!canManageRow}
                              onClick={() => requestStatusChange(user, !user.isActive)}
                            >
                              {user.isActive ? 'Khóa' : 'Mở'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                : null}
            </tbody>
          </table>
        </div>
      )}

      <footer className="admin-table-footer">
        <span>
          Trang {page} / {totalPages}
        </span>
        <div>
          <button
            className="admin-secondary-button"
            type="button"
            disabled={page <= 1 || isLoading}
            onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
          >
            Trước
          </button>
          <button
            className="admin-secondary-button"
            type="button"
            disabled={page >= totalPages || isLoading}
            onClick={() => setPage((currentPage) => Math.min(totalPages, currentPage + 1))}
          >
            Sau
          </button>
        </div>
      </footer>

      <UserDetailDrawer
        user={selectedUser}
        currentUser={currentUser}
        isLoading={isDrawerLoading}
        onClose={() => setSelectedUser(null)}
        onRequestStatusChange={requestStatusChange}
        onRequestPasswordReset={requestPasswordReset}
      />

      {pendingAction ? (
        <div className="admin-confirm-layer" role="dialog" aria-modal="true" aria-labelledby="admin-confirm-title">
          <div className="admin-confirm-box">
            <h2 id="admin-confirm-title">{confirmTitle}</h2>
            <p>{confirmBody}</p>
            <div>
              <button
                className="admin-secondary-button"
                type="button"
                disabled={actionLoading}
                onClick={() => setPendingAction(null)}
              >
                Hủy
              </button>
              <button
                className="admin-primary-button"
                type="button"
                disabled={actionLoading}
                onClick={() => void handleConfirmAction()}
              >
                {actionLoading ? 'Đang xử lý...' : 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
