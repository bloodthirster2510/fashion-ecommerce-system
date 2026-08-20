import { useEffect, useState } from 'react'
import { LockOutlined, MailOutlined, UserOutlined } from '@ant-design/icons'
import { Alert, Avatar, Button, Checkbox, Form, Input, Popover, message } from 'antd'
import { useAppDispatch, useAppSelector } from '../../../app/hooks'
import { clearCurrentUser, setCurrentUser } from '../auth.slice'
import { clearCart } from '../../cart/cart.slice'
import { authService } from '../auth.service'
import { AuthApiError, type AuthUser } from '../auth.types'
import { ForgotPasswordModal } from './ForgotPasswordModal'
import { RegisterModal } from './RegisterModal'
import { tokenService } from '../../../services/tokenService'
import '../auth.css'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const vietnamPhonePattern = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/
const CUSTOMER_LOGIN_REQUESTED_EVENT = 'customer-login-requested'

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
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false)
  const [forgotPasswordIdentifier, setForgotPasswordIdentifier] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [isLoginLocked, setIsLoginLocked] = useState(false)
  const [unlockCode, setUnlockCode] = useState('')
  const [unlockMethod, setUnlockMethod] = useState<'email' | 'phone'>('email')
  const [unlockRequested, setUnlockRequested] = useState(false)
  const [unlockMessage, setUnlockMessage] = useState('')
  const [isUnlocking, setIsUnlocking] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    const handleLoginRequested = () => {
      if (currentUser) return

      setIsRegisterOpen(false)
      setIsForgotPasswordOpen(false)
      setIsLoginOpen(true)
    }

    window.addEventListener(CUSTOMER_LOGIN_REQUESTED_EVENT, handleLoginRequested)

    return () => window.removeEventListener(CUSTOMER_LOGIN_REQUESTED_EVENT, handleLoginRequested)
  }, [currentUser])

  const handleLoginOpenChange = (open: boolean) => {
    // Khi popover đóng, xóa cả dữ liệu đã nhập và trạng thái lỗi.
    // Nếu không reset, Ant Design sẽ giữ viền đỏ khi người dùng mở form lần sau.
    if (!open) {
      form.resetFields()
      setLoginError('')
      setIsLoginLocked(false)
      setUnlockCode('')
      setUnlockRequested(false)
      setUnlockMessage('')
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

  const handleForgotPasswordOpen = () => {
    setForgotPasswordIdentifier(getLoginIdentifier())
    setLoginError('')
    setIsLoginOpen(false)
    setIsForgotPasswordOpen(true)
  }

  const handleBackToLogin = () => {
    setIsForgotPasswordOpen(false)
    setIsLoginOpen(true)
  }

  const handleAuthenticated = (user: AuthUser) => {
    // Khi login hoặc register thành công, cập nhật state ngay để header đổi UI tức thì.
    // User được lưu lại để header vẫn hiển thị sau refresh; token không lưu localStorage.
    dispatch(setCurrentUser(user))
  }

  const handleLogout = async () => {
    const accessToken = tokenService.getAccessToken()
    await authService.logout(accessToken)

    tokenService.clearSession()
    dispatch(clearCurrentUser())
    dispatch(clearCart())
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
      // authService chịu trách nhiệm gọi API và giữ access token trong memory.
      const session = await authService.login(values.identifier.trim(), values.password)
      handleAuthenticated(session.user)
      message.success('Đăng nhập thành công.')
      handleLoginOpenChange(false)
    } catch (error) {
      if (error instanceof AuthApiError && error.errorCode === 'LOGIN_TEMPORARILY_LOCKED') {
        setIsLoginLocked(true)
        setUnlockRequested(false)
        setUnlockCode('')
        setUnlockMessage('')
      }
      setLoginError(error instanceof Error ? error.message : 'Không thể đăng nhập. Vui lòng thử lại.')
    } finally {
      setIsLoggingIn(false)
    }
  }

  const getLoginIdentifier = () => String(form.getFieldValue('identifier') ?? '').trim()

  const handleIdentifierChange = () => {
    if (!isLoginLocked) return
    setIsLoginLocked(false)
    setUnlockRequested(false)
    setUnlockCode('')
    setUnlockMessage('')
    setLoginError('')
  }

  const handleRequestUnlock = async (channel: 'email' | 'phone') => {
    const identifier = getLoginIdentifier()
    if (!emailPattern.test(identifier) && !vietnamPhonePattern.test(identifier)) {
      setUnlockMessage('Email hoặc số điện thoại không hợp lệ.')
      return
    }

    try {
      setIsUnlocking(true)
      setUnlockMessage('')
      const result = await authService.requestLoginUnlock(identifier, channel)
      setUnlockMethod(result.method)
      setUnlockRequested(true)
      if (result.delivery.mode === 'mock' && result.delivery.testOtp) {
        setUnlockCode(result.delivery.testOtp)
        setUnlockMessage(`Mã OTP thử nghiệm: ${result.delivery.testOtp}`)
      } else {
        setUnlockMessage(result.method === 'email'
          ? 'Mã OTP đã được gửi tới email của bạn.'
          : 'Mã OTP đã được gửi tới số điện thoại của bạn.')
      }
    } catch (error) {
      setUnlockMessage(error instanceof Error ? error.message : 'Chưa thể gửi mã OTP.')
    } finally {
      setIsUnlocking(false)
    }
  }

  const handleVerifyUnlock = async () => {
    if (!/^\d{6}$/.test(unlockCode.trim())) {
      setUnlockMessage('Vui lòng nhập đủ 6 chữ số OTP.')
      return
    }

    try {
      setIsUnlocking(true)
      setUnlockMessage('')
      await authService.verifyLoginUnlock(getLoginIdentifier(), unlockCode.trim())
      setIsLoginLocked(false)
      setUnlockRequested(false)
      setUnlockCode('')
      setLoginError('')
      message.success('Đã mở khóa. Bạn có thể đăng nhập lại.')
    } catch (error) {
      setUnlockMessage(error instanceof Error ? error.message : 'Không thể xác thực mã OTP.')
    } finally {
      setIsUnlocking(false)
    }
  }

  const loginForm = (
    <div className="login-popover-content">
      <div className="login-modal-heading">
        <h2>Đăng nhập</h2>
        <p>Đăng nhập để tiếp tục mua sắm cùng CD Shop</p>
      </div>

      {loginError && <Alert className="auth-alert" type="error" message={loginError} showIcon />}

      {isLoginLocked && (
        <div className="login-unlock-card">
          <strong>Mở khóa đăng nhập</strong>
          <span>Chọn email hoặc SMS đã đăng ký để nhận mã mở khóa.</span>
          {unlockRequested ? (
            <>
              <Input
                value={unlockCode}
                onChange={(event) => setUnlockCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Nhập mã OTP 6 số"
                maxLength={6}
                inputMode="numeric"
                size="large"
                className="login-unlock-code"
              />
              <Button type="primary" block loading={isUnlocking} onClick={handleVerifyUnlock}>
                Xác nhận mở khóa
              </Button>
              <Button type="link" block disabled={isUnlocking} onClick={() => handleRequestUnlock(unlockMethod)}>
                Gửi lại qua {unlockMethod === 'email' ? 'email' : 'SMS'}
              </Button>
            </>
          ) : (
            <div className="login-unlock-channels">
              <Button block loading={isUnlocking} onClick={() => handleRequestUnlock('email')}>
                Nhận qua Email
              </Button>
              <Button block disabled={isUnlocking} onClick={() => handleRequestUnlock('phone')}>
                Nhận qua SMS
              </Button>
            </div>
          )}
          {unlockMessage && <small>{unlockMessage}</small>}
        </div>
      )}

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
          <Input
            prefix={<MailOutlined />}
            placeholder="Nhập email hoặc số điện thoại"
            size="large"
            onChange={handleIdentifierChange}
          />
        </Form.Item>

        <Form.Item
          label="Mật khẩu"
          name="password"
          rules={[
            { required: true, message: 'Vui lòng nhập mật khẩu.' },
            { min: 8, message: 'Mật khẩu tối thiểu 8 ký tự.' },
          ]}
        >
          <Input.Password prefix={<LockOutlined />} placeholder="Nhập mật khẩu" size="large" />
        </Form.Item>

        <div className="login-form-options">
          <Form.Item name="remember" valuePropName="checked" noStyle>
            <Checkbox>Ghi nhớ đăng nhập</Checkbox>
          </Form.Item>
          <button type="button" className="login-text-button" onClick={handleForgotPasswordOpen}>
            Quên mật khẩu?
          </button>
        </div>

        <Button
          type="primary"
          htmlType="submit"
          size="large"
          block
          className="login-submit"
          loading={isLoggingIn}
          disabled={isLoginLocked}
        >
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
            <span>{currentUser.email || currentUser.phone}</span>
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
      <ForgotPasswordModal
        open={isForgotPasswordOpen}
        onClose={() => setIsForgotPasswordOpen(false)}
        initialIdentifier={forgotPasswordIdentifier}
        onLoginClick={handleBackToLogin}
      />
    </>
  )
}
