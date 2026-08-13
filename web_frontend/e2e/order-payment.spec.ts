import { expect, test } from '@playwright/test'
import {
  getVNPayReconcileNotice,
  getVNPayRefundNotice,
} from '../src/features/admin/modules/orders/utils/vnpayReconcile'
import type { AdminOrder } from '../src/features/admin/modules/orders/orderAdminApi'
import {
  canCreateGhnShipment,
  resolveInitialTabKey,
} from '../src/features/admin/modules/orders/orderPresentation'
import { getOrderQueue } from '../src/features/admin/modules/orders/utils/orderQueue'

const pendingVNPayOrder = {
  status: 'confirmed',
  paymentMethod: 'VNPAY',
  paymentStatus: 'pending',
} as AdminOrder

test('pending VNPay orders stay visible in the payment queue', () => {
  expect(getOrderQueue(pendingVNPayOrder)).toBe('blocked')
})

test('online order operations open the payment queue by default', () => {
  expect(resolveInitialTabKey(undefined, true, 'online')).toBe('blocked')
})

test('fallback shipping orders are routed to the GHN mapping queue', () => {
  const fallbackOrder = {
    status: 'packed',
    paymentMethod: 'COD',
    paymentStatus: 'pending',
    shipping: {
      provider: 'FIXED',
      status: 'fallback',
      comparisonStatus: 'fallback',
    },
    shippingAddress: {
      ghnMappingStatus: 'missing',
    },
  } as AdminOrder

  expect(getOrderQueue(fallbackOrder)).toBe('shipping-mapping')
  expect(canCreateGhnShipment(fallbackOrder)).toBe(false)
})

test('GHN shipment action unlocks only after the address mapping is verified', () => {
  const mappedOrder = {
    status: 'packed',
    paymentMethod: 'COD',
    paymentStatus: 'pending',
    shipping: {
      provider: 'FIXED',
      status: 'mapping_resolved',
      trackingCode: null,
    },
    shippingAddress: {
      ghnProvinceId: 204,
      ghnDistrictId: 1452,
      ghnWardCode: '480101',
      ghnMappingStatus: 'mapped',
      ghnMappingConfidence: 'manual',
      ghnMappingVerifiedAt: '2026-07-29T00:00:00.000Z',
      ghnMappingVerificationSource: 'admin',
    },
  } as AdminOrder

  expect(getOrderQueue(mappedOrder)).toBe('handoff')
  expect(canCreateGhnShipment(mappedOrder)).toBe(true)
})

test('VNPay refund request stays a warning while the gateway is processing it', () => {
  expect(getVNPayRefundNotice('pending')).toEqual({
    type: 'warning',
    message: 'Yêu cầu hoàn tiền đã gửi VNPay, đang chờ đối soát',
  })
})

test('VNPay reconciliation keeps a pending refund visibly unresolved', () => {
  const notice = getVNPayReconcileNotice({
    gateway: {
      vnp_TransactionStatus: '00',
      vnp_TransactionType: '01',
    },
    reconciliationStatus: 'pending_refund',
  })

  expect(notice).toEqual({
    type: 'warning',
    message: 'Thanh toán gốc đã thành công; yêu cầu hoàn tiền vẫn đang chờ VNPay xử lý. Đơn chưa được chuyển sang đã hoàn tiền.',
  })
})

test('VNPay reconciliation confirms a completed full refund explicitly', () => {
  const notice = getVNPayReconcileNotice({
    gateway: {
      vnp_TransactionStatus: '00',
      vnp_TransactionType: '02',
    },
    reconciliationStatus: 'refunded',
  })

  expect(notice).toEqual({
    type: 'success',
    message: 'VNPay đã xác nhận hoàn tiền toàn phần và đơn đã được cập nhật.',
  })
})

