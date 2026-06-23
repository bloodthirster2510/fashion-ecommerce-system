import { Avatar, Menu } from 'antd'
import {
  CreditCardOutlined,
  GiftOutlined,
  HeartOutlined,
  HomeOutlined,
  QuestionCircleOutlined,
  ShoppingCartOutlined,
  SkinOutlined,
  StarOutlined,
  UserOutlined,
} from '@ant-design/icons'

const menuItems = [
  { key: 'profile', icon: <UserOutlined />, label: 'Thông tin cá nhân' },
  { key: 'cart', icon: <ShoppingCartOutlined />, label: 'Giỏ hàng' },
  { key: 'orders', icon: <HomeOutlined />, label: 'Đơn hàng của tôi' },
  { key: 'favorites', icon: <HeartOutlined />, label: 'Sản phẩm yêu thích' },
  { key: 'styling', icon: <SkinOutlined />, label: 'Phòng phối đồ ảo' },
  { key: 'ranking', icon: <StarOutlined />, label: 'Hạng thành viên' },
  { key: 'coupons', icon: <GiftOutlined />, label: 'Voucher & Ưu đãi' },
  { key: 'payment', icon: <CreditCardOutlined />, label: 'Phương thức thanh toán' },
  { key: 'support', icon: <QuestionCircleOutlined />, label: 'Hỗ trợ' },
]

const menuPaths: Record<string, string> = {
  profile: '/account',
  support: '/account/support',
}

type ProfileSidebarProps = {
  name?: string
  avatarImage?: string | null
  selectedKey?: string
}

export function ProfileSidebar({ name, avatarImage, selectedKey = 'profile' }: ProfileSidebarProps) {
  return (
    <aside className="account-sidebar" aria-label="Tài khoản">
      <div className="user-card">
        <Avatar size={52} src={avatarImage || undefined} icon={<UserOutlined />} />
        <div>
          <strong>{name || 'Chào mừng!'}</strong>
          <span>Tài khoản của bạn</span>
        </div>
      </div>

      <Menu
        className="account-menu"
        mode="inline"
        selectedKeys={[selectedKey]}
        items={menuItems}
        onClick={({ key }) => {
          const path = menuPaths[key]
          if (!path) return
          window.history.pushState(null, '', path)
          window.dispatchEvent(new PopStateEvent('popstate'))
        }}
      />
    </aside>
  )
}
