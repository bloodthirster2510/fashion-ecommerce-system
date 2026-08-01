import type { ManagedProduct } from '../catalog/products/product.types'
import type { InventoryReceipt } from './inventory.types'
import type {
  InventoryReceiptListItem,
  ReceiptProductEntry,
  ReceiptProductLine,
  ReceiptSummary,
} from './inventory.view-types'
import { getStockStatus, lowStockThreshold } from '../../utils/stock'

export { lowStockThreshold }
export const inventoryPageSize = 10

export const formatNumber = (value: number) => value.toLocaleString('vi-VN')

export const formatPrice = (value: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)

export const formatDate = (value: string) =>
  new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))

export const formatInputDate = (date: Date) => date.toISOString().slice(0, 10)

export const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Không thể xử lý yêu cầu'

// Gợi ý mã phiếu tiếp theo theo mẫu PN00001, admin vẫn có thể sửa lại.
export const getNextReceiptCode = (receipts: Array<{ receiptCode?: string; importCode?: string }>) => {
  const maxSequence = receipts.reduce((max, item) => {
    const match = (item.receiptCode || item.importCode)?.match(/^PN0*(\d+)$/i)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `PN${String(maxSequence + 1).padStart(5, '0')}`
}

export const createReceiptLine = (): ReceiptProductLine => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  variantId: '',
  colorVariantId: '',
  quantities: {},
  unitPrice: '',
})

export const getLineTotalQuantity = (line: ReceiptProductLine) =>
  Object.values(line.quantities).reduce(
    (sum, value) => sum + (Number.parseInt(value || '0', 10) || 0),
    0,
  )

export const getLineTotalAmount = (line: ReceiptProductLine) =>
  getLineTotalQuantity(line) * (Number(line.unitPrice) || 0)

// Tính phần tổng kết ở cuối phiếu từ các dòng admin đang nhập.
export const getReceiptSummary = (entries: ReceiptProductEntry[]): ReceiptSummary => {
  const colorVariants = new Set<string>()
  let totalQuantity = 0
  let totalAmount = 0

  entries.forEach((entry) => {
    entry.lines.forEach((line) => {
      if (!line.variantId || !line.colorVariantId) return

      colorVariants.add(`${entry.product._id}:${line.variantId}:${line.colorVariantId}`)
      totalQuantity += getLineTotalQuantity(line)
      totalAmount += getLineTotalAmount(line)
    })
  })

  return {
    productCount: entries.length,
    colorVariantCount: colorVariants.size,
    totalQuantity,
    totalAmount,
  }
}

// Đưa phiếu nháp đã lưu về lại dạng các khối sản phẩm để admin sửa tiếp.
export const createReceiptProductEntries = (
  receipt: InventoryReceipt | null,
  products: ManagedProduct[],
): ReceiptProductEntry[] => {
  if (!receipt) return []

  const entries = new Map<string, ReceiptProductEntry>()

  receipt.lines.forEach((receiptLine) => {
    const product = products.find((entry) => entry._id === receiptLine.productId)
    if (!product) return

    const productEntry = entries.get(product._id) ?? {
      product,
      lines: [],
    }
    const detailGroups = new Map<number, Record<string, string>>()

    receiptLine.detail.forEach((detail) => {
      const price = detail.importPrice ?? 0
      const quantities = detailGroups.get(price) ?? {}
      quantities[detail.size] = String(detail.quantity)
      detailGroups.set(price, quantities)
    })

    detailGroups.forEach((quantities, price) => {
      productEntry.lines.push({
        id: `${receipt._id}-${receiptLine.productId}-${receiptLine.variantId}-${receiptLine.colorVariantId}-${price}-${Math.random().toString(36).slice(2, 8)}`,
        variantId: receiptLine.variantId,
        colorVariantId: receiptLine.colorVariantId,
        quantities,
        unitPrice: price ? String(price) : '',
      })
    })

    entries.set(product._id, productEntry)
  })

  return [...entries.values()].map((entry) => ({
    ...entry,
    lines: [...entry.lines, createReceiptLine()],
  }))
}

// Chuẩn bị dữ liệu phiếu nhập để hiển thị trong danh sách và màn xem chi tiết.
export const getReceiptListItem = (
  item: InventoryReceipt,
  products: ManagedProduct[],
): InventoryReceiptListItem => {
  const productMap = new Map<string, InventoryReceiptListItem['products'][number]>()
  const colorVariants = new Set<string>()

  item.lines.forEach((line) => {
    const product = products.find((entry) => entry._id === line.productId)
    const variant = product?.variants.find((entry) => entry._id === line.variantId)
    const color = variant?.colors.find((entry) => entry._id === line.colorVariantId)
    const productEntry = productMap.get(line.productId) ?? {
      productId: line.productId,
      productName: product?.name || line.productId,
      productImage: product?.productImage,
      categoryName: product?.categoryName || '-',
      rows: [],
    }

    colorVariants.add(`${line.productId}:${line.variantId}:${line.colorVariantId}`)
    productEntry.rows.push({
      key: `${line.productId}:${line.variantId}:${line.colorVariantId}`,
      fitTypeLabel: variant?.fitTypeLabel || '-',
      colorName: color?.color || '-',
      colorImage: color?.image,
      detail: line.detail.map((detail) => ({
        size: detail.size,
        quantity: detail.quantity,
        remainingQuantity: detail.quantity,
        importPrice: detail.importPrice,
      })),
      totalAmount: line.detail.reduce(
        (sum, detail) => sum + detail.quantity * (detail.importPrice ?? 0),
        0,
      ),
    })
    productMap.set(line.productId, productEntry)
  })

  return {
    id: item._id,
    code: item.receiptCode || item._id.slice(-8).toUpperCase(),
    supplierName: item.supplierName || '-',
    importDate: item.importDate || item.createdAt,
    productCount: productMap.size,
    colorVariantCount: colorVariants.size,
    totalQuantity: item.totalQuantity,
    totalAmount: item.totalAmount,
    status: item.status,
    note: item.note,
    products: [...productMap.values()],
  }
}

// Tính trạng thái kho cho một dòng size hoặc cho cả nhóm sản phẩm.
export const getStatus = (quantity: number | Array<{ availableQuantity: number }>) => {
  const items = typeof quantity === 'number' ? [{ availableQuantity: quantity }] : quantity
  return getStockStatus(items)
}

export const getImportRemainingClass = (remainingQuantity: number, quantity: number) => {
  if (remainingQuantity === 0) return 'is-out'
  if (quantity > 0 && remainingQuantity / quantity <= 0.2) return 'is-low'
  return 'is-available'
}
