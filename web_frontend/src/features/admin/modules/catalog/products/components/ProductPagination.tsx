import { getPaginationItems } from '../../../../utils/pagination'

type ProductPaginationProps = {
  start: number
  end: number
  totalItems: number
  totalPages: number
  safePage: number
  isLoading: boolean
  onPageChange: (page: number | ((page: number) => number)) => void
}

export function ProductPagination({
  start,
  end,
  totalItems,
  totalPages,
  safePage,
  isLoading,
  onPageChange,
}: ProductPaginationProps) {
  return (
    <footer className="admin-table-footer admin-product-pagination">
      <span>Hiển thị {start}–{end} / {totalItems}</span>
      <div>
        <button
          className="admin-secondary-button"
          type="button"
          disabled={safePage <= 1 || isLoading}
          onClick={() => onPageChange((value) => Math.max(1, value - 1))}
        >
          Trước
        </button>
        <div className="admin-page-numbers" aria-label="Phân trang sản phẩm">
          {getPaginationItems(totalPages, safePage).map((item) =>
            typeof item === 'number' ? (
              <button
                className={`admin-page-button${item === safePage ? ' is-active' : ''}`}
                type="button"
                key={item}
                aria-current={item === safePage ? 'page' : undefined}
                disabled={isLoading}
                onClick={() => onPageChange(item)}
              >
                {item}
              </button>
            ) : (
              <span className="admin-page-ellipsis" key={item} aria-hidden="true">
                ...
              </span>
            ),
          )}
        </div>
        <button
          className="admin-secondary-button"
          type="button"
          disabled={safePage >= totalPages || isLoading}
          onClick={() => onPageChange((value) => Math.min(totalPages, value + 1))}
        >
          Sau
        </button>
      </div>
    </footer>
  )
}
