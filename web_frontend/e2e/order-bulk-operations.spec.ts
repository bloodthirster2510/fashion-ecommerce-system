import { expect, test } from '@playwright/test'
import { enterDemoAdmin, installDemoAdminAuth } from './helpers/admin'

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

const refundOrder = {
  ...order,
  _id: '665000000000000000000911',
  orderCode: 'FS-VNPAY-STAFF-E2E',
  invoiceCode: 'INV-VNPAY-STAFF-E2E',
  status: 'cancelled',
  paymentMethod: 'VNPAY',
  paymentStatus: 'paid',
  cancellation: {
    kind: 'customer',
    reason: 'Khách đổi ý',
    cancelledAt: '2026-07-29T03:00:00.000Z',
    actorRole: 'user',
  },
}

const pendingRefundTransaction = {
  _id: '665000000000000000000912',
  order_id: refundOrder._id,
  user_id: refundOrder.user_id,
  amount: refundOrder.totalAmount,
  paymentMethod: 'VNPAY',
  txnRef: 'FS-VNPAY-STAFF-E2E-R1',
  attemptNo: 1,
  gatewayProvider: 'VNPAY',
  paymentDetail: { vnp_Command: 'refund', refundStatus: 'pending' },
  status: 'pending',
  createdAt: '2026-07-29T03:10:00.000Z',
  updatedAt: '2026-07-29T03:10:00.000Z',
}

const codRefundOrder = {
  ...refundOrder,
  _id: '665000000000000000000921',
  orderCode: 'FS-COD-REFUND-E2E',
  invoiceCode: 'INV-COD-REFUND-E2E',
  paymentMethod: 'COD',
}

const refundBankAccount = {
  _id: '665000000000000000000922',
  user_id: codRefundOrder.user_id,
  type: 'BANK',
  provider: 'NCB',
  displayName: 'NCB •••• 4321',
  maskedInfo: '•••• 4321',
  bankCode: 'NCB',
  bankName: 'Ngân hàng TMCP Quốc Dân',
  hasStoredAccountNumber: true,
  status: 'pending',
  isDefault: false,
  metadata: {
    accountHolder: 'NGUYEN VAN A',
    refundDestination: true,
  },
  createdAt: '2026-07-29T03:00:00.000Z',
  updatedAt: '2026-07-29T03:00:00.000Z',
}

