import { expect, test } from '@playwright/test'
import type { StorefrontSettings } from '../../../../storefront-settings/storefrontSettings.types'
import type { AdminOrder } from '../orderAdminApi'
import {
  buildInvoicePdfDefinition,
  buildInvoicePrintHtml,
  getInvoiceDeliveryAddress,
  getInvoiceDiscountTotal,
  getInvoiceFileName,
  getInvoiceIssuedAt,
} from './invoiceDocument'

const settings: StorefrontSettings = {
  configured: true,
  identity: {
    name: 'Fashion Shop',
    legalName: 'Công ty Fashion Shop',
    taxCode: '1800000000',
    avatarUrl: '',
    tagline: '',
    description: '',
  },
  contact: {
    phone: '0900000000',
    email: 'shop@example.com',
    hours: '',
    address: '01 Đường Thời Trang, Cần Thơ',
    mapUrl: '',
  },
  socials: [],
  version: 1,
  updatedAt: '2026-08-02T00:00:00.000Z',
}

const settingsWithAvatar: StorefrontSettings = {
  ...settings,
  identity: {
    ...settings.identity,
    avatarUrl: 'https://cdn.example.com/store-logo.png?width=256&height=256',
  },
}

const makeOrder = (overrides: Partial<AdminOrder> = {}): AdminOrder => ({
  _id: 'order-1',
  orderCode: 'FS-001',
  invoiceCode: 'INV-FS-001',
  invoiceIssuedAt: '2026-08-02T08:00:00.000Z',
  user_id: 'user-1',
  order_list: [{
    _id: 'item-1',
    sku: 'SKU-001',
    name: 'Áo sơ mi',
    fitType: 'Regular',
    color: 'Trắng',
    size: 'M',
    quantity: 2,
    priceAtPurchased: 200_000,
  }],
  subTotal: 400_000,
  shippingFee: 30_000,
  couponCode: 'SALE10',
  couponDiscountAmount: 40_000,
  shippingDiscountAmount: 10_000,
  membershipDiscountAmount: 20_000,
  taxAmount: 0,
  totalAmount: 360_000,
  status: 'completed',
  paymentMethod: 'VNPAY',
  paymentStatus: 'paid',
  deliveredAt: '2026-08-02T08:00:00.000Z',
  shippingAddress: {
    customerName: 'Nguyễn An',
    phoneNumber: '0912345678',
    streetName: '10 Nguyễn Trãi',
    ward: 'An Hội',
    wardCode: '001',
    district: 'Ninh Kiều',
    province: 'Cần Thơ',
  },
  createdAt: '2026-08-01T08:00:00.000Z',
  updatedAt: '2026-08-02T08:00:00.000Z',
  ...overrides,
})

test.describe('invoice document', () => {
  test('uses the persisted issue date and falls back for legacy orders', () => {
    const order = makeOrder()
    expect(getInvoiceIssuedAt(order)).toBe('2026-08-02T08:00:00.000Z')
    expect(getInvoiceIssuedAt(makeOrder({ invoiceIssuedAt: null }))).toBe(order.deliveredAt)
    expect(getInvoiceIssuedAt(makeOrder({ invoiceIssuedAt: null, deliveredAt: null }))).toBe(order.updatedAt)
  })

  test('calculates discounts and formats delivery metadata', () => {
    const order = makeOrder()
    expect(getInvoiceDiscountTotal(order)).toBe(70_000)
    expect(getInvoiceDeliveryAddress(order)).toBe('10 Nguyễn Trãi, An Hội, Ninh Kiều, Cần Thơ')
    expect(getInvoiceFileName(order)).toBe('INV-FS-001.pdf')
  })

  test('creates a printable document and escapes customer-controlled content', () => {
    const order = makeOrder({
      orderNote: '<script>alert("xss")</script>',
      shippingAddress: {
        ...makeOrder().shippingAddress,
        customerName: '<Admin>',
      },
    })
    const html = buildInvoicePrintHtml(order, settingsWithAvatar)

    expect(html).toContain('HÓA ĐƠN BÁN HÀNG')
    expect(html).toContain('src="https://cdn.example.com/store-logo.png?width=256&amp;height=256"')
    expect(html).toContain('&lt;Admin&gt;')
    expect(html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;')
    expect(html).not.toContain('<script>alert')
    expect(html).not.toContain('#0f766e')
    expect(html).not.toContain('#b45309')
  })

  test('builds an A4 PDF definition with invoice metadata', () => {
    const avatarDataUrl = 'data:image/png;base64,c3RvcmUtbG9nbw=='
    const definition = buildInvoicePdfDefinition(makeOrder(), settingsWithAvatar, avatarDataUrl)

    expect(definition.pageSize).toBe('A4')
    expect(definition.info?.title).toBe('Hóa đơn INV-FS-001')
    expect(Array.isArray(definition.content)).toBe(true)
    expect(JSON.stringify(definition.content)).toContain(avatarDataUrl)
    expect(JSON.stringify(definition)).not.toContain('#0f766e')
    expect(JSON.stringify(definition)).not.toContain('#b45309')
  })
})
