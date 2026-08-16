import { expect, test } from '@playwright/test'
import type { ManagedProduct } from './product.types'
import {
  getInventory,
  getInventoryStatus,
  getProductStockMeta,
  getStockMeta,
  isProductSelling,
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
          isActive: true,
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
    expect(getStockMeta(getInventory(product), lowStockThreshold)).toEqual({
      total: 11,
      low: 1,
      out: 1,
    })
  })

  test('marks any positive stock at or below the threshold as low', () => {
    expect(getInventoryStatus([{ availableQuantity: 5 }], true, lowStockThreshold)).toEqual({
      label: 'Sắp hết',
      className: 'is-low',
    })
    expect(getInventoryStatus([{ availableQuantity: 6 }], true, lowStockThreshold)).toEqual({
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
      expect(getInventoryStatus([{ availableQuantity }], true, lowStockThreshold).className).toBe(expectedClassName)
    })
  })

  test('keeps inactive and fully sold-out states ahead of low-stock warnings', () => {
    expect(getInventoryStatus([{ availableQuantity: 5 }], false, lowStockThreshold).className).toBe('is-inactive')
    expect(getInventoryStatus([{ availableQuantity: 0 }], true, lowStockThreshold).className).toBe('is-out')
    expect(getInventoryStatus([], true, lowStockThreshold).className).toBe('is-out')
  })

  test('uses a dynamic threshold for stock metadata', () => {
    expect(getStockMeta(getInventory(product), 6)).toEqual({
      total: 11,
      low: 2,
      out: 1,
    })
  })

  test('does not mark the product as low stock while at least one sellable color has enough stock', () => {
    const multiColorProduct: ManagedProduct = {
      ...product,
      variants: [
        {
          ...product.variants[0],
          colors: [
            {
              ...product.variants[0].colors[0],
              _id: 'navy',
              color: 'Xanh navy',
              inventory: [{ size: 'M', sku: 'NAVY-M', availableQuantity: 61 }],
            },
            {
              ...product.variants[0].colors[0],
              _id: 'gray',
              color: 'Ghi',
              inventory: [{ size: 'M', sku: 'GRAY-M', availableQuantity: 74 }],
            },
            {
              ...product.variants[0].colors[0],
              _id: 'black-white',
              color: 'Đen phối trắng',
              inventory: [
                { size: 'S', sku: 'BW-S', availableQuantity: 4 },
                { size: 'M', sku: 'BW-M', availableQuantity: 4 },
              ],
            },
          ],
        },
      ],
    }

    expect(getProductStockMeta(multiColorProduct, lowStockThreshold)).toEqual({
      total: 143,
      low: 0,
      out: 0,
    })
  })

  test('marks product low stock only when every sellable color is low', () => {
    const allColorsLowProduct: ManagedProduct = {
      ...product,
      variants: [
        {
          ...product.variants[0],
          colors: [
            {
              ...product.variants[0].colors[0],
              _id: 'navy',
              color: 'Xanh navy',
              inventory: [{ size: 'M', sku: 'NAVY-M', availableQuantity: 3 }],
            },
            {
              ...product.variants[0].colors[0],
              _id: 'gray',
              color: 'Ghi',
              inventory: [{ size: 'M', sku: 'GRAY-M', availableQuantity: 5 }],
            },
          ],
        },
      ],
    }

    expect(getProductStockMeta(allColorsLowProduct, lowStockThreshold)).toEqual({
      total: 8,
      low: 2,
      out: 0,
    })
  })

  test('treats a product with no active sellable variant as stopped', () => {
    expect(isProductSelling(product)).toBe(true)
    expect(isProductSelling({
      ...product,
      variants: product.variants.map((variant) => ({ ...variant, isActive: false })),
    })).toBe(false)
    expect(isProductSelling({
      ...product,
      variants: product.variants.map((variant) => ({
        ...variant,
        colors: variant.colors.map((color) => ({ ...color, isActive: false })),
      })),
    })).toBe(false)
  })
})
