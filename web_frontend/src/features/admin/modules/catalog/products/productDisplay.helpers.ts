import type { ManagedProduct, ProductColor } from './product.types'

export type ProductActiveFilter = 'all' | 'active' | 'inactive'
export type ProductStockFilter = 'all' | 'available' | 'low' | 'out'
export type ProductDeleteMode = 'pause' | 'permanent'

export type QuantityDetail = {
  productName: string
  fitTypeLabel: string
  color: ProductColor
  isActive: boolean
} | null

export const pageSize = 20
export const lowStockPercentage = 0.15

export const formatNumber = (value: number) => value.toLocaleString('vi-VN')

export const formatPrice = (value: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)

export const getInventory = (product: ManagedProduct) =>
  product.variants.flatMap((variant) =>
    variant.colors.flatMap((color) => color.inventory),
  )

export const getDisplayPrice = (price: number, discount: number) =>
  discount > 0 ? Math.round(price * (1 - discount / 100)) : price

export const getStockMeta = (items: Array<{ availableQuantity: number }>) => {
  const total = items.reduce((sum, item) => sum + item.availableQuantity, 0)
  const avg = items.length ? total / items.length : 0
  const threshold = avg * lowStockPercentage

  return {
    total,
    low: items.filter(
      (item) => item.availableQuantity > 0 && item.availableQuantity <= threshold,
    ).length,
    out: items.filter((item) => item.availableQuantity === 0).length,
  }
}

export const getInventoryStatus = (
  items: Array<{ availableQuantity: number }>,
  isActive: boolean,
) => {
  if (!isActive) return { label: 'Tạm ẩn', className: 'is-inactive' }
  if (items.every((item) => item.availableQuantity === 0)) {
    return { label: 'Hết hàng', className: 'is-out' }
  }

  const total = items.reduce((sum, item) => sum + item.availableQuantity, 0)
  const avg = items.length ? total / items.length : 0
  const threshold = avg * lowStockPercentage

  if (items.every((item) => item.availableQuantity > 0 && item.availableQuantity <= threshold)) {
    return { label: 'Sắp hết', className: 'is-low' }
  }

  return { label: 'Còn hàng', className: 'is-available' }
}

export const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Không thể tải danh sách sản phẩm'
