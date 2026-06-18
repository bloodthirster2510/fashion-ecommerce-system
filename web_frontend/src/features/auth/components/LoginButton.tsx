import { useState } from 'react'
import { LockOutlined, MailOutlined, UserOutlined } from '@ant-design/icons'
import { Alert, Avatar, Button, Checkbox, Form, Input, Popover, message } from 'antd'
import { useAppDispatch, useAppSelector } from '../../../app/hooks'
import { clearCurrentUser, setCurrentUser } from '../auth.slice'
import { authService } from '../auth.service'
import type { AuthUser } from '../auth.types'
import { RegisterModal } from './RegisterModal'
import { tokenService } from '../../../services/tokenService'
import '../auth.css'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const vietnamPhonePattern = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/

type LoginFormValues = {
  identifier: string
  password: string
}

export function LoginButton() {
  const dispatch = useAppDispatch()
  const currentUser = useAppSelector((state) => state.auth.currentUser)

  // Popover đăng nhập và modal đăng ký dùng state riêng.
  // Chúng không được mở đồng thời để tránh hai lớp nền mờ chồng lên nhau.
  const [isLoginOpen, setIsLoginOpen] = useState(false)
  const [isRegisterOpen, setIsRegisterOpen] = useState(false)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [form] = Form.useForm()

  const handleLoginOpenChange = (open: boolean) => {
    // Khi popover đóng, xóa cả dữ liệu đã nhập và trạng thái lỗi.
    // Nếu không reset, Ant Design sẽ giữ viền đỏ khi người dùng mở form lần sau.
    if (!open) {
      form.resetFields()
      setLoginError('')
    }

    setIsLoginOpen(open)
  }

  const handleRegisterOpen = () => {
    // Chỉ hiển thị một form auth tại một thời điểm:
    // đóng đăng nhập trước rồi mới mở modal đăng ký ở giữa màn hình.
    form.resetFields()
    setLoginError('')
    setIsLoginOpen(false)
    setIsRegisterOpen(true)
  }

  const handleAuthenticated = (user: AuthUser) => {
    // Khi login hoặc register thành công, cập nhật state ngay để header đổi UI tức thì.
    // User cũng đã được authService lưu vào localStorage để vẫn hiển thị sau khi refresh trang.
    dispatch(setCurrentUser(user))
  }

  const handleLogout = async () => {
    const accessToken = tokenService.getAccessToken()
    if (accessToken) {
      await authService.logout(accessToken)
    }

    tokenService.clearSession()
    dispatch(clearCurrentUser())
    message.success('Đã đăng xuất.')
  }

  const handleAccountNavigate = () => {
    setIsLoginOpen(false)
    window.location.assign('/account')
  }

  const handleLogin = async (values: LoginFormValues) => {
    // loading khóa nút submit trong lúc chờ backend, tránh gửi request login lặp.
    setIsLoggingIn(true)
    setLoginError('')

    try {
      // authService chịu trách nhiệm gọi API và lưu access token, refresh token.
      const session = await authService.login(values.identifier.trim(), values.password)
      handleAuthenticated(session.user)
      message.success('Đăng nhập thành công.')
      handleLoginOpenChange(false)
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Không thể đăng nhập. Vui lòng thử lại.')
    } finally {
      setIsLoggingIn(false)
    }
  }

  const loginForm = (
    <div className="login-popover-content">
      <div className="login-modal-heading">
        <h2>Đăng nhập</h2>
        <p>Đăng nhập để tiếp tục mua sắm cùng Fashionista.</p>
      </div>

      {loginError && <Alert className="auth-alert" type="error" message={loginError} showIcon />}

      <Form form={form} layout="vertical" requiredMark={false} className="login-form" onFinish={handleLogin}>
        <Form.Item
          label="Email hoặc số điện thoại"
          name="identifier"
          rules={[
            { required: true, message: 'Vui lòng nhập email hoặc số điện thoại.' },
            {
              // Backend cho phép dùng chung một trường identifier.
              // Frontend kiểm tra trước để người dùng nhận lỗi ngay, không cần chờ request API.
              validator: (_, value: string) => {
                if (!value || emailPattern.test(value) || vietnamPhonePattern.test(value)) {
                  return Promise.resolve()
                }

                return Promise.reject(new Error('Email hoặc số điện thoại không hợp lệ.'))
              },
            },
          ]}
        >
          <Input prefix={<MailOutlined />} placeholder="Nhập email hoặc số điện thoại" size="large" />
        </Form.Item>

        <Form.Item
          label="Mật khẩu"
          name="password"
          rules={[{ required: true, message: 'Vui lòng nhập mật khẩu.' }]}
        >
          <Input.Password prefix={<LockOutlined />} placeholder="Nhập mật khẩu" size="large" />
        </Form.Item>

        <div className="login-form-options">
          <Form.Item name="remember" valuePropName="checked" noStyle>
            <Checkbox>Ghi nhớ đăng nhập</Checkbox>
          </Form.Item>
          <a href="/">Quên mật khẩu?</a>
        </div>

        <Button type="primary" htmlType="submit" size="large" block className="login-submit" loading={isLoggingIn}>
          Đăng nhập
        </Button>
      </Form>

      <p className="login-register">
        Bạn chưa có tài khoản?{' '}
        <button type="button" onClick={handleRegisterOpen}>
          Đăng ký ngay
        </button>
      </p>
    </div>
  )

  if (currentUser) {
    return (
      <Popover
        rootClassName="account-popover"
        trigger="click"
        placement="bottomRight"
        content={
          <div className="account-popover-content">
            <strong>{currentUser.name}</strong>
            <span>{currentUser.email}</span>
            <Button type="text" icon={<UserOutlined />} onClick={handleAccountNavigate}>
              Quản lý tài khoản
            </Button>
            <Button type="text" danger onClick={handleLogout}>
              Đăng xuất
            </Button>
          </div>
        }
      >
        <Button className="account-trigger">
          <span>{currentUser.name}</span>
          <Avatar size={30} src={currentUser.avatarImage || undefined} icon={<UserOutlined />} />
        </Button>
      </Popover>
    )
  }

  return (
    <>
      {isLoginOpen && <button className="auth-backdrop" type="button" aria-label="Đóng đăng nhập" onClick={() => handleLoginOpenChange(false)} />}

      <Popover
        rootClassName="login-popover"
        content={loginForm}
        open={isLoginOpen}
        placement="bottomRight"
        trigger="click"
        onOpenChange={handleLoginOpenChange}
      >
        <Button className="login-link">
          <span>Đăng nhập</span>
          <span className="client-action-icon">
            <UserOutlined />
          </span>
        </Button>
      </Popover>

      <RegisterModal open={isRegisterOpen} onClose={() => setIsRegisterOpen(false)} onAuthenticated={handleAuthenticated} />
    </>
  )
}
