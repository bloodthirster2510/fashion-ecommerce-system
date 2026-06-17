import { requestAdmin } from '../../services/adminHttp'
import type {
  CreateInventoryImportInput,
  InventoryImport,
  InventoryItem,
  InventoryPage,
} from './inventory.types'

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

export const listInventoryImportsByColor = (
  productId: string,
  variantId: string,
  colorVariantId: string,
) =>
  requestAdmin<InventoryPage<InventoryImport>>(
    `/admin/inventory/imports?productId=${productId}&variantId=${variantId}&colorVariantId=${colorVariantId}&limit=20`,
  )

export const listInventorySuppliers = () =>
  requestAdmin<string[]>('/admin/inventory/imports/suppliers')

export const createInventoryImport = (input: CreateInventoryImportInput) =>
  requestAdmin<InventoryImport>('/admin/inventory/imports', {
    method: 'POST',
    body: JSON.stringify(input),
  })

export const deleteInventoryImport = (importId: string) =>
  requestAdmin<InventoryImport>(`/admin/inventory/imports/${importId}`, {
    method: 'DELETE',
  })
