export type StockQuantity = {
  availableQuantity: number
}

export const lowStockThreshold = 5

export const isLowStockQuantity = (
  availableQuantity: number,
  threshold = lowStockThreshold,
) => availableQuantity > 0 && availableQuantity <= threshold

export const getStockMeta = (
  items: StockQuantity[],
  threshold = lowStockThreshold,
) => ({
  total: items.reduce((sum, item) => sum + item.availableQuantity, 0),
  low: items.filter((item) => isLowStockQuantity(item.availableQuantity, threshold)).length,
  out: items.filter((item) => item.availableQuantity === 0).length,
})

export const getStockStatus = (
  items: StockQuantity[],
  threshold = lowStockThreshold,
) => {
  if (items.length === 0 || items.every((item) => item.availableQuantity === 0)) {
    return { id: 'out' as const, label: 'Hết hàng', className: 'is-out' }
  }

  if (items.some((item) => isLowStockQuantity(item.availableQuantity, threshold))) {
    return { id: 'low' as const, label: 'Sắp hết', className: 'is-low' }
  }

  return { id: 'available' as const, label: 'Còn hàng', className: 'is-available' }
}
