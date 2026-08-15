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
  lowStockThreshold?: number
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
  receiptId?: string | null
  receiptCode?: string
  supplierName?: string
  productId: string
  variantId: string
  colorVariantId: string
  detail: InventoryImportDetail[]
  totalAmount?: number
  createdAt: string
  updatedAt: string
}

export type InventoryReceiptStatus = 'draft' | 'confirmed' | 'cancelled'

export type InventoryReceiptLineDetail = {
  size: string
  quantity: number
  importPrice?: number
}

export type InventoryReceiptLine = {
  productId: string
  variantId: string
  colorVariantId: string
  detail: InventoryReceiptLineDetail[]
}

export type InventoryReceipt = {
  _id: string
  receiptCode: string
  supplierName?: string
  importDate: string
  createdBy?: string | null
  status: InventoryReceiptStatus
  note?: string
  lines: InventoryReceiptLine[]
  totalQuantity: number
  totalAmount: number
  confirmedAt?: string | null
  cancelledAt?: string | null
  createdAt: string
  updatedAt: string
}

export type InventoryMovementType =
  | 'import'
  | 'import_delete'
  | 'adjustment'
  | 'sale_commit'
  | 'reservation'
  | 'reservation_release'
  | 'reservation_expire'
  | 'stocktake'

export type InventoryMovement = {
  _id: string
  inventoryId?: string | null
  productId: string
  variantId: string
  colorVariantId: string
  size: string
  sku?: string
  type: InventoryMovementType
  quantityDelta: number
  reservedDelta: number
  availableDelta: number
  quantityBefore: number
  quantityAfter: number
  reservedBefore: number
  reservedAfter: number
  availableBefore: number
  availableAfter: number
  reason?: string
  note?: string
  sourceCode?: string
  sourceType?: string
  createdAt: string
  updatedAt: string
}

export type InventorySupplier = {
  _id: string
  name: string
  phone?: string
  email?: string
  address?: string
  note?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type InventoryStocktake = {
  _id: string
  stocktakeCode: string
  status: 'draft' | 'posted' | 'cancelled'
  note?: string
  lines: Array<{
    inventoryId: string
    productId: string
    variantId: string
    colorVariantId: string
    size: string
    sku?: string
    systemQuantity: number
    countedQuantity: number
    difference: number
    reason?: string
  }>
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

export type CreateInventoryReceiptInput = {
  receiptCode?: string
  supplierName?: string
  importDate?: string
  status?: InventoryReceiptStatus
  note?: string
  lines?: InventoryReceiptLine[]
}

export type UpdateInventoryReceiptInput = {
  receiptCode?: string
  supplierName?: string
  importDate?: string
  note?: string
  lines?: InventoryReceiptLine[]
}

export type AdjustInventoryInput = {
  quantity?: number
  deltaQuantity?: number
  reason: string
  note?: string
}

export type UpdateInventoryThresholdInput = {
  lowStockThreshold: number
}

export type UpsertInventorySupplierInput = {
  name: string
  phone?: string
  email?: string
  address?: string
  note?: string
  isActive?: boolean
}

export type CreateInventoryStocktakeInput = {
  stocktakeCode?: string
  note?: string
  lines: Array<{
    inventoryId: string
    countedQuantity: number
    reason?: string
  }>
}
