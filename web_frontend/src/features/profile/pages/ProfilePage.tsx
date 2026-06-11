import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Divider, Form, Input, Select, Space, message } from 'antd'
import { useAppDispatch, useAppSelector } from '../../../app/hooks'
import { MainLayout } from '../../../layouts/MainLayout'
import { tokenService } from '../../../services/tokenService'
import { ProfileSidebar } from '../components/ProfileSidebar'
import { profileService, type UserAddress } from '../profile.service'
import { setCurrentUser } from '../../auth/auth.slice'
import '../profile.css'

type ProfileFormValues = {
  name: string
  phone: string
  gender: 'male' | 'female'
  dateOfBirth: string
  email: string
  address?: string
}

type PasswordFormValues = {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

const formatDateForInput = (value?: string) => {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return date.toISOString().slice(0, 10)
}

const passwordPattern = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/

export function ProfilePage() {
  const dispatch = useAppDispatch()
  const currentUser = useAppSelector((state) => state.auth.currentUser)
  const [profileForm] = Form.useForm<ProfileFormValues>()
  const [passwordForm] = Form.useForm<PasswordFormValues>()
  const [defaultAddress, setDefaultAddress] = useState<UserAddress | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [error, setError] = useState('')

  const defaultAddressText = useMemo(() => {
    if (!defaultAddress) return ''

    return [defaultAddress.streetName, defaultAddress.ward, defaultAddress.province].filter(Boolean).join(', ')
  }, [defaultAddress])

  useEffect(() => {
    const loadAccount = async () => {
      setIsLoading(true)
      setError('')

      try {
        const [user, addresses] = await Promise.all([profileService.getMe(), profileService.getAddresses()])
        const selectedAddress = addresses.find((item) => item.isDefault) || addresses[0] || null

        tokenService.setCurrentUser(user)
        dispatch(setCurrentUser(user))
        setDefaultAddress(selectedAddress)
        profileForm.setFieldsValue({
          name: user.name,
          phone: user.phone,
          gender: user.gender || 'male',
          dateOfBirth: formatDateForInput(user.dateOfBirth),
          email: user.email,
          address: selectedAddress
            ? [selectedAddress.streetName, selectedAddress.ward, selectedAddress.province].filter(Boolean).join(', ')
            : '',
        })
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Không thể tải thông tin tài khoản.')
      } finally {
        setIsLoading(false)
      }
    }

    void loadAccount()
  }, [dispatch, profileForm])

  const handleProfileSubmit = async (values: ProfileFormValues) => {
    setIsSavingProfile(true)
    setError('')

    try {
      const updatedUser = await profileService.updateMe({
        name: values.name.trim(),
        phone: values.phone.trim(),
        gender: values.gender,
        dateOfBirth: values.dateOfBirth,
      })

      if (defaultAddress?._id && values.address !== undefined && values.address.trim() !== defaultAddressText) {
        // Form chỉ có một ô địa chỉ như thiết kế, trong khi backend lưu tỉnh/phường/đường riêng.
        // Vì vậy chỉ cập nhật streetName của địa chỉ mặc định và giữ nguyên province/ward hiện có.
        const updatedAddresses = await profileService.updateAddress(defaultAddress._id, {
          streetName: values.address.trim(),
          isDefault: defaultAddress.isDefault,
        })
        setDefaultAddress(updatedAddresses.find((item) => item.isDefault) || updatedAddresses[0] || null)
      }

      tokenService.setCurrentUser(updatedUser)
      dispatch(setCurrentUser(updatedUser))
      message.success('Cập nhật thông tin thành công.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không thể cập nhật thông tin.')
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handlePasswordSubmit = async (values: PasswordFormValues) => {
    setIsChangingPassword(true)
    setError('')

    try {
      await profileService.changePassword(values)
      passwordForm.resetFields()
      message.success('Đổi mật khẩu thành công. Vui lòng đăng nhập lại ở lần truy cập sau nếu phiên hết hạn.')
    } catch (passwordError) {
      setError(passwordError instanceof Error ? passwordError.message : 'Không thể đổi mật khẩu.')
    } finally {
      setIsChangingPassword(false)
    }
  }

  return (
    <MainLayout showSlider={false}>
      <main className="account-page">
        <div className="account-shell">
          <ProfileSidebar name={currentUser?.name} avatarImage={currentUser?.avatarImage} />
          <section className="account-content" aria-label="Nội dung tài khoản">
            <Space direction="vertical" size={20} className="profile-panel">
              {error && <Alert type="error" message={error} showIcon />}

              <section aria-labelledby="personal-info-title">
                <h1 id="personal-info-title">Thông tin cá nhân</h1>
                <Form
                  form={profileForm}
                  layout="vertical"
                  requiredMark={false}
                  className="account-form"
                  disabled={isLoading}
                  onFinish={handleProfileSubmit}
                >
                  <div className="account-form-grid">
                    <Form.Item
                      label="Họ và tên"
                      name="name"
                      rules={[{ required: true, message: 'Vui lòng nhập họ tên.' }]}
                    >
                      <Input placeholder="Nguyễn Văn A" />
                    </Form.Item>

                    <Form.Item
                      label="Số điện thoại"
                      name="phone"
                      rules={[{ required: true, message: 'Vui lòng nhập số điện thoại.' }]}
                    >
                      <Input placeholder="0123456789" />
                    </Form.Item>

                    <Form.Item
                      label="Giới tính"
                      name="gender"
                      rules={[{ required: true, message: 'Vui lòng chọn giới tính.' }]}
                    >
                      <Select
                        placeholder="Chọn giới tính"
                        options={[
                          { value: 'male', label: 'Nam' },
                          { value: 'female', label: 'Nữ' },
                        ]}
                      />
                    </Form.Item>

                    <Form.Item
                      label="Năm sinh"
                      name="dateOfBirth"
                      rules={[{ required: true, message: 'Vui lòng nhập ngày sinh.' }]}
                    >
                      <Input type="date" />
                    </Form.Item>
                  </div>

                  <Form.Item label="Email" name="email">
                    <Input disabled placeholder="email@example.com" />
                  </Form.Item>

                  <Form.Item label="Địa chỉ" name="address">
                    <Input.TextArea rows={4} placeholder="Nhập địa chỉ của bạn" />
                  </Form.Item>

                  <Button type="primary" htmlType="submit" loading={isSavingProfile}>
                    Cập nhật thông tin
                  </Button>
                </Form>
              </section>

              <Divider />

              <section aria-labelledby="security-title">
                <h2 id="security-title">Tài khoản & Bảo mật</h2>
                <Form
                  form={passwordForm}
                  layout="vertical"
                  requiredMark={false}
                  className="account-form"
                  onFinish={handlePasswordSubmit}
                >
                  <Form.Item label="Tên đăng nhập">
                    <Input disabled value={currentUser?.email || ''} />
                    <p className="field-hint">Tên đăng nhập không thể thay đổi</p>
                  </Form.Item>

                  <Form.Item
                    label="Mật khẩu hiện tại"
                    name="currentPassword"
                    rules={[{ required: true, message: 'Vui lòng nhập mật khẩu hiện tại.' }]}
                  >
                    <Input.Password placeholder="Nhập mật khẩu hiện tại" />
                  </Form.Item>

                  <div className="account-form-grid">
                    <Form.Item
                      label="Mật khẩu mới"
                      name="newPassword"
                      rules={[
                        {
                          required: true,
                          pattern: passwordPattern,
                          message: 'Mật khẩu mới tối thiểu 8 ký tự, gồm chữ và số.',
                        },
                      ]}
                    >
                      <Input.Password placeholder="Nhập mật khẩu mới" />
                    </Form.Item>

                    <Form.Item
                      label="Xác nhận mật khẩu mới"
                      name="confirmPassword"
                      dependencies={['newPassword']}
                      rules={[
                        { required: true, message: 'Vui lòng xác nhận mật khẩu mới.' },
                        ({ getFieldValue }) => ({
                          validator(_, value) {
                            if (!value || getFieldValue('newPassword') === value) {
                              return Promise.resolve()
                            }

                            return Promise.reject(new Error('Xác nhận mật khẩu không trùng khớp.'))
                          },
                        }),
                      ]}
                    >
                      <Input.Password placeholder="Nhập lại mật khẩu mới" />
                    </Form.Item>
                  </div>

                  <Alert
                    className="password-note"
                    type="info"
                    message="Lưu ý: Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ và số."
                    showIcon={false}
                  />

                  <Button type="primary" htmlType="submit" loading={isChangingPassword}>
                    Đổi mật khẩu
                  </Button>
                </Form>
              </section>
            </Space>
          </section>
        </div>
      </main>
    </MainLayout>
  )
}
