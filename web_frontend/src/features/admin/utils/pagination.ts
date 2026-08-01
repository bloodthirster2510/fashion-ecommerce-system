export type PaginationItem = number | 'start-ellipsis' | 'end-ellipsis'

type PaginatedResult<T> = {
  items: T[]
  pagination: {
    page: number
    limit: number
    totalItems: number
    totalPages: number
  }
}

export const loadAllPages = async <T>(
  loadPage: (page: number) => Promise<PaginatedResult<T>>,
) => {
  const firstPage = await loadPage(1)

  if (firstPage.pagination.totalPages <= 1) {
    return firstPage
  }

  const remainingPages = await Promise.all(
    Array.from(
      { length: firstPage.pagination.totalPages - 1 },
      (_, index) => loadPage(index + 2),
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

export const getPaginationItems = (
  totalPages: number,
  currentPage: number,
  maxVisiblePages = 7,
): PaginationItem[] => {
  const safeTotal = Math.max(1, totalPages)
  const safeCurrent = Math.min(Math.max(1, currentPage), safeTotal)
  const visiblePages = Math.max(5, maxVisiblePages)

  if (safeTotal <= visiblePages) {
    return Array.from({ length: safeTotal }, (_, index) => index + 1)
  }

  const middleSlots = visiblePages - 2
  const firstMiddle = 2
  const lastMiddle = safeTotal - 1

  let middleStart = safeCurrent - Math.floor(middleSlots / 2)
  let middleEnd = safeCurrent + Math.ceil(middleSlots / 2) - 1

  if (middleStart < firstMiddle) {
    middleStart = firstMiddle
    middleEnd = middleStart + middleSlots - 1
  }

  if (middleEnd > lastMiddle) {
    middleEnd = lastMiddle
    middleStart = middleEnd - middleSlots + 1
  }

  const items: PaginationItem[] = [1]

  if (middleStart > firstMiddle) {
    items.push('start-ellipsis')
  }

  for (let page = middleStart; page <= middleEnd; page += 1) {
    items.push(page)
  }

  if (middleEnd < lastMiddle) {
    items.push('end-ellipsis')
  }

  items.push(safeTotal)
  return items
}
