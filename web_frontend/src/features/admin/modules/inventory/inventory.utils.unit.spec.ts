import { expect, test } from '@playwright/test'
import { getStatus, lowStockThreshold } from './inventory.utils'

test.describe('admin inventory stock status', () => {
  test('uses the canonical fixed low-stock threshold', () => {
    expect(lowStockThreshold).toBe(5)
    expect(getStatus(lowStockThreshold).id).toBe('low')
    expect(getStatus(lowStockThreshold + 1).id).toBe('available')
  })

  test('marks a group low when any positive item is near depletion', () => {
    expect(getStatus([
      { availableQuantity: 100 },
      { availableQuantity: 5 },
      { availableQuantity: 0 },
    ])).toEqual({
      id: 'low',
      label: 'Sắp hết',
      className: 'is-low',
    })
  })

  test('keeps empty and fully sold-out groups out of stock', () => {
    expect(getStatus([]).id).toBe('out')
    expect(getStatus([{ availableQuantity: 0 }, { availableQuantity: 0 }]).id).toBe('out')
  })
})
