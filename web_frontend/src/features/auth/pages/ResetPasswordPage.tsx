import { MainLayout } from '../../../layouts/MainLayout'
import { ForgotPasswordForm } from '../components/ForgotPasswordModal'
import '../auth.css'

const getResetParams = () => {
  const params = new URLSearchParams(window.location.search)
  return {
    identifier: params.get('identifier')?.trim() ?? '',
    token: params.get('token')?.trim() ?? '',
  }
}

export function ResetPasswordPage() {
  const { identifier, token } = getResetParams()

  const goHome = () => {
    window.history.pushState({}, '', '/')
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  return (
    <MainLayout>
      <main className="reset-password-page">
        <section className="reset-password-panel" aria-label="Khôi phục mật khẩu">
          <ForgotPasswordForm
            initialIdentifier={identifier}
            initialToken={token}
            onLoginClick={goHome}
          />
        </section>
      </main>
    </MainLayout>
  )
}
