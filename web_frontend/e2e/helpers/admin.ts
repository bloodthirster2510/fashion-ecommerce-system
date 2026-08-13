import { expect, type Page } from '@playwright/test'

export const enterDemoAdmin = async (page: Page) => {
  await page.route('**/api/auth/admin/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          accessToken: 'demo-admin-access-token',
          user: {
            _id: '665000000000000000000001',
            name: 'Demo Admin',
            email: 'demo-admin@example.com',
            role: 'admin',
            permissions: [],
            mustChangePassword: false,
          },
        },
      }),
    })
  })
  await page.goto('/admin/login')
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await page.locator('input[type="text"]').fill('demo-admin@example.com')
  await page.locator('input[type="password"]').fill('DemoPassword!123')
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL(/\/admin\/dashboard$/)
}
