import { expect, type Page } from '@playwright/test'

export type DemoAdminUser = {
  _id: string
  name: string
  email: string
  role: 'admin' | 'staff'
  permissions: string[]
  mustChangePassword: boolean
}

const defaultDemoAdmin: DemoAdminUser = {
  _id: '665000000000000000000001',
  name: 'Quản trị viên demo',
  email: 'demo-admin@example.com',
  role: 'admin',
  permissions: [],
  mustChangePassword: false,
}

export const installDemoAdminAuth = async (page: Page, user: DemoAdminUser = defaultDemoAdmin) => {
  await page.route('**/api/auth/admin/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          accessToken: 'demo-admin-access-token',
          user,
        },
      }),
    })
  })

  await page.route('**/api/auth/admin/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: user }),
    })
  })

  await page.route('**/api/auth/refresh-token', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { accessToken: 'demo-admin-access-token', user } }),
    })
  })
}

export const enterDemoAdmin = async (page: Page, user: DemoAdminUser = defaultDemoAdmin) => {
  await installDemoAdminAuth(page, user)
  await page.goto('/admin/login')
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await page.locator('input[type="text"]').fill(user.email)
  await page.locator('input[type="password"]').fill('DemoPassword!123')
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL(/\/admin\/dashboard$/)
}
