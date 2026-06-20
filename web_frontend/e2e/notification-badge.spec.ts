import { expect, test } from '@playwright/test'

test('admin notification badges summarize work and navigate from the bell panel', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/admin/login')
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await page.getByRole('button', { name: 'Xem bố cục demo' }).click()
  await expect(page).toHaveURL(/\/admin\/orders$/)

  await expect(page.getByRole('button', { name: /Hóa đơn & đơn hàng.*6 đơn cần xử lý/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Kho hàng.*4 biến thể tồn kho thấp/ })).toBeVisible()

  await page.getByRole('button', { name: '12 việc cần chú ý' }).click()
  const panel = page.getByRole('region', { name: 'Việc cần chú ý' })
  await expect(panel).toBeVisible()
  await expect(panel.getByText('Voucher sắp hết hạn')).toBeVisible()

  await panel.getByRole('button', { name: /Tồn kho thấp/ }).click()
  await expect(page).toHaveURL(/\/admin\/inventory$/)
  await expect(panel).toBeHidden()
})
