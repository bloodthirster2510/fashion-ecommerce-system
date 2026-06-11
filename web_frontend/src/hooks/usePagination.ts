import { useMemo, useState } from 'react'

export function usePagination(initialPage = 1, initialLimit = 12) {
  const [page, setPage] = useState(initialPage)
  const [limit, setLimit] = useState(initialLimit)

  return useMemo(
    () => ({
      page,
      limit,
      setPage,
      setLimit,
    }),
    [limit, page],
  )
}
