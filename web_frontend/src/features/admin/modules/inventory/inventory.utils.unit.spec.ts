import { expect, test } from '@playwright/test'
import { getStatus, listAllInventoryPages, lowStockThreshold } from './inventory.utils'

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

test.describe('admin inventory pagination', () => {
  test('loads and combines every page in order', async () => {
    const requestedPages: number[] = []
    const result = await listAllInventoryPages(async (page) => {
      requestedPages.push(page)

      return {
        items: [{ id: `item-${page}` }],
        pagination: {
          page,
          limit: 100,
          totalItems: 3,
          totalPages: 3,
        },
      }
    })

    expect(requestedPages).toEqual([1, 2, 3])
    expect(result.items).toEqual([
      { id: 'item-1' },
      { id: 'item-2' },
      { id: 'item-3' },
    ])
  })

  test('does not request extra pages for a single-page result', async () => {
    const requestedPages: number[] = []
    const result = await listAllInventoryPages(async (page) => {
      requestedPages.push(page)

      return {
        items: [{ id: 'only-item' }],
        pagination: {
          page,
          limit: 100,
          totalItems: 1,
          totalPages: 1,
        },
      }
    })

    expect(requestedPages).toEqual([1])
    expect(result.items).toEqual([{ id: 'only-item' }])
  })
})
