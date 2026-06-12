import { useState, type FormEvent } from 'react'
import {
  isAdminRole,
  saveAdminSession,
} from './adminSession'
import { loginAdmin } from './auth.service'
import type { AdminSession } from './auth.types'
import './auth.css'

type AdminLoginProps = {
  onLoginSuccess: (session: AdminSession) => void
}

export function AdminLogin({ onLoginSuccess }: AdminLoginProps) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleDemoAccess = () => {
    const session: AdminSession = {
      accessToken: 'demo-admin-access-token',
      refreshToken: 'demo-admin-refresh-token',
      user: {
        _id: 'demo-admin',
        name: 'Quản trị viên',
        email: 'admin@fashion.com',
        role: 'admin',
      },
    }

    saveAdminSession(session)
    onLoginSuccess(session)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')
    setIsSubmitting(true)

    try {
      const session = await loginAdmin({
        identifier: identifier.trim(),
        password,
      })

      if (!isAdminRole(session.user.role)) {
        throw new Error('Tài khoản không có quyền truy cập trang quản trị')
      }

      saveAdminSession(session)
      onLoginSuccess(session)
    } catch (error) {
      const message =
        error instanceof TypeError
          ? 'Không kết nối được backend. Hãy chạy backend ở port 5000 hoặc xem bố cục demo.'
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
          <button className="admin-login-secondary" type="button" onClick={handleDemoAccess}>
            Xem bố cục demo
          </button>
        </form>

        <div className="admin-login-footnote">
          <span>Chỉ tài khoản admin hoặc staff được truy cập.</span>
          <a href="/admin/forgot-password">Quên mật khẩu?</a>
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
