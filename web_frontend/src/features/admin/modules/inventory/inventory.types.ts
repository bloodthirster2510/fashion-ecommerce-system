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
