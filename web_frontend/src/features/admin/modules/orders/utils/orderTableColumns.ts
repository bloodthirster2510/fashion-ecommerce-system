import type { OrderTableColumnKey } from '../orderTypes'

export const orderTableColumnOptions: Array<{
  key: OrderTableColumnKey
  label: string
}> = [
  { key: 'customer', label: 'Khách hàng' },
  { key: 'total', label: 'Tổng tiền' },
  { key: 'status', label: 'Trạng thái' },
  { key: 'createdAt', label: 'Ngày tạo' },
]

export const defaultOrderTableColumns: OrderTableColumnKey[] = orderTableColumnOptions.map((column) => column.key)
