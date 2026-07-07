import type {
  ManagedProduct,
  ProductColor,
  ProductVariant,
} from '../catalog/products/product.types'
import type {
  InventoryImport,
  InventoryItem,
} from './inventory.types'

export type StockStatus = 'all' | 'available' | 'low' | 'out'

export type InventoryRow = InventoryItem & {
  product?: ManagedProduct
  variant?: ProductVariant
  color?: ProductColor
}

export type InventoryProductGroup = {
  productId: string
  product?: ManagedProduct
  rows: InventoryRow[]
}

export type InventoryColorGroup = {
  productId: string
  variantId: string
  colorVariantId: string
  product?: ManagedProduct
  variant?: ProductVariant
  color?: ProductColor
  rows: InventoryRow[]
}

export type Notice = {
  type: 'success' | 'error'
  message: string
} | null

export type InventoryReceiptStatus = 'draft' | 'confirmed' | 'cancelled'

export type ReceiptFilterStatus = InventoryReceiptStatus | 'all'

export type ReceiptProductLine = {
  id: string
  variantId: string
  colorVariantId: string
  quantities: Record<string, string>
  unitPrice: string
}

export type ReceiptProductEntry = {
  product: ManagedProduct
  lines: ReceiptProductLine[]
}

export type InventoryReceiptListItem = {
  id: string
  code: string
  supplierName: string
  importDate: string
  productCount: number
  colorVariantCount: number
  totalQuantity: number
  totalAmount: number
  status: InventoryReceiptStatus
  note?: string
  products: Array<{
    productId: string
    productName: string
    productImage?: string
    categoryName: string
    rows: Array<{
      key: string
      fitTypeLabel: string
      colorName: string
      colorImage?: string
      detail: InventoryImport['detail']
      totalAmount: number
    }>
  }>
}

export type ReceiptSummary = {
  productCount: number
  colorVariantCount: number
  totalQuantity: number
  totalAmount: number
}
