import { expect, test } from '@playwright/test'

const adminEmail = 'browser.e2e.admin@fashion.test'
const password = 'BrowserE2E123!'

const loginAsAdmin = async (page: import('@playwright/test').Page) => {
  await page.goto('/admin/login')
  await page.getByLabel('Email hoặc số điện thoại').fill(adminEmail)
  await page.getByLabel('Mật khẩu').fill(password)
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/dashboard$/)
}

test('customer management presents avatars and business-facing activity labels', async ({ page }) => {
  await loginAsAdmin(page)
  await page.getByRole('button', { name: /Khách hàng: Người dùng mua hàng/ }).click()
  await expect(page).toHaveURL(/\/admin\/customers$/)

  const customerRow = page.getByRole('row').filter({ hasText: 'Browser E2E Customer' })
  await expect(customerRow.locator('.admin-user-avatar img')).toBeVisible()
  await customerRow.getByRole('button', { name: 'Xem', exact: true }).click()

  const drawer = page.getByRole('dialog', { name: 'Browser E2E Customer' })
  await expect(drawer.locator('.admin-customer-avatar img')).toBeVisible()

  await drawer.getByRole('tab', { name: 'Đơn hàng', exact: true }).click()
  await expect(drawer.getByText('Thanh toán khi nhận hàng')).toBeVisible()
  await expect(drawer.getByText('Chờ xử lý', { exact: true })).toBeVisible()

  await drawer.getByRole('tab', { name: 'Ghi chú', exact: true }).click()
  await drawer.getByPlaceholder('Thông tin nội bộ chỉ dành cho nhân viên...').fill(
    'Khách ưu tiên nhận tư vấn qua email',
  )
  await drawer.getByRole('button', { name: 'Thêm ghi chú', exact: true }).click()

  const note = drawer.locator('.admin-customer-note').filter({
    hasText: 'Khách ưu tiên nhận tư vấn qua email',
  })
  await expect(note).toBeVisible()
  await expect(note.locator('.admin-customer-note__author-avatar img')).toBeVisible()
  await expect(note).toContainText('Browser E2E Admin')

  await drawer.getByRole('tab', { name: 'Quản trị', exact: true }).click()
  await drawer.getByRole('button', { name: 'Khóa tài khoản', exact: true }).click()
  await page.getByRole('dialog', { name: 'Khóa tài khoản?' })
    .getByRole('button', { name: 'Xác nhận', exact: true })
    .click()

  await drawer.getByRole('tab', { name: 'Tương tác', exact: true }).click()
  const statusActivity = drawer.locator('.admin-customer-timeline__item').filter({
    hasText: 'Đã khóa tài khoản',
  })
  await expect(statusActivity.getByText('Đã khóa tài khoản', { exact: true })).toBeVisible()
  await expect(statusActivity.getByText('Browser E2E Admin · Quản trị viên')).toBeVisible()
  await expect(statusActivity.locator('.admin-customer-activity-actor__avatar img')).toBeVisible()
  await expect(drawer).not.toContainText('customer.status_update')
  await expect(drawer).not.toContainText('customers.manage')
})
