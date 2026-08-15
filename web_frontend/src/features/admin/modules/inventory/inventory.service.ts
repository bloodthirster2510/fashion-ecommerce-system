import { requestAdmin } from '../../services/adminHttp'
import type { ManagedProduct } from '../catalog/products/product.types'
import type {
  AdjustInventoryInput,
  CreateInventoryStocktakeInput,
  CreateInventoryReceiptInput,
  InventoryImport,
  InventoryItem,
  InventoryMovement,
  InventoryPage,
  InventoryReceipt,
  InventoryReceiptStatus,
  InventoryStocktake,
  InventorySupplier,
  UpsertInventorySupplierInput,
  UpdateInventoryThresholdInput,
  UpdateInventoryReceiptInput,
} from './inventory.types'
import { listAllInventoryPages } from './inventory.utils'

// Bảng kho cần đủ toàn bộ dòng tồn, nên hàm này lấy hết các trang dữ liệu.
export const listInventory = () =>
  listAllInventoryPages((page) =>
    requestAdmin<InventoryPage<InventoryItem>>(
      `/admin/inventory?page=${page}&limit=100`,
    ),
  )

export const listInventoryProducts = () =>
  requestAdmin<ManagedProduct[]>('/admin/inventory/products')

// Chỉ lấy lịch sử nhập của một màu sản phẩm, tránh tải lại toàn bộ lô nhập.
export const listInventoryImportsByColor = (
  productId: string,
  variantId: string,
  colorVariantId: string,
) =>
  requestAdmin<InventoryPage<InventoryImport>>(
    `/admin/inventory/imports?productId=${productId}&variantId=${variantId}&colorVariantId=${colorVariantId}&limit=20`,
  )

export const listInventoryImports = () =>
  requestAdmin<InventoryPage<InventoryImport>>('/admin/inventory/imports?page=1&limit=100')

export const getInventoryThreshold = () =>
  requestAdmin<UpdateInventoryThresholdInput>('/admin/inventory/threshold')

export const listInventoryMovementsByColor = (
  productId: string,
  variantId: string,
  colorVariantId: string,
) =>
  requestAdmin<InventoryPage<InventoryMovement>>(
    `/admin/inventory/movements?productId=${productId}&variantId=${variantId}&colorVariantId=${colorVariantId}&limit=50`,
  )

export const listInventoryMovements = ({
  page = 1,
  limit = 12,
  type,
}: {
  page?: number
  limit?: number
  type?: string
} = {}) => {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  })
  if (type && type !== 'all') {
    params.set('type', type)
  }

  return requestAdmin<InventoryPage<InventoryMovement>>(
    `/admin/inventory/movements?${params.toString()}`,
  )
}

// Danh sách phiếu nhập cần đủ các trang để không ẩn phiếu cũ và sinh trùng mã gợi ý.
export const listInventoryReceipts = (status?: InventoryReceiptStatus) =>
  listAllInventoryPages((page) => {
    const params = new URLSearchParams({ page: String(page), limit: '100' })
    if (status) {
      params.set('status', status)
    }

    return requestAdmin<InventoryPage<InventoryReceipt>>(
      `/admin/inventory/receipts?${params.toString()}`,
    )
  })

export const getInventoryReceipt = (receiptId: string) =>
  requestAdmin<InventoryReceipt>(`/admin/inventory/receipts/${receiptId}`)

export const listManagedInventorySuppliers = () =>
  requestAdmin<InventorySupplier[]>('/admin/inventory/suppliers')

export const createInventorySupplier = (input: UpsertInventorySupplierInput) =>
  requestAdmin<InventorySupplier>('/admin/inventory/suppliers', {
    method: 'POST',
    body: JSON.stringify(input),
  })

export const updateInventorySupplier = (
  supplierId: string,
  input: Partial<UpsertInventorySupplierInput>,
) =>
  requestAdmin<InventorySupplier>(`/admin/inventory/suppliers/${supplierId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })

export const deleteInventorySupplier = (supplierId: string) =>
  requestAdmin<InventorySupplier>(`/admin/inventory/suppliers/${supplierId}`, {
    method: 'DELETE',
  })

export const createInventoryReceipt = (input: CreateInventoryReceiptInput) =>
  requestAdmin<InventoryReceipt>('/admin/inventory/receipts', {
    method: 'POST',
    body: JSON.stringify(input),
  })

export const updateInventoryReceipt = (
  receiptId: string,
  input: UpdateInventoryReceiptInput,
) =>
  requestAdmin<InventoryReceipt>(`/admin/inventory/receipts/${receiptId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })

export const confirmInventoryReceipt = (receiptId: string) =>
  requestAdmin<InventoryReceipt>(`/admin/inventory/receipts/${receiptId}/confirm`, {
    method: 'POST',
  })

export const cancelInventoryReceipt = (receiptId: string) =>
  requestAdmin<InventoryReceipt>(`/admin/inventory/receipts/${receiptId}/cancel`, {
    method: 'POST',
  })

export const adjustInventory = (inventoryId: string, input: AdjustInventoryInput) =>
  requestAdmin<InventoryItem>(`/admin/inventory/${inventoryId}/adjust`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })

export const updateInventoryThreshold = (
  input: UpdateInventoryThresholdInput,
) =>
  requestAdmin<UpdateInventoryThresholdInput>('/admin/inventory/threshold', {
    method: 'PATCH',
    body: JSON.stringify(input),
  })

export const createInventoryStocktake = (input: CreateInventoryStocktakeInput) =>
  requestAdmin<InventoryStocktake>('/admin/inventory/stocktakes', {
    method: 'POST',
    body: JSON.stringify(input),
  })
