import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import './index.css'
import App from './app/App'
import { store } from './app/store'

class RootErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    console.error('Unhandled React error', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="root-error-page" role="alert">
          <section>
            <h1>Không thể hiển thị màn hình</h1>
            <p>Vui lòng tải lại trang để khôi phục phiên làm việc.</p>
            <button type="button" onClick={() => window.location.reload()}>
              Tải lại
            </button>
          </section>
        </main>
      )
    }

    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <RootErrorBoundary>
        <App />
      </RootErrorBoundary>
    </Provider>
  </StrictMode>,
)
