import { expect, test } from '@playwright/test'
import { enterDemoAdmin } from './helpers/admin'

const order = {
  _id: '665000000000000000000901',
  orderCode: 'FS-BULK-E2E',
  invoiceCode: 'INV-BULK-E2E',
  user_id: '665000000000000000000902',
  order_list: [{
    _id: '665000000000000000000903',
    sku: 'SKU-BULK-E2E',
    name: 'Áo sơ mi kiểm thử',
    fitType: 'regular',
    color: 'Trắng',
    size: 'M',
    quantity: 1,
    priceAtPurchased: 250000,
  }],
  subTotal: 250000,
  shippingFee: 30000,
  couponDiscountAmount: 0,
  shippingDiscountAmount: 0,
  membershipDiscountAmount: 0,
  taxAmount: 0,
  totalAmount: 280000,
  status: 'confirmed',
  paymentMethod: 'COD',
  paymentStatus: 'pending',
  shipping: {
    provider: 'GHN',
    status: 'ready',
    trackingCode: 'GHN-BULK-E2E',
    labelUrl: 'http://127.0.0.1:4174/label.pdf',
  },
  shippingAddress: {
    customerName: 'Khách kiểm thử',
    province: 'Hồ Chí Minh',
    district: 'Quận 1',
    ward: 'Bến Nghé',
    wardCode: '26734',
    streetName: '1 Đồng Khởi',
    phoneNumber: '0900000000',
  },
  createdAt: '2026-07-29T02:00:00.000Z',
  updatedAt: '2026-07-29T02:00:00.000Z',
}

const corsHeaders = {
  'access-control-allow-origin': 'http://127.0.0.1:4174',
  'access-control-allow-credentials': 'true',
  'access-control-allow-headers': 'Authorization, Content-Type',
  'access-control-allow-methods': 'GET, PATCH, POST, OPTIONS',
  'access-control-expose-headers': 'Content-Disposition, X-Export-Total, X-Export-Truncated',
}

test('admin selects orders, performs a bulk status update, exports CSV, and opens labels', async ({ page }) => {
  let bulkPayload: Record<string, unknown> | null = null

  await page.route('http://localhost:5000/api/admin/orders**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())

    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders })
      return
    }

    if (url.pathname.endsWith('/bulk-status')) {
      bulkPayload = request.postDataJSON() as Record<string, unknown>
      await route.fulfill({
        status: 200,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
        body: JSON.stringify({
          data: {
            batchId: 'batch-e2e',
            requestedCount: 1,
            succeededCount: 1,
            failedCount: 0,
            results: [{
              orderId: order._id,
              success: true,
              order: { ...order, status: 'packed' },
            }],
          },
        }),
      })
      return
    }

    if (url.pathname.endsWith('/export.csv')) {
      await route.fulfill({
        status: 200,
        headers: {
          ...corsHeaders,
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': 'attachment; filename="orders-e2e.csv"',
          'x-export-total': '1',
          'x-export-truncated': 'false',
        },
        body: `\uFEFF"Mã đơn"\r\n"${order.orderCode}"`,
      })
      return
    }

    await route.fulfill({
      status: 200,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({
        data: {
          items: [order],
          statusSummary: { all: 1, confirmed: 1 },
          operationalSummary: { totalPriority: 1 },
          pagination: { page: 1, limit: 10, totalItems: 1, totalPages: 1 },
        },
      }),
    })
  })

  await enterDemoAdmin(page)
  await page.getByRole('button', { name: /Tra cứu đơn & hóa đơn/ }).click()
  await expect(page.getByText(order.orderCode)).toBeVisible()

  await page.getByRole('checkbox', { name: `Chọn đơn ${order.orderCode}` }).check()
  await page.getByLabel('Trạng thái đích').selectOption('packed')
  await page.getByLabel('Lý do bắt buộc').fill('Bàn giao ca kiểm thử')
  await page.getByRole('button', { name: 'Cập nhật trạng thái' }).click()

  await expect.poll(() => bulkPayload).toEqual({
    orderIds: [order._id],
    status: 'packed',
    reason: 'Bàn giao ca kiểm thử',
  })
  await expect(page.getByText('Cập nhật trạng thái thành công cho 1 đơn hàng.')).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Xuất CSV theo bộ lọc' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('orders-e2e.csv')

  await page.getByRole('checkbox', { name: `Chọn đơn ${order.orderCode}` }).check()
  const popupPromise = page.waitForEvent('popup')
  await page.getByRole('button', { name: 'Mở/In nhãn (1)' }).click()
  const popup = await popupPromise
  await expect(popup).toHaveURL(/\/label\.pdf$/)
  await popup.close()
})