test('admin selects orders, performs a bulk status update, exports Excel, and opens labels', async ({ page }) => {
  let bulkPayload: Record<string, unknown> | null = null

  await page.route('**/api/admin/orders**', async (route) => {
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

    if (url.pathname.endsWith('/export.xlsx')) {
      await route.fulfill({
        status: 200,
        headers: {
          ...corsHeaders,
          'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'content-disposition': 'attachment; filename="orders-e2e.xlsx"',
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
  await expect(page.getByLabel('Bước tiếp theo')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Lưu view' })).toHaveCount(0)

  await page.getByRole('checkbox', { name: `Chọn đơn ${order.orderCode}` }).check()
  await expect(page.getByText('Thao tác với 1 đơn đã chọn')).toBeVisible()
  await page.getByLabel('Bước tiếp theo').selectOption('packed')
  await page.getByLabel('Lý do bắt buộc').fill('Bàn giao ca kiểm thử')
  await page.getByRole('button', { name: 'Cập nhật bước tiếp theo' }).click()

  await expect.poll(() => bulkPayload).toEqual({
    orderIds: [order._id],
    status: 'packed',
    reason: 'Bàn giao ca kiểm thử',
  })
  await expect(page.getByText('Cập nhật trạng thái thành công cho 1 đơn hàng.')).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Xuất Excel' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('orders-e2e.xlsx')

  await page.getByRole('checkbox', { name: `Chọn đơn ${order.orderCode}` }).check()
  const popupPromise = page.waitForEvent('popup')
  await page.getByRole('button', { name: 'Mở/In nhãn (1)' }).click()
  const popup = await popupPromise
  await expect(popup).toHaveURL(/\/label\.pdf$/)
  await popup.close()
})

test('staff without payments.adjust can inspect but cannot reconcile or refund VNPay', async ({ page }) => {
  let protectedPaymentRequestCount = 0
  await installDemoAdminAuth(page, {
    _id: 'demo-staff-orders',
    name: 'Nhân viên vận hành',
    email: 'staff-orders@fashion.test',
    role: 'staff',
    permissions: ['orders.read', 'orders.update', 'customers.read'],
    mustChangePassword: false,
  })

  await page.route('**/api/admin/audit-logs**', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({
        data: {
          items: [],
          pagination: { page: 1, limit: 20, totalItems: 0, totalPages: 0 },
        },
      }),
    })
  })

  await page.route('**/api/admin/orders**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())

    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders })
      return
    }

    if (request.method() !== 'GET') {
      protectedPaymentRequestCount += 1
      await route.fulfill({
        status: 403,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
        body: JSON.stringify({ message: 'Forbidden' }),
      })
      return
    }

    if (url.pathname.endsWith(`/${refundOrder._id}/transactions`)) {
      await route.fulfill({
        status: 200,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
        body: JSON.stringify({ data: [pendingRefundTransaction] }),
      })
      return
    }

    if (url.pathname.endsWith(`/${refundOrder._id}`)) {
      await route.fulfill({
        status: 200,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
        body: JSON.stringify({ data: refundOrder }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({
        data: {
          items: [refundOrder],
          statusSummary: { all: 1, cancelled: 1 },
          operationalSummary: { refunds: 1, totalPriority: 1 },
          pagination: { page: 1, limit: 10, totalItems: 1, totalPages: 1 },
        },
      }),
    })
  })

  await page.goto('/admin/login')
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await page.getByLabel('Email hoặc số điện thoại').fill('staff-orders@fashion.test')
  await page.getByLabel('Mật khẩu').fill('StaffOnly123!')
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/dashboard$/)

  await page.getByRole('button', { name: /Tra cứu đơn & hóa đơn/ }).click()
  await expect(page.getByText(refundOrder.orderCode)).toBeVisible()
  await page.getByRole('button', { name: 'Chi tiết' }).click()

  const returnReconcileButton = page.getByRole('button', { name: 'Đối soát trạng thái với VNPay' })
  await expect(returnReconcileButton).toBeDisabled()
  await expect(page.getByText('Cần quyền payments.adjust để hoàn tiền.')).toBeVisible()

  await page.getByRole('button', { name: 'Thanh toán & xử lý' }).click()
  await expect(page.getByRole('button', { name: 'Đối soát VNPay' })).toBeDisabled()
  await expect(page.getByText('Cần quyền payments.adjust để điều chỉnh thanh toán.')).toBeVisible()
  expect(protectedPaymentRequestCount).toBe(0)
})

test('admin verifies a refund account and records a manual COD refund with an audit reason', async ({ page }) => {
  let refundAccountVerified = false
  let manualRefundCompleted = false
  let paymentMethodPayload: Record<string, unknown> | null = null
  let paymentStatusPayload: Record<string, unknown> | null = null

  await page.route('**/api/admin/orders**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())

    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders })
      return
    }

    const currentOrder = {
      ...codRefundOrder,
      paymentStatus: manualRefundCompleted ? 'refunded' : 'paid',
    }

    if (url.pathname.endsWith(`/${codRefundOrder._id}/transactions`)) {
      await route.fulfill({
        status: 200,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
        body: JSON.stringify({ data: [] }),
      })
      return
    }

    if (url.pathname.endsWith(`/${codRefundOrder._id}`)) {
      await route.fulfill({
        status: 200,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
        body: JSON.stringify({ data: currentOrder }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({
        data: {
          items: [currentOrder],
          statusSummary: { all: 1, cancelled: 1 },
          operationalSummary: { refunds: manualRefundCompleted ? 0 : 1, totalPriority: manualRefundCompleted ? 0 : 1 },
          pagination: { page: 1, limit: 10, totalItems: 1, totalPages: 1 },
        },
      }),
    })
  })

  await page.route(`**/api/admin/users/${codRefundOrder.user_id}/payment-methods`, async (route) => {
    await route.fulfill({
      status: 200,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({
        data: [{ ...refundBankAccount, status: refundAccountVerified ? 'verified' : 'pending' }],
      }),
    })
  })

  await page.route('**/api/admin/payment-methods/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())

    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders })
      return
    }

    if (url.pathname.endsWith('/status')) {
      paymentMethodPayload = request.postDataJSON() as Record<string, unknown>
      refundAccountVerified = true
      await route.fulfill({
        status: 200,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
        body: JSON.stringify({ data: { ...refundBankAccount, status: 'verified' } }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({
        data: {
          paymentMethodId: refundBankAccount._id,
          accountNumber: '9704198526191432198',
        },
      }),
    })
  })

  await page.route(`**/api/admin/payments/orders/${codRefundOrder._id}/payment-status`, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders })
      return
    }

    paymentStatusPayload = route.request().postDataJSON() as Record<string, unknown>
    manualRefundCompleted = true
    await route.fulfill({
      status: 200,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({
        data: { ...codRefundOrder, paymentStatus: 'refunded' },
      }),
    })
  })

  await page.route('**/api/admin/audit-logs**', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({
        data: {
          items: manualRefundCompleted ? [{
            _id: '665000000000000000000923',
            actorId: 'demo-admin',
            actorRole: 'admin',
            action: 'payment.adjust',
            targetType: 'Order',
            targetId: codRefundOrder._id,
            reason: 'Đã chuyển khoản hoàn COD theo sao kê',
            createdAt: '2026-07-29T04:00:00.000Z',
          }] : [],
          pagination: { page: 1, limit: 20, totalItems: manualRefundCompleted ? 1 : 0, totalPages: manualRefundCompleted ? 1 : 0 },
        },
      }),
    })
  })

  await enterDemoAdmin(page)
  await page.getByRole('button', { name: /Tra cứu đơn & hóa đơn/ }).click()
  await expect(page.getByText(codRefundOrder.orderCode)).toBeVisible()
  await page.getByRole('button', { name: 'Chi tiết' }).click()

  await expect(page.getByText('Hoàn tiền thủ công')).toBeVisible()
  await expect(page.getByText('•••• 4321', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Xác minh' }).click()
  let actionDialog = page.getByRole('dialog').last()
  await actionDialog.locator('textarea').fill('Đã đối chiếu đúng thông tin ngân hàng')
  await actionDialog.getByRole('button', { name: 'Cập nhật tài khoản hoàn tiền' }).click()
  await expect(page.getByText('Sẵn sàng')).toBeVisible()

  await page.getByRole('button', { name: 'Hiện số TK' }).click()
  await expect(page.getByText('9704198526191432198')).toBeVisible()

  await page.getByRole('button', { name: 'Thanh toán & xử lý' }).click()
  await page.getByRole('button', { name: 'Đã hoàn tiền' }).click()
  actionDialog = page.getByRole('dialog').last()
  await actionDialog.locator('textarea').fill('Đã chuyển khoản hoàn COD theo sao kê')
  await actionDialog.getByRole('button', { name: 'Xác nhận đã hoàn' }).click()

  await expect(page.getByText('Đã điều chỉnh trạng thái thanh toán')).toBeVisible()
  await expect.poll(() => paymentMethodPayload).toEqual({
    status: 'verified',
    reason: 'Đã đối chiếu đúng thông tin ngân hàng',
  })
  await expect.poll(() => paymentStatusPayload).toEqual({
    paymentStatus: 'refunded',
    reason: 'Đã chuyển khoản hoàn COD theo sao kê',
  })

  await page.getByRole('button', { name: 'Nhật ký' }).click()
  await expect(page.getByText('Điều chỉnh thanh toán')).toBeVisible()
  await expect(page.getByText('Đã chuyển khoản hoàn COD theo sao kê')).toBeVisible()
})
