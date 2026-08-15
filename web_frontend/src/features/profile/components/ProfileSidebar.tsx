import { useState } from 'react'
import { Avatar, Menu } from 'antd'
import { message } from 'antd'
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
import { useAppDispatch } from '../../../app/hooks'
import { tokenService } from '../../../services/tokenService'
import { setCurrentUser } from '../../auth/auth.slice'
import { profileService } from '../profile.service'
import { readFileAsDataUrl } from '../profile.utils'
import '../profile.css'

const menuItems = [
  { key: 'profile', icon: <UserOutlined />, label: 'Thông tin cá nhân' },
  { key: 'cart', icon: <ShoppingCartOutlined />, label: 'Giỏ hàng' },
  { key: 'orders', icon: <HomeOutlined />, label: 'Đơn hàng của tôi' },
  { key: 'reviews', icon: <StarOutlined />, label: 'Đánh giá của tôi' },
  { key: 'favorites', icon: <HeartOutlined />, label: 'Sản phẩm yêu thích' },
  { key: 'styling', icon: <SkinOutlined />, label: 'Phòng phối đồ ảo' },
  { key: 'ranking', icon: <StarOutlined />, label: 'Hạng thành viên' },
  { key: 'coupons', icon: <GiftOutlined />, label: 'Voucher & Ưu đãi' },
  { key: 'payment', icon: <CreditCardOutlined />, label: 'Phương thức thanh toán' },
  { key: 'support', icon: <QuestionCircleOutlined />, label: 'Hỗ trợ' },
]

const menuPaths: Record<string, string> = {
  profile: '/account',
  cart: '/cart',
  orders: '/account/orders',
  reviews: '/account/reviews',
  favorites: '/account?section=favorites',
  ranking: '/account?section=ranking',
  coupons: '/account?section=coupons',
  payment: '/account?section=payment',
  support: '/account/support',
}

type ProfileSidebarProps = {
  name?: string
  avatarImage?: string | null
  role?: string
  selectedKey?: string
}

export function ProfileSidebar({
  name,
  avatarImage,
  role,
  selectedKey = 'profile',
}: ProfileSidebarProps) {
  const dispatch = useAppDispatch()
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)

  const handleAvatarUpload = async (file: File) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp']
    const maxAvatarBytes = 3 * 1024 * 1024

    if (!allowedMimeTypes.includes(file.type)) {
      message.error('Ảnh đại diện phải là JPG, PNG hoặc WEBP.')
      return
    }

    if (file.size > maxAvatarBytes) {
      message.error('Ảnh đại diện tối đa 3MB.')
      return
    }

    setIsUploadingAvatar(true)

    try {
      const imageBase64 = await readFileAsDataUrl(file)
      const updatedUser = await profileService.uploadAvatar({
        imageBase64,
        mimeType: file.type,
      })

      tokenService.setCurrentUser(updatedUser)
      dispatch(setCurrentUser(updatedUser))
      message.success('Cập nhật ảnh đại diện thành công.')
    } catch (uploadError) {
      message.error(uploadError instanceof Error ? uploadError.message : 'Không thể cập nhật ảnh đại diện.')
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  return (
    <aside className="account-sidebar" aria-label="Tài khoản">
      <div className="user-card">
        <div className="user-card-top">
          <Avatar size={52} src={avatarImage || undefined} icon={<UserOutlined />} />
          <label className={`avatar-update-button${isUploadingAvatar ? ' is-loading' : ''}`}>
            <span>{isUploadingAvatar ? 'Đang lưu' : 'Cập nhật'}</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={isUploadingAvatar}
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file) void handleAvatarUpload(file)
              }}
            />
          </label>
        </div>
        <div className="user-card-name">
          <strong>{name || 'Chào mừng!'}</strong>
        </div>
      </div>

      <Menu
        className="account-menu"
        mode="inline"
        selectedKeys={[selectedKey]}
        items={role === 'user' ? menuItems : menuItems.filter((item) => item.key !== 'favorites')}
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
