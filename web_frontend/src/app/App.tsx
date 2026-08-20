import { ConfigProvider } from 'antd'
import 'antd/dist/reset.css'
import { Suspense } from 'react'
import { Router } from './router'
import { StorefrontSettingsProvider } from '../features/storefront-settings/StorefrontSettingsProvider'
import './App.css'

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
      <Suspense fallback={null}>
        <StorefrontSettingsProvider>
          <Router />
        </StorefrontSettingsProvider>
      </Suspense>
    </ConfigProvider>
  )
}

export default App
