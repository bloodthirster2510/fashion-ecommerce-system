import type { AdminUser } from '../adminSession'
import type { ManagedUser } from './userAdminApi'

type UserDetailDrawerProps = {
  user: ManagedUser | null
  currentUser: AdminUser
  isLoading: boolean
  onClose: () => void
  onRequestStatusChange: (user: ManagedUser, nextActive: boolean) => void
  onRequestPasswordReset: (user: ManagedUser) => void
}

const genderLabels = {
  male: 'Nam',
  female: 'Nữ',
} as const

const formatDate = (value?: string) => {
  if (!value) {
    return 'Chưa có'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Chưa có'
  }

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

const getDisplayName = (user: ManagedUser) => user.name || user.email

export function UserDetailDrawer({
  user,
  currentUser,
  isLoading,
  onClose,
  onRequestStatusChange,
  onRequestPasswordReset,
}: UserDetailDrawerProps) {
  if (!user) {
    return null
  }

  const canManageUser = currentUser.role === 'admin' && currentUser._id !== user._id
  const addresses = user.address ?? []
  const primaryAddress = addresses.find((address) => address.isDefault) ?? addresses[0]

  return (
    <div className="admin-drawer-layer" role="presentation">
      <button
        aria-label="Đóng chi tiết khách hàng"
        className="admin-drawer-backdrop"
        type="button"
        onClick={onClose}
      />

      <aside className="admin-user-drawer" aria-label="Chi tiết khách hàng">
        <header className="admin-drawer-header">
          <div className="admin-user-identity">
            <span className="admin-user-avatar" aria-hidden="true">
              {getDisplayName(user).trim().charAt(0).toUpperCase() || 'U'}
            </span>
            <div>
              <h2>{getDisplayName(user)}</h2>
              <p>{user.email}</p>
            </div>
          </div>

          <button className="admin-icon-button" type="button" aria-label="Đóng" onClick={onClose}>
            ×
          </button>
        </header>

        {isLoading ? <div className="admin-drawer-loading">Đang tải chi tiết...</div> : null}

        <section className="admin-drawer-section" aria-label="Trạng thái tài khoản">
          <div className="admin-detail-row">
            <span>Trạng thái</span>
            <strong className={`admin-status-pill ${user.isActive ? 'is-active' : 'is-blocked'}`}>
              {user.isActive ? 'Hoạt động' : 'Bị khóa'}
            </strong>
          </div>

          <div className="admin-drawer-actions">
            <button
              className={user.isActive ? 'admin-danger-button' : 'admin-primary-button'}
              type="button"
              disabled={!canManageUser}
              onClick={() => onRequestStatusChange(user, !user.isActive)}
            >
              {user.isActive ? 'Khóa tài khoản' : 'Mở khóa'}
            </button>
            <button
              className="admin-secondary-button"
              type="button"
              disabled={!canManageUser}
              onClick={() => onRequestPasswordReset(user)}
            >
              Yêu cầu đổi mật khẩu
            </button>
          </div>
        </section>

        <section className="admin-drawer-section" aria-label="Thông tin cá nhân">
          <div className="admin-detail-grid">
            <div>
              <span>Số điện thoại</span>
              <strong>{user.phone || 'Chưa có'}</strong>
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
              <span>Điểm thành viên</span>
              <strong>{user.loyaltyPoint ?? 0}</strong>
            </div>
            <div>
              <span>Ngày tạo</span>
              <strong>{formatDate(user.createdAt)}</strong>
            </div>
            <div>
              <span>Cập nhật</span>
              <strong>{formatDate(user.updatedAt)}</strong>
            </div>
          </div>
        </section>

        <section className="admin-drawer-section" aria-label="Địa chỉ mặc định">
          <h3>Địa chỉ</h3>
          {primaryAddress ? (
            <div className="admin-address-block">
              <strong>{primaryAddress.customerName || getDisplayName(user)}</strong>
              <span>{primaryAddress.phoneNumber || user.phone || 'Chưa có số điện thoại'}</span>
              <p>
                {[primaryAddress.streetName, primaryAddress.ward, primaryAddress.district, primaryAddress.province]
                  .filter(Boolean)
                  .join(', ')}
              </p>
            </div>
          ) : (
            <p className="admin-muted-text">Khách hàng chưa lưu địa chỉ.</p>
          )}
        </section>

        {!canManageUser ? (
          <p className="admin-permission-note">
            Chỉ tài khoản admin mới được đổi trạng thái hoặc yêu cầu đổi mật khẩu.
          </p>
        ) : null}
      </aside>
    </div>
  )
}

export { formatDate }
