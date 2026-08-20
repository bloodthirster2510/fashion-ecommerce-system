import { useRef, useState, type FormEvent } from 'react'
import {
  isAdminRole,
  saveAdminSession,
} from './adminSession'
import { loginAdmin } from './auth.service'
import type { AdminSession } from './auth.types'
import shopNameImage from '../../../../assets/images/ShopName.png'
import './auth.css'

type AdminLoginProps = {
  onLoginSuccess: (session: AdminSession) => void
}

export function AdminLogin({ onLoginSuccess }: AdminLoginProps) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const isSubmittingRef = useRef(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmittingRef.current) {
      return
    }

    isSubmittingRef.current = true
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
          ? 'Không kết nối được backend. Hãy chạy backend ở port 5000.'
          : error instanceof Error
            ? error.message
            : 'Không thể đăng nhập'

      setErrorMessage(
        error instanceof TypeError
          ? 'Không kết nối được backend. Hãy chạy backend ở port 5000.'
          : message,
      )
    } finally {
      isSubmittingRef.current = false
      setIsSubmitting(false)
    }
  }

  return (
    <main className="admin-login-page">
      <section className="admin-login-panel" aria-label="Đăng nhập quản trị">
        <div className="admin-login-brand">
          <span className="admin-login-logo">
            <img src={shopNameImage} alt="CD Shop" />
          </span>
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
          <a href="/admin/forgot-password">Quên mật khẩu?</a>
        </div>
      </section>

      <section className="admin-login-aside" aria-label="Thông tin vận hành">
        <div>
          <p className="admin-login-kicker">Hoạt động của cửa hàng</p>
          <h2>Dịch vụ quản lý cửa hàng, đơn hàng và chăm sóc khách hàng</h2>
        </div>
      </section>
    </main>
  )
}
