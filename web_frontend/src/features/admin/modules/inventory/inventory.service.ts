import { requestAdmin } from '../../services/adminHttp'
import type { ManagedProduct } from '../catalog/products/product.types'
import type {
  CreateInventoryImportInput,
  CreateInventoryReceiptInput,
  InventoryImport,
  InventoryItem,
  InventoryPage,
  InventoryReceipt,
  InventoryReceiptStatus,
  UpdateInventoryReceiptInput,
} from './inventory.types'

// Bảng kho cần đủ toàn bộ dòng tồn, nên hàm này lấy hết các trang dữ liệu.
export const listInventory = async () => {
  const firstPage = await requestAdmin<InventoryPage<InventoryItem>>(
    '/admin/inventory?page=1&limit=100',
  )

  if (firstPage.pagination.totalPages <= 1) {
    return firstPage
  }

  const remainingPages = await Promise.all(
    Array.from(
      { length: firstPage.pagination.totalPages - 1 },
      (_, index) =>
        requestAdmin<InventoryPage<InventoryItem>>(
          `/admin/inventory?page=${index + 2}&limit=100`,
        ),
    ),
  )

  return {
    ...firstPage,
    items: [
      ...firstPage.items,
      ...remainingPages.flatMap((page) => page.items),
    ],
  }
}

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

// Danh sách phiếu nhập trong dialog hiện chỉ cần lấy một trang lớn.
export const listInventoryReceipts = (status?: InventoryReceiptStatus) => {
  const params = new URLSearchParams({ page: '1', limit: '100' })
  if (status) {
    params.set('status', status)
  }

  return requestAdmin<InventoryPage<InventoryReceipt>>(
    `/admin/inventory/receipts?${params.toString()}`,
  )
}

export const getInventoryReceipt = (receiptId: string) =>
  requestAdmin<InventoryReceipt>(`/admin/inventory/receipts/${receiptId}`)

export const listInventorySuppliers = () =>
  requestAdmin<string[]>('/admin/inventory/imports/suppliers')

export const createInventoryImport = (input: CreateInventoryImportInput) =>
  requestAdmin<InventoryImport>('/admin/inventory/imports', {
    method: 'POST',
    body: JSON.stringify(input),
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

export const deleteInventoryImport = (importId: string) =>
  requestAdmin<InventoryImport>(`/admin/inventory/imports/${importId}`, {
    method: 'DELETE',
  })
