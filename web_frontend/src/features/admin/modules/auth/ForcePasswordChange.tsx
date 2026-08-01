import { useEffect, useRef, useState, type FormEvent } from 'react'
import { changeAdminPassword } from './auth.service'
import type { AdminSession } from './auth.types'
import shopNameImage from '../../../../assets/images/ShopName.png'
import './auth.css'

type ForcePasswordChangeProps = {
  session: AdminSession
  onPasswordChanged: () => void
  onLogout: () => void
}

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
  const isSubmittingRef = useRef(false)
  const operationSequenceRef = useRef(0)

  useEffect(() => () => {
    operationSequenceRef.current += 1
  }, [])

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

    if (isSubmittingRef.current) {
      return
    }

    isSubmittingRef.current = true
    const operationSequence = operationSequenceRef.current + 1
    operationSequenceRef.current = operationSequence
    setIsSubmitting(true)

    try {
      await changeAdminPassword(session.accessToken, {
          currentPassword,
          newPassword,
          confirmPassword,
      })

      if (operationSequenceRef.current === operationSequence) {
        onPasswordChanged()
      }
    } catch (error) {
      if (operationSequenceRef.current === operationSequence) {
        setErrorMessage(error instanceof Error ? error.message : 'Không thể đổi mật khẩu')
      }
    } finally {
      if (operationSequenceRef.current === operationSequence) {
        isSubmittingRef.current = false
        setIsSubmitting(false)
      }
    }
  }

  const handleLogout = () => {
    operationSequenceRef.current += 1
    isSubmittingRef.current = false
    onLogout()
  }

  return (
    <main className="admin-login-page">
      <section className="admin-login-panel" aria-label="Đổi mật khẩu bắt buộc">
        <div className="admin-login-brand">
          <span className="admin-login-logo">
            <img src={shopNameImage} alt="CD Shop" />
          </span>
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
          <button className="admin-login-secondary" type="button" onClick={handleLogout}>
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
