import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { formatDate } from '../customers/customer.utils'
import {
  createStaffAccount,
  listInternalAccounts,
  resetStaffTemporaryPassword,
  updateStaffPermissions,
  updateStaffStatus,
} from './manager.service'
import type {
  CreateStaffPayload,
  InternalAccount,
  InternalAccountRole,
  StaffPermission,
} from './manager.types'
import { PermissionEditor } from './components/PermissionEditor'
import './manager.css'

type RoleFilter = InternalAccountRole | 'all'
type StatusFilter = 'all' | 'active' | 'blocked'

type Notice = {
  type: 'success' | 'error'
  message: string
}

type DialogState =
  | { type: 'create' }
  | { type: 'permissions'; account: InternalAccount }
  | { type: 'reset'; account: InternalAccount }
  | null

const pageSize = 10

const roleFilterLabels: Record<RoleFilter, string> = {
  all: 'Tất cả nội bộ',
  admin: 'Quản trị viên',
  staff: 'Nhân viên',
}

const statusFilterLabels: Record<StatusFilter, string> = {
  all: 'Tất cả trạng thái',
  active: 'Hoạt động',
  blocked: 'Bị khóa',
}

const impliedPermissions: Partial<Record<StaffPermission, StaffPermission>> = {
  'products.write': 'products.read',
  'catalog.write': 'catalog.read',
  'orders.update': 'orders.read',
  'payments.adjust': 'orders.read',
  'inventory.write': 'inventory.read',
  'promotions.write': 'promotions.read',
  'loyalty.write': 'loyalty.read',
  'customers.manage': 'customers.read',
  'support.manage': 'support.reply',
  'virtual_try_on.manage': 'virtual_try_on.read',
  'virtual_try_on.settings': 'virtual_try_on.read',
}

const defaultStaffPermissions: StaffPermission[] = [
  'orders.read',
  'orders.update',
  'customers.read',
  'support.reply',
]

const emptyCreateForm: CreateStaffPayload = {
  name: '',
  email: '',
  phone: '',
  password: '',
  permissions: defaultStaffPermissions,
}

const getAccountTitle = (account: InternalAccount) => account.name || account.email

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Không thể xử lý yêu cầu'

const expandImpliedPermissions = (permissions: StaffPermission[]) => {
  const nextPermissions = new Set(permissions)

  permissions.forEach((permission) => {
    const impliedPermission = impliedPermissions[permission]
    if (impliedPermission) {
      nextPermissions.add(impliedPermission)
    }
  })

  return Array.from(nextPermissions)
}

