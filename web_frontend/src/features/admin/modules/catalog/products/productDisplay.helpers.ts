import type { ManagedProduct, ProductColor } from './product.types'
import {
  getStockMeta as getSharedStockMeta,
  getStockStatus,
  lowStockThreshold,
} from '../../../utils/stock'

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
export { lowStockThreshold }

export const formatNumber = (value: number) => value.toLocaleString('vi-VN')

export const formatPrice = (value: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)

export const getInventory = (product: ManagedProduct) =>
  product.variants.flatMap((variant) =>
    variant.colors.flatMap((color) => color.inventory),
  )

export const getDisplayPrice = (price: number, discount: number) =>
  discount > 0 ? Math.round(price * (1 - discount / 100)) : price

export const getStockMeta = getSharedStockMeta

export const getInventoryStatus = (
  items: Array<{ availableQuantity: number }>,
  isActive: boolean,
) => {
  if (!isActive) return { label: 'Tạm ẩn', className: 'is-inactive' }
  const { label, className } = getStockStatus(items)
  return { label, className }
}

export const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Không thể tải danh sách sản phẩm'
