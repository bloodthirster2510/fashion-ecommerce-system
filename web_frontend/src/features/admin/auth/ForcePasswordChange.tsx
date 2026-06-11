import { useState, type FormEvent } from 'react'
import type { AdminSession } from './adminSession'

type ForcePasswordChangeProps = {
  session: AdminSession
  onPasswordChanged: () => void
  onLogout: () => void
}

type ApiResponse<T> = {
  message?: string
  data?: T
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  import.meta.env.VITE_API_URL ??
  'http://localhost:3000/api'

export function ForcePasswordChange({
  session,
  onPasswordChanged,
  onLogout,
}: ForcePasswordChangeProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')

    if (newPassword.length < 8) {
      setErrorMessage('Mật khẩu mới tối thiểu 8 ký tự')
      return
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Xác nhận mật khẩu chưa khớp')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      })
      const result = (await response.json().catch(() => ({}))) as ApiResponse<null>

      if (!response.ok) {
        throw new Error(result.message || 'Không thể đổi mật khẩu')
      }

      onPasswordChanged()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể đổi mật khẩu')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="admin-login-page">
      <section className="admin-login-panel" aria-label="Đổi mật khẩu bắt buộc">
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
          <p>Tài khoản nội bộ</p>
          <h1>Đổi mật khẩu lần đầu</h1>
        </div>

        <form className="admin-login-form" onSubmit={handleSubmit}>
          <label>
            <span>Mật khẩu tạm</span>
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          <label>
            <span>Mật khẩu mới</span>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
          </label>

          <label>
            <span>Xác nhận mật khẩu mới</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
          </label>

          {errorMessage ? (
            <p className="admin-login-error" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <button className="admin-login-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Đang đổi mật khẩu...' : 'Hoàn tất'}
          </button>
          <button className="admin-login-secondary" type="button" onClick={onLogout}>
            Đăng xuất
          </button>
        </form>
      </section>

      <section className="admin-login-aside" aria-label="Bảo mật tài khoản">
        <div>
          <p className="admin-login-kicker">First sign-in</p>
          <h2>Staff phải đổi mật khẩu tạm trước khi truy cập khu vực vận hành.</h2>
        </div>
      </section>
    </main>
  )
}
