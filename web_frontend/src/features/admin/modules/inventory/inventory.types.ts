export type InventoryItem = {
  _id: string
  productId: string
  variantId: string
  colorVariantId: string
  size: string
  sku: string
  quantity: number
  reservedQuantity: number
  availableQuantity: number
  createdAt: string
  updatedAt: string
}

export type InventoryImportDetail = {
  size: string
  quantity: number
  remainingQuantity: number
  importPrice?: number
}

export type InventoryImport = {
  _id: string
  importCode?: string
  supplierName?: string
  productId: string
  variantId: string
  colorVariantId: string
  detail: InventoryImportDetail[]
  totalAmount?: number
  createdAt: string
  updatedAt: string
}

export type InventoryPage<T> = {
  items: T[]
  pagination: {
    page: number
    limit: number
    totalItems: number
    totalPages: number
  }
}

export type CreateInventoryImportInput = {
  productId: string
  variantId: string
  colorVariantId: string
  supplierName?: string
  detail: Array<{
    size: string
    quantity: number
    importPrice?: number
  }>
}
