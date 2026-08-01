import { expect, test } from '@playwright/test'

test('legal policies expose the payment, return and privacy commitments on desktop and mobile', async ({ page }) => {
  await page.goto('/policies/returns')
  await expect(page.getByRole('heading', { name: 'Chính sách trả hàng và hoàn tiền' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Chi phí gửi trả' })).toBeVisible()
  await expect(page.getByText(/Đơn VNPay được yêu cầu hoàn qua VNPay về kênh thanh toán gốc/)).toBeVisible()
  await expect(page.getByText(/trong vòng 7 ngày làm việc/)).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/policies/privacy')
  await expect(page.getByRole('heading', { name: 'Chính sách bảo vệ dữ liệu cá nhân' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Thời hạn lưu giữ' })).toBeVisible()
  await expect(page.getByText(/không bán dữ liệu cá nhân/)).toBeVisible()
  await expect(page.locator('main.policy-page')).toHaveCSS('width', '362px')
})

test('admin login stays within a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/admin/login')

  await expect(page.getByRole('heading', { name: 'Đăng nhập quản trị' })).toBeVisible()
  const layout = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(layout.scrollWidth).toBe(layout.viewportWidth)
})
