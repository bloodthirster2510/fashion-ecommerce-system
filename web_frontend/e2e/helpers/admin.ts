import { expect, type Page } from '@playwright/test'

export const enterDemoAdmin = async (page: Page) => {
  await page.goto('/admin/login')
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await page.getByRole('button', { name: 'Xem bố cục demo' }).click()
  await expect(page).toHaveURL(/\/admin\/dashboard$/)
}