export function ManagerListPage() {
  const [accounts, setAccounts] = useState<InternalAccount[]>([])
  const [keywordInput, setKeywordInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [page, setPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [notice, setNotice] = useState<Notice | null>(null)
  const [dialog, setDialog] = useState<DialogState>(null)
  const [createForm, setCreateForm] = useState<CreateStaffPayload>(emptyCreateForm)
  const [editingPermissions, setEditingPermissions] = useState<StaffPermission[]>([])
  const [temporaryPassword, setTemporaryPassword] = useState('')

  const staffCount = useMemo(
    () => accounts.filter((account) => account.role === 'staff').length,
    [accounts],
  )
  const activeCount = useMemo(
    () => accounts.filter((account) => account.isActive).length,
    [accounts],
  )

  const loadAccounts = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage('')

    try {
      const result = await listInternalAccounts({
        keyword,
        role: roleFilter,
        status: statusFilter,
        page,
        limit: pageSize,
      })

      setAccounts(result.items)
      setTotalItems(result.totalItems)
      setTotalPages(Math.max(1, result.totalPages))
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }, [keyword, page, roleFilter, statusFilter])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setPage(1)
      setKeyword(keywordInput.trim())
    }, 320)

    return () => window.clearTimeout(handle)
  }, [keywordInput])

  useEffect(() => {
    void loadAccounts()
  }, [loadAccounts])

  const replaceAccount = (updatedAccount: InternalAccount) => {
    setAccounts((currentAccounts) =>
      currentAccounts.map((account) =>
        account._id === updatedAccount._id ? updatedAccount : account,
      ),
    )
  }

  const openCreateDialog = () => {
    setCreateForm(emptyCreateForm)
    setNotice(null)
    setDialog({ type: 'create' })
  }

  const openPermissionsDialog = (account: InternalAccount) => {
    setEditingPermissions(account.permissions ?? [])
    setNotice(null)
    setDialog({ type: 'permissions', account })
  }

  const openResetDialog = (account: InternalAccount) => {
    setTemporaryPassword('')
    setNotice(null)
    setDialog({ type: 'reset', account })
  }

  const closeDialog = () => {
    if (!actionLoading) {
      setDialog(null)
    }
  }

  const toggleCreatePermission = (permission: StaffPermission) => {
    setCreateForm((currentForm) => ({
      ...currentForm,
      permissions: togglePermission(currentForm.permissions, permission),
    }))
  }

  const toggleEditingPermission = (permission: StaffPermission) => {
    setEditingPermissions((currentPermissions) =>
      togglePermission(currentPermissions, permission),
    )
  }

  const handleCreateStaff = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setActionLoading(true)
    setNotice(null)

    try {
      await createStaffAccount({
        ...createForm,
        permissions: expandImpliedPermissions(createForm.permissions),
      })
      setDialog(null)
      setNotice({ type: 'success', message: 'Đã thêm thành viên' })
      await loadAccounts()
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setActionLoading(false)
    }
  }

  const handleUpdatePermissions = async () => {
    if (!dialog || dialog.type !== 'permissions') {
      return
    }

    setActionLoading(true)
    setNotice(null)

    try {
      const updatedAccount = await updateStaffPermissions(
        dialog.account._id,
        expandImpliedPermissions(editingPermissions),
      )
      replaceAccount(updatedAccount)
      setDialog(null)
      setNotice({ type: 'success', message: 'Đã cập nhật quyền staff' })
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setActionLoading(false)
    }
  }

  const handleResetPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!dialog || dialog.type !== 'reset') {
      return
    }

    setActionLoading(true)
    setNotice(null)

    try {
      const updatedAccount = await resetStaffTemporaryPassword(
        dialog.account._id,
        temporaryPassword,
      )
      replaceAccount(updatedAccount)
      setDialog(null)
      setNotice({ type: 'success', message: 'Đã đặt mật khẩu tạm cho staff' })
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setActionLoading(false)
    }
  }

  const handleStatusChange = async (account: InternalAccount, nextActive: boolean) => {
    setActionLoading(true)
    setNotice(null)

    try {
      const updatedAccount = await updateStaffStatus(account._id, nextActive)
      replaceAccount(updatedAccount)
      setNotice({
        type: 'success',
        message: nextActive ? 'Đã mở khóa staff' : 'Đã khóa staff',
      })
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <section className="admin-users-page" aria-busy={isLoading}>
      <header className="admin-page-heading">
        <div>
          <p>Quản lý nội bộ</p>
          <h1>Nhân sự & phân quyền</h1>
        </div>

        <button className="admin-primary-button" type="button" onClick={openCreateDialog}>
          Thêm thành viên
        </button>
      </header>

      <div className="admin-user-stats" aria-label="Thống kê tài khoản nội bộ">
        <div>
          <span>Tổng nội bộ</span>
          <strong>{totalItems}</strong>
        </div>
        <div>
          <span>Nhân viên đang hiển thị</span>
          <strong>{staffCount}</strong>
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
          <span>Vai trò</span>
          <select
            value={roleFilter}
            onChange={(event) => {
              setRoleFilter(event.target.value as RoleFilter)
              setPage(1)
            }}
          >
            {Object.entries(roleFilterLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Trạng thái</span>
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as StatusFilter)
              setPage(1)
            }}
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
          <button className="admin-secondary-button" type="button" onClick={() => void loadAccounts()}>
            Thử lại
          </button>
        </div>
      ) : (
        <div className="admin-table-shell">
          <table className="admin-users-table">
            <thead>
              <tr>
                <th>Tài khoản</th>
                <th>Liên hệ</th>
                <th>Vai trò</th>
                <th>Trạng thái</th>
                <th>Bảo mật</th>
                <th>Quyền</th>
                <th>Đăng nhập cuối</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8}>
                    <div className="admin-table-loading">Đang tải danh sách...</div>
                  </td>
                </tr>
              ) : null}

              {!isLoading && accounts.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="admin-table-loading">Không có tài khoản nội bộ phù hợp.</div>
                  </td>
                </tr>
              ) : null}

              {!isLoading
                ? accounts.map((account) => {
                    const canManageStaff = account.role === 'staff'

                    return (
                      <tr key={account._id}>
                        <td>
                          <div className="admin-user-cell">
                            <span className="admin-user-avatar" aria-hidden="true">
                              {getAccountTitle(account).trim().charAt(0).toUpperCase() || 'S'}
                            </span>
                            <div>
                              <strong>{getAccountTitle(account)}</strong>
                              <small>{account.role === 'admin' ? 'Tài khoản quản trị' : 'Tài khoản nhân sự'}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="admin-contact-cell">
                            <span>{account.email}</span>
                            <small>{account.phone || 'Chưa có số điện thoại'}</small>
                          </div>
                        </td>
                        <td>{account.role === 'admin' ? 'Quản trị viên' : 'Nhân viên'}</td>
                        <td>
                          <span className={`admin-status-pill ${account.isActive ? 'is-active' : 'is-blocked'}`}>
                            {account.isActive ? 'Hoạt động' : 'Bị khóa'}
                          </span>
                        </td>
                        <td>
                          <span className={`admin-status-pill ${account.mustChangePassword ? 'is-blocked' : 'is-active'}`}>
                            {account.mustChangePassword ? 'Cần đổi mật khẩu' : 'Đã thiết lập'}
                          </span>
                        </td>
                        <td>{account.role === 'admin' ? 'Toàn quyền' : `${account.permissions?.length ?? 0} quyền`}</td>
                        <td>{formatDate(account.lastLoginAt)}</td>
                        <td>
                          <div className="admin-row-actions">
                            <button
                              className="admin-link-button"
                              type="button"
                              disabled={!canManageStaff || actionLoading}
                              onClick={() => openPermissionsDialog(account)}
                            >
                              Quyền
                            </button>
                            <button
                              className="admin-link-button"
                              type="button"
                              disabled={!canManageStaff || actionLoading}
                              onClick={() => openResetDialog(account)}
                            >
                              Đặt lại mật khẩu
                            </button>
                            <button
                              className={account.isActive ? 'admin-danger-link' : 'admin-link-button'}
                              type="button"
                              disabled={!canManageStaff || actionLoading}
                              onClick={() => void handleStatusChange(account, !account.isActive)}
                            >
                              {account.isActive ? 'Khóa' : 'Mở'}
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

      {dialog?.type === 'create' ? (
        <div className="admin-confirm-layer" role="dialog" aria-modal="true" aria-labelledby="admin-account-create-title">
          <form className="admin-account-dialog" onSubmit={handleCreateStaff}>
            <h2 id="admin-account-create-title">Thêm thành viên</h2>
            <div className="admin-account-form-grid">
              <label>
                <span>Họ tên</span>
                <input
                  value={createForm.name}
                  onChange={(event) => setCreateForm((form) => ({ ...form, name: event.target.value }))}
                  required
                />
              </label>
              <label>
                <span>Email</span>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(event) => setCreateForm((form) => ({ ...form, email: event.target.value }))}
                  required
                />
              </label>
              <label>
                <span>Số điện thoại</span>
                <input
                  value={createForm.phone}
                  onChange={(event) => setCreateForm((form) => ({ ...form, phone: event.target.value }))}
                />
              </label>
              <label>
                <span>Mật khẩu tạm</span>
                <input
                  type="text"
                  value={createForm.password}
                  onChange={(event) => setCreateForm((form) => ({ ...form, password: event.target.value }))}
                  required
                  minLength={8}
                />
              </label>
            </div>
            <PermissionEditor
              selectedPermissions={createForm.permissions}
              onToggle={toggleCreatePermission}
            />
            <DialogActions
              isLoading={actionLoading}
              onCancel={closeDialog}
              submitText="Thêm thành viên"
            />
          </form>
        </div>
      ) : null}

      {dialog?.type === 'permissions' ? (
        <div className="admin-confirm-layer" role="dialog" aria-modal="true" aria-labelledby="admin-account-permissions-title">
          <div className="admin-account-dialog">
            <h2 id="admin-account-permissions-title">Phân quyền nhân viên</h2>
            <p className="admin-muted-text">{getAccountTitle(dialog.account)}</p>
            <PermissionEditor
              selectedPermissions={editingPermissions}
              onToggle={toggleEditingPermission}
            />
            <div className="admin-dialog-actions">
              <button className="admin-secondary-button" type="button" disabled={actionLoading} onClick={closeDialog}>
                Hủy
              </button>
              <button
                className="admin-primary-button"
                type="button"
                disabled={actionLoading}
                onClick={() => void handleUpdatePermissions()}
              >
                {actionLoading ? 'Đang lưu...' : 'Lưu quyền'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {dialog?.type === 'reset' ? (
        <div className="admin-confirm-layer" role="dialog" aria-modal="true" aria-labelledby="admin-account-reset-title">
          <form className="admin-account-dialog is-compact" onSubmit={handleResetPassword}>
            <h2 id="admin-account-reset-title">Đặt mật khẩu tạm</h2>
            <p className="admin-muted-text">
              {getAccountTitle(dialog.account)} sẽ phải đổi mật khẩu ngay lần đăng nhập tiếp theo.
            </p>
            <label>
              <span>Mật khẩu tạm mới</span>
              <input
                type="text"
                value={temporaryPassword}
                onChange={(event) => setTemporaryPassword(event.target.value)}
                required
                minLength={8}
              />
            </label>
            <DialogActions
              isLoading={actionLoading}
              onCancel={closeDialog}
              submitText="Đặt mật khẩu"
            />
          </form>
        </div>
      ) : null}
    </section>
  )
}

function togglePermission(
  permissions: StaffPermission[],
  permission: StaffPermission,
) {
  if (permissions.includes(permission)) {
    return permissions.filter((currentPermission) => currentPermission !== permission)
  }

  return [...permissions, permission]
}

function DialogActions({
  isLoading,
  onCancel,
  submitText,
}: {
  isLoading: boolean
  onCancel: () => void
  submitText: string
}) {
  return (
    <div className="admin-dialog-actions">
      <button className="admin-secondary-button" type="button" disabled={isLoading} onClick={onCancel}>
        Hủy
      </button>
      <button className="admin-primary-button" type="submit" disabled={isLoading}>
        {isLoading ? 'Đang xử lý...' : submitText}
      </button>
    </div>
  )
}
