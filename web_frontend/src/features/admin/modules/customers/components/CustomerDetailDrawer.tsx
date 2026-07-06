import { useEffect, useState } from 'react'
import { Button, Drawer, StatusBadge, Tabs, type TabItem } from '../../../components/ui'
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

type CustomerDetailTab = 'overview' | 'addresses' | 'admin'

const genderLabels = {
  male: 'Nam',
  female: 'Nữ',
} as const

const detailTabs: Array<TabItem<CustomerDetailTab>> = [
  { value: 'overview', label: 'Tổng quan' },
  { value: 'addresses', label: 'Địa chỉ' },
  { value: 'admin', label: 'Quản trị' },
]

const getDisplayName = (user: ManagedUser) => user.name || user.email

export function CustomerDetailDrawer({
  user,
  currentUser,
  isLoading,
  onClose,
  onRequestStatusChange,
  onRequestPasswordReset,
}: CustomerDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<CustomerDetailTab>('overview')

  useEffect(() => {
    setActiveTab('overview')
  }, [user?._id])

  if (!user) {
    return null
  }

  const canManageCustomers =
    currentUser.role === 'admin' || currentUser.permissions?.includes('customers.manage') === true
  const canManageUser = canManageCustomers && currentUser._id !== user._id
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
          {getDisplayName(user).trim().charAt(0).toUpperCase() || 'U'}
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
              Cần quyền customers.manage để đổi trạng thái hoặc yêu cầu đổi mật khẩu.
            </p>
          ) : null}
        </section>
      ) : null}
    </Drawer>
  )
}