test('customer can retry a failed VNPay payment from the web order detail', async ({ page }) => {
  const orderId = '665000000000000000000931'
  const orderCode = 'FS-VNPAY-RETRY-E2E'
  let createPaymentPayload: Record<string, unknown> | null = null

  await page.addInitScript(() => {
    window.localStorage.setItem('currentUser', JSON.stringify({
      _id: '665000000000000000000932',
      name: 'Khách kiểm thử',
      email: 'customer-retry@fashion.test',
      phone: '0900000000',
      role: 'user',
    }))
  })

  await page.route('http://localhost:5000/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const responseHeaders = {
      'access-control-allow-origin': 'http://127.0.0.1:4174',
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers': 'Authorization, Content-Type, X-Refresh-Token-Mode',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'content-type': 'application/json',
    }

    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: responseHeaders })
      return
    }

    if (url.pathname === '/api/auth/refresh-token') {
      await route.fulfill({
        status: 200,
        headers: responseHeaders,
        body: JSON.stringify({
          data: {
            accessToken: 'customer-retry-access-token',
            user: {
              _id: '665000000000000000000932',
              name: 'Khách kiểm thử',
              email: 'customer-retry@fashion.test',
              phone: '0900000000',
              role: 'user',
            },
          },
        }),
      })
      return
    }

    if (url.pathname === `/api/orders/${orderId}`) {
      await route.fulfill({
        status: 200,
        headers: responseHeaders,
        body: JSON.stringify({
          data: {
            _id: orderId,
            orderCode,
            invoiceCode: 'INV-VNPAY-RETRY-E2E',
            order_list: [{
              _id: '665000000000000000000933',
              productId: '665000000000000000000934',
              variantId: '665000000000000000000935',
              size: 'M',
              sku: 'SKU-VNPAY-RETRY',
              name: 'Áo kiểm thử thanh toán lại',
              fitType: 'regular',
              color: 'Đen',
              image: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/%3E',
              quantity: 1,
              priceAtPurchased: 385000,
            }],
            subTotal: 385000,
            shippingFee: 0,
            couponDiscountAmount: 0,
            shippingDiscountAmount: 0,
            membershipDiscountAmount: 0,
            taxAmount: 0,
            totalAmount: 385000,
            status: 'confirmed',
            paymentMethod: 'VNPAY',
            paymentStatus: 'failed',
            paymentDeadlineAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            shipping: { provider: null, status: 'pending', trackingCode: null },
            shippingAddress: {
              customerName: 'Khách kiểm thử',
              province: 'Hồ Chí Minh',
              district: 'Quận 1',
              ward: 'Bến Nghé',
              streetName: '1 Đồng Khởi',
              phoneNumber: '0900000000',
            },
            createdAt: '2026-08-01T00:00:00.000Z',
            updatedAt: '2026-08-01T00:05:00.000Z',
          },
        }),
      })
      return
    }

    if (url.pathname === `/api/payments/orders/${orderId}/status`) {
      await route.fulfill({
        status: 200,
        headers: responseHeaders,
        body: JSON.stringify({
          data: {
            orderId,
            orderCode,
            paymentMethod: 'VNPAY',
            paymentStatus: 'failed',
            canPayNow: true,
            latestTransaction: {
              id: '665000000000000000000936',
              status: 'failed',
              failureReason: 'VNPay response 24',
            },
          },
        }),
      })
      return
    }

    if (url.pathname === `/api/payments/vnpay/orders/${orderId}/create-payment-url`) {
      createPaymentPayload = request.postDataJSON() as Record<string, unknown>
      await route.fulfill({
        status: 200,
        headers: responseHeaders,
        body: JSON.stringify({
          data: { paymentUrl: 'http://127.0.0.1:4174/mock-vnpay-checkout' },
        }),
      })
      return
    }

    if (url.pathname === '/api/cart') {
      await route.fulfill({
        status: 200,
        headers: responseHeaders,
        body: JSON.stringify({
          data: {
            product_list: [],
            summary: { itemCount: 0, selectedItemCount: 0, subTotal: 0 },
          },
        }),
      })
      return
    }

    await route.continue()
  })

  await page.goto(`/orders/${orderId}`)
  await expect(page.getByText('Giao dịch trước chưa thành công')).toBeVisible()
  await expect(page.getByText('VNPay response 24')).toBeVisible()
  await page.getByRole('button', { name: 'Thanh toán lại' }).click()

  await expect.poll(() => createPaymentPayload).toEqual({ locale: 'vn' })
  await expect(page).toHaveURL(/\/mock-vnpay-checkout$/)
})
