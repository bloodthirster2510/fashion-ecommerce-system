import { expect, test } from '@playwright/test'
import type { ManagedProduct } from './product.types'
import {
  getInventory,
  getInventoryStatus,
  getStockMeta,
  lowStockThreshold,
} from './productDisplay.helpers'

const product: ManagedProduct = {
  _id: 'product-1',
  name: 'Áo polo',
  productImage: 'https://example.test/product.png',
  isActive: true,
  soldQuantity: 0,
  brandName: 'Fashion Shop',
  categoryName: 'Áo polo',
  canDeletePermanently: true,
  variants: [
    {
      _id: 'variant-1',
      fitTypeId: 'regular',
      fitTypeLabel: 'Regular',
      price: 100_000,
      discount: 0,
      isActive: true,
      colors: [
        {
          _id: 'black',
          color: 'Đen',
          image: 'https://example.test/black.png',
          inventory: [
            { size: 'S', sku: 'BLACK-S', availableQuantity: 0 },
            { size: 'M', sku: 'BLACK-M', availableQuantity: lowStockThreshold },
            { size: 'L', sku: 'BLACK-L', availableQuantity: lowStockThreshold + 1 },
          ],
        },
      ],
    },
  ],
}

test.describe('admin catalog inventory presentation', () => {
  test('uses the same low-stock threshold as admin notifications', () => {
    expect(lowStockThreshold).toBe(5)
    expect(getStockMeta(getInventory(product))).toEqual({
      total: 11,
      low: 1,
      out: 1,
    })
  })

  test('marks any positive stock at or below the threshold as low', () => {
    expect(getInventoryStatus([{ availableQuantity: 5 }], true)).toEqual({
      label: 'Sắp hết',
      className: 'is-low',
    })
    expect(getInventoryStatus([{ availableQuantity: 6 }], true)).toEqual({
      label: 'Còn hàng',
      className: 'is-available',
    })
  })

  test('maps the 0, 1, 5 and 6 stock boundaries consistently', () => {
    const cases = [
      [0, 'is-out'],
      [1, 'is-low'],
      [5, 'is-low'],
      [6, 'is-available'],
    ] as const

    cases.forEach(([availableQuantity, expectedClassName]) => {
      expect(getInventoryStatus([{ availableQuantity }], true).className).toBe(expectedClassName)
    })
  })

  test('keeps inactive and fully sold-out states ahead of low-stock warnings', () => {
    expect(getInventoryStatus([{ availableQuantity: 5 }], false).className).toBe('is-inactive')
    expect(getInventoryStatus([{ availableQuantity: 0 }], true).className).toBe('is-out')
    expect(getInventoryStatus([], true).className).toBe('is-out')
  })
})
