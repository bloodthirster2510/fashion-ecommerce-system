import { Button, Drawer, StatusBadge } from '../../../components/ui'
import type { AdminUser } from '../../auth/adminSession'
import type { ManagedUser } from '../customer.types'
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

const genderLabels = {
  male: 'Nam',
  female: 'Nữ',
} as const

const getDisplayName = (user: ManagedUser) => user.name || user.email

export function CustomerDetailDrawer({
  user,
  currentUser,
  isLoading,
  onClose,
  onRequestStatusChange,
  onRequestPasswordReset,
}: CustomerDetailDrawerProps) {
  if (!user) {
    return null
  }

  const canManageCustomers =
    currentUser.role === 'admin' || currentUser.permissions?.includes('customers.manage') === true
  const canManageUser = canManageCustomers && currentUser._id !== user._id
  const addresses = user.address ?? []
  const primaryAddress = addresses.find((address) => address.isDefault) ?? addresses[0]

  return (
    <Drawer
      isOpen={Boolean(user)}
      title={getDisplayName(user)}
      description={user.email}
      onClose={onClose}
    >
        {isLoading ? <div className="admin-drawer-loading">Đang tải chi tiết...</div> : null}

        <section className="admin-drawer-section" aria-label="Trạng thái tài khoản">
          <div className="admin-detail-row">
            <span>Trạng thái</span>
            <StatusBadge tone={user.isActive ? 'success' : 'danger'}>
              {user.isActive ? 'Hoạt động' : 'Bị khóa'}
            </StatusBadge>
          </div>

          <div className="admin-drawer-actions">
            <Button
              variant={user.isActive ? 'danger' : 'primary'}
              disabled={!canManageUser}
              onClick={() => onRequestStatusChange(user, !user.isActive)}
            >
              {user.isActive ? 'Khóa tài khoản' : 'Mở khóa'}
            </Button>
            <Button
              variant="secondary"
              disabled={!canManageUser}
              onClick={() => onRequestPasswordReset(user)}
            >
              Yêu cầu đổi mật khẩu
            </Button>
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
            Cần quyền customers.manage để đổi trạng thái hoặc yêu cầu đổi mật khẩu.
          </p>
        ) : null}
    </Drawer>
  )
}

