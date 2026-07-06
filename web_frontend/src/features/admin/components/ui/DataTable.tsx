import type { ReactNode } from 'react'

export type DataTableColumn<T> = {
  key: string
  header: ReactNode
  render: (item: T) => ReactNode
}

type DataTableProps<T> = {
  columns: Array<DataTableColumn<T>>
  items: T[]
  getRowKey: (item: T) => string
  isLoading?: boolean
  emptyText?: string
  onRowClick?: (item: T) => void
}

export function DataTable<T>({
  columns,
  items,
  getRowKey,
  isLoading = false,
  emptyText = 'Không có dữ liệu phù hợp.',
  onRowClick,
}: DataTableProps<T>) {
  return (
    <div className="admin-ui-table-card">
      <div className="admin-ui-table-scroll">
        <table className="admin-ui-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key}>{column.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={columns.length}>
                  <div className="admin-ui-table__loading">Đang tải dữ liệu...</div>
                </td>
              </tr>
            ) : null}

            {!isLoading && items.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <div className="admin-ui-table__empty">{emptyText}</div>
                </td>
              </tr>
            ) : null}

            {!isLoading ? items.map((item) => (
              <tr
                key={getRowKey(item)}
                data-clickable={onRowClick ? 'true' : undefined}
                onClick={onRowClick ? () => onRowClick(item) : undefined}
              >
                {columns.map((column) => <td key={column.key}>{column.render(item)}</td>)}
              </tr>
            )) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
