import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e-backend',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4175',
    channel: 'chrome',
    headless: true,
    viewport: { width: 1280, height: 800 },
  },
  webServer: [
    {
      command: 'npm --prefix ../backend run test:e2e:browser-server',
      url: 'http://127.0.0.1:5001/__e2e__/ready',
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        BROWSER_E2E_API_PORT: '5001',
      },
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 4175',
      url: 'http://127.0.0.1:4175/admin/login',
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        VITE_API_BASE_URL: 'http://127.0.0.1:5001/api',
      },
    },
  ],
})
