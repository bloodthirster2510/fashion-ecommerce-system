import { expect, test } from '@playwright/test'
import { enterDemoAdmin } from './helpers/admin'

test('voucher wizard supports quick setup, advanced options and cost preview', async ({ page }) => {
  await enterDemoAdmin(page)
  await page.getByRole('button', { name: /^Khuyến mãi:/ }).click()
  await page.getByRole('button', { name: /Tạo voucher$/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Tạo voucher' })
  await dialog.getByRole('textbox', { name: /Mã voucher/ }).fill('CHAO_MUNG10')
  await dialog.getByLabel('Tên voucher').fill('Chào mừng khách mới')
  await expect(dialog.getByLabel('Tên voucher')).toHaveValue('Chào mừng khách mới')
  await expect(dialog.getByText('Ước tính trên đơn mẫu')).toBeVisible()
  await dialog.getByRole('button', { name: 'Hiện tùy chọn nâng cao' }).click()
  await expect(dialog.getByText('Đối tượng và phạm vi áp dụng đang hiển thị.')).toBeVisible()
  await dialog.getByRole('button', { name: 'Ẩn tùy chọn nâng cao' }).click()
  await dialog.getByRole('button', { name: 'Hiện tùy chọn nâng cao' }).click()
  await dialog.getByRole('button', { name: 'Tiếp tục' }).click()
  await expect(dialog.getByText('Thời gian hiển thị')).toBeVisible()
})

test('tier dialog validates inline and confirms discarding dirty edits', async ({ page }) => {
  await enterDemoAdmin(page)
  await page.getByRole('button', { name: /^Chương trình thành viên:/ }).click()
  await page.getByRole('button', { name: /Thêm hạng$/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Thêm hạng thành viên' })
  await dialog.locator('.admin-tier-template-row').getByRole('button', { name: 'Đồng', exact: true }).click()
  await expect(dialog.getByText('THẺ THÀNH VIÊN')).toBeVisible()
  await expect(dialog.locator('.admin-tier-card-preview strong')).toHaveText('Đồng')
  await dialog.getByLabel('Tên hạng').fill('A')
  await expect(dialog.getByText('Tên hạng cần ít nhất 2 ký tự.')).toBeVisible()
  await dialog.getByRole('button', { name: 'Hủy' }).click()
  await expect(page.getByRole('dialog', { name: 'Bỏ thay đổi chưa lưu?' })).toBeVisible()
})

test('campaign form validates fields and confirms dirty close', async ({ page }) => {
  await enterDemoAdmin(page)
  await page.getByRole('button', { name: /^Khuyến mãi:/ }).click()
  await page.getByRole('button', { name: /Tạo chiến dịch$/ }).click()
  await page.getByLabel('Mã chiến dịch').fill('x')
  await expect(page.getByText('Mã gồm 2–40 ký tự in hoa, số, “_” hoặc “-”.')).toBeVisible()
  await page.getByRole('button', { name: 'Đóng form' }).click()
  await expect(page.getByRole('dialog', { name: 'Bỏ thay đổi chưa lưu?' })).toBeVisible()
})
