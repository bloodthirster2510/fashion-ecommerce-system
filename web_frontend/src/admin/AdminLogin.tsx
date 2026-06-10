import { useState, type FormEvent } from 'react'
import {
  isAdminRole,
  saveAdminSession,
  type AdminSession,
  type AdminUser,
} from './adminSession'

type LoginPayload = {
  accessToken: string
  refreshToken: string
  user: AdminUser
}

type LoginResponse = {
  message?: string
  data?: LoginPayload
}

type AdminLoginProps = {
  onLoginSuccess: (session: AdminSession) => void
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  import.meta.env.VITE_API_URL ??
  'http://localhost:3000/api'

export function AdminLogin({ onLoginSuccess }: AdminLoginProps) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')
    setIsSubmitting(true)

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifier: identifier.trim(),
          password,
        }),
      })
      const result = (await response.json().catch(() => ({}))) as LoginResponse

      if (!response.ok || !result.data) {
        throw new Error(result.message || 'Không thể đăng nhập')
      }

      if (!isAdminRole(result.data.user.role)) {
        throw new Error('Tài khoản không có quyền truy cập trang quản trị')
      }

      const session: AdminSession = {
        accessToken: result.data.accessToken,
        refreshToken: result.data.refreshToken,
        user: result.data.user,
      }

      saveAdminSession(session)
      onLoginSuccess(session)
    } catch (error) {
      const message =
        error instanceof TypeError
          ? 'Không kết nối được backend. Hãy kiểm tra backend đang chạy ở port 3000.'
          : error instanceof Error
            ? error.message
            : 'Không thể đăng nhập'

      setErrorMessage(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="admin-login-page">
      <section className="admin-login-panel" aria-label="Đăng nhập quản trị">
        <div className="admin-login-brand">
          <span className="admin-login-mark" aria-hidden="true">
            F
          </span>
          <div>
            <strong>FASHIONISTA</strong>
            <span>Admin Portal</span>
          </div>
        </div>

        <div className="admin-login-heading">
          <p>Trang quản trị</p>
          <h1>Đăng nhập quản trị</h1>
        </div>

        <form className="admin-login-form" onSubmit={handleSubmit}>
          <label>
            <span>Email hoặc số điện thoại</span>
            <input
              type="text"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="admin@fashion.com"
              autoComplete="username"
              required
            />
          </label>

          <label>
            <span>Mật khẩu</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Nhập mật khẩu"
              autoComplete="current-password"
              required
            />
          </label>

          {errorMessage ? (
            <p className="admin-login-error" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <button className="admin-login-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        <div className="admin-login-footnote">
          <span>Chỉ tài khoản admin hoặc staff được truy cập.</span>
        </div>
      </section>

      <section className="admin-login-aside" aria-label="Thông tin vận hành">
        <div>
          <p className="admin-login-kicker">Fashion operations</p>
          <h2>Quản lý cửa hàng, đơn hàng và chăm sóc khách hàng trong một nơi.</h2>
        </div>
      </section>
    </main>
  )
}
