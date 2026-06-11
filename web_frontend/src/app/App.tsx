import { ConfigProvider } from 'antd'
import 'antd/dist/reset.css'
import { Router } from './router'
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
      <Router />
    </ConfigProvider>
  )
}

export default App
