import { expect, test } from '@playwright/test'
import { enterDemoAdmin } from './helpers/admin'

test('admin notification badges summarize work and navigate from the bell panel', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await enterDemoAdmin(page)

  await expect(page.getByRole('button', { name: /^Vận hành đơn hàng:/ }).locator('.admin-nav-notification-badge')).toHaveText('6')
  await expect(page.getByRole('button', { name: /^Kho hàng:/ }).locator('.admin-nav-notification-badge')).toBeVisible()
  await expect(page.getByRole('button', { name: /^Đánh giá:/ }).locator('.admin-nav-notification-badge')).toHaveText('1')

  await page.getByRole('button', { name: '14 việc cần chú ý' }).click()
  const panel = page.getByRole('region', { name: 'Việc cần chú ý' })
  await expect(panel).toBeVisible()
  await expect(panel.getByText('Voucher sắp hết hạn')).toBeVisible()
  await expect(panel.getByText('Đánh giá chờ duyệt')).toBeVisible()

  await panel.getByRole('button', { name: /Đơn mới chờ đóng gói/ }).click()
  await expect(page).toHaveURL(/\/admin\/orders\?queue=packing$/)
  await expect(page.getByRole('tab', { name: /Cần đóng gói/ })).toHaveClass(/is-active/)

  await page.getByRole('button', { name: '14 việc cần chú ý' }).click()

  await panel.getByRole('button', { name: /Tồn kho thấp/ }).click()
  await expect(page).toHaveURL(/\/admin\/inventory$/)
  await expect(panel).toBeHidden()

  await page.getByRole('button', { name: '14 việc cần chú ý' }).click()
  await panel.getByRole('button', { name: /Đánh giá chờ duyệt/ }).click()
  await expect(page).toHaveURL(/\/admin\/reviews$/)
  await expect(panel).toBeHidden()
})
