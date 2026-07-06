import { getPaginationItems } from '../../utils/pagination'
import { Button } from './Button'

type PaginationProps = {
  page: number
  totalPages: number
  totalItems?: number
  isDisabled?: boolean
  onPageChange: (page: number) => void
}

export function Pagination({
  page,
  totalPages,
  totalItems,
  isDisabled = false,
  onPageChange,
}: PaginationProps) {
  const safeTotalPages = Math.max(1, totalPages)
  const items = getPaginationItems(safeTotalPages, page)

  return (
    <footer className="admin-ui-pagination">
      <span>
        Trang {page} / {safeTotalPages}
        {typeof totalItems === 'number' ? ` · ${totalItems.toLocaleString('vi-VN')} mục` : ''}
      </span>
      <div className="admin-ui-pagination__controls">
        <Button
          variant="secondary"
          disabled={page <= 1 || isDisabled}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          Trước
        </Button>
        <div className="admin-ui-pagination__pages" aria-label="Trang">
          {items.map((item, index) => {
            if (typeof item !== 'number') {
              return <span className="admin-ui-pagination__ellipsis" key={`${item}-${index}`}>…</span>
            }

            return (
              <button
                className={`admin-ui-pagination__page${item === page ? ' is-active' : ''}`}
                type="button"
                key={item}
                disabled={isDisabled || item === page}
                aria-current={item === page ? 'page' : undefined}
                onClick={() => onPageChange(item)}
              >
                {item}
              </button>
            )
          })}
        </div>
        <Button
          variant="secondary"
          disabled={page >= safeTotalPages || isDisabled}
          onClick={() => onPageChange(Math.min(safeTotalPages, page + 1))}
        >
          Sau
        </Button>
      </div>
    </footer>
  )
}
