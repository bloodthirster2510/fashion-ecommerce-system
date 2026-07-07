import { ConfigProvider } from 'antd'
import 'antd/dist/reset.css'
import { Suspense } from 'react'
import { Router } from './router'
import './App.css'

const appLoadingFallback = (
  <main className="app-route-loading" role="status">
    Đang tải màn hình...
  </main>
)

function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#355872',
          borderRadius: 4,
          fontFamily: "var(--font-sans), system-ui, -apple-system, 'Segoe UI', sans-serif",
        },
      }}
    >
      <Suspense fallback={appLoadingFallback}>
        <Router />
      </Suspense>
    </ConfigProvider>
  )
}

export default App
