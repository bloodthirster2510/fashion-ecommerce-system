import { expect, test } from '@playwright/test'
import type { AdminOrder, AdminOrderStatus } from './orderAdminApi'
import {
  getNoNextOrderStepMessage,
  getOrderDisplayStatus,
  getShippingUpdateDialogValues,
  getStatusActionLabel,
} from './orderPresentation'

const makeOrder = (overrides: Partial<AdminOrder> = {}): AdminOrder => ({
  _id: 'order-1',
  orderCode: 'ORD-001',
  user_id: 'user-1',
  order_list: [],
  subTotal: 100_000,
  shippingFee: 30_000,
  couponDiscountAmount: 0,
  shippingDiscountAmount: 0,
  membershipDiscountAmount: 0,
  taxAmount: 0,
  totalAmount: 130_000,
  status: 'confirmed',
  paymentMethod: 'COD',
  paymentStatus: 'pending',
  shippingAddress: {
    customerName: 'Nguyễn An',
    province: 'TP. Hồ Chí Minh',
    ward: 'Bến Nghé',
    wardCode: 'ward-1',
    streetName: '1 Đồng Khởi',
    phoneNumber: '0912345678',
  },
  createdAt: '2026-07-29T00:00:00.000Z',
  updatedAt: '2026-07-29T00:00:00.000Z',
  ...overrides,
})

test.describe('admin order presentation', () => {
  test('maps workflow actions and falls back to the status label', () => {
    const expected = new Map<AdminOrderStatus, string>([
      ['packed', 'Đóng gói xong'],
      ['shipping', 'Bàn giao vận chuyển'],
      ['delivered', 'Xác nhận giao thành công'],
      ['completed', 'Khách đã nhận hàng'],
      ['cancelled', 'Hủy đơn'],
      ['returned', 'Xác nhận đã nhận hàng trả'],
      ['confirmed', 'Chờ xử lý'],
    ])

    for (const [status, label] of expected) {
      expect(getStatusActionLabel(status)).toBe(label)
    }
  })

  test('explains terminal workflow branches', () => {
    expect(getNoNextOrderStepMessage(makeOrder({ status: 'shipping' }))).toContain('Đơn đang giao')
    expect(getNoNextOrderStepMessage(makeOrder({ status: 'delivered' }))).toContain('7 ngày')
    expect(getNoNextOrderStepMessage(makeOrder({ status: 'completed' }))).toContain('đã xác nhận')
    expect(getNoNextOrderStepMessage(makeOrder({ status: 'return_approved' }))).toContain('hàng trả')
    expect(getNoNextOrderStepMessage(makeOrder({ status: 'cancelled' }))).toContain('không có bước')
  })

  test('surfaces a rejected return ahead of the base order status', () => {
    const rejected = makeOrder({
      status: 'delivered',
      returnRequest: {
        reason: 'Không vừa',
        status: 'rejected',
        requestedAt: '2026-07-28T00:00:00.000Z',
      },
    })

    expect(getOrderDisplayStatus(rejected)).toEqual({
      className: 'admin-status-pill is-blocked',
      label: 'Trả hàng bị từ chối',
    })
    expect(getOrderDisplayStatus(makeOrder({ status: 'shipping' }))).toEqual({
      className: 'admin-status-pill is-info',
      label: 'Đang giao',
    })
  })

  test('normalizes shipping form defaults and numeric costs', () => {
    expect(getShippingUpdateDialogValues(makeOrder())).toEqual({
      provider: 'GHN',
      trackingCode: '',
      labelUrl: '',
      status: 'created',
      actualProviderCost: '',
      reason: '',
    })
    expect(
      getShippingUpdateDialogValues(
        makeOrder({
          shipping: {
            provider: 'GHN',
            trackingCode: 'GHN-123',
            labelUrl: 'https://example.test/label',
            status: 'shipping',
            actualProviderCost: 25_000,
          },
        }),
      ),
    ).toMatchObject({
      trackingCode: 'GHN-123',
      status: 'shipping',
      actualProviderCost: '25000',
    })
  })
})
