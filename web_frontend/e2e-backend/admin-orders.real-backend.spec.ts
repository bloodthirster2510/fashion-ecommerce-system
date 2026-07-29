import { expect, test } from '@playwright/test'

const adminEmail = 'browser.e2e.admin@fashion.test'
const password = 'BrowserE2E123!'
const orderCode = 'FS-BROWSER-E2E'

test('admin logs in and updates a seeded order through the real API', async ({ page }) => {
  await page.goto('/admin/login')
  await page.getByLabel('Email hoặc số điện thoại').fill(adminEmail)
  await page.getByLabel('Mật khẩu').fill(password)

  const loginResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith('/api/auth/admin/login'),
  )
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  const loginResponse = await loginResponsePromise

  expect(loginResponse.status()).toBe(200)
  await expect(page).toHaveURL(/\/admin\/dashboard$/)

  await page.getByRole('button', { name: /Tra cứu đơn & hóa đơn/ }).click()
  await expect(page).toHaveURL(/\/admin\/orders\/lookup$/)
  await expect(page.getByText(orderCode)).toBeVisible()

  await page.getByRole('checkbox', { name: `Chọn đơn ${orderCode}` }).check()
  await page.getByLabel('Trạng thái đích').selectOption('packed')
  await page.getByLabel('Lý do bắt buộc').fill('Browser E2E cập nhật qua backend thật')

  const bulkResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith('/api/admin/orders/bulk-status'),
  )
  await page.getByRole('button', { name: 'Cập nhật trạng thái' }).click()
  const bulkResponse = await bulkResponsePromise
  const bulkPayload = await bulkResponse.json() as {
    data: {
      failedCount: number;
      succeededCount: number;
      results: Array<{ order?: { status?: string } }>;
    };
  }

  expect(bulkResponse.status()).toBe(200)
  expect(bulkPayload.data).toMatchObject({
    failedCount: 0,
    succeededCount: 1,
  })
  expect(bulkPayload.data.results[0]?.order?.status).toBe('packed')
  await expect(page.getByText('Cập nhật trạng thái thành công cho 1 đơn hàng.')).toBeVisible()
  await expect(page.getByRole('row').filter({ hasText: orderCode })).toContainText('Đã đóng gói')
})
