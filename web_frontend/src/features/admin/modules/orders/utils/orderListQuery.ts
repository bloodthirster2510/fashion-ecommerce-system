import type { OrderListFilters } from '../orderAdminApi'

export const buildOrderListQuery = (filters: OrderListFilters) => {
  const params = new URLSearchParams()
  const keyword = filters.keyword?.trim()

  if (filters.queue) params.set('queue', filters.queue)
  if (keyword) params.set('keyword', keyword)

  const statuses = filters.statuses?.filter(Boolean)
  if (statuses?.length) {
    params.set('statuses', statuses.join(','))
  } else if (filters.status && filters.status !== 'all') {
    params.set('status', filters.status)
  }

  if (filters.paymentMethod && filters.paymentMethod !== 'all') {
    params.set('paymentMethod', filters.paymentMethod)
  }
  if (filters.paymentMethods?.length) params.set('paymentMethods', filters.paymentMethods.join(','))
  if (filters.paymentStatus && filters.paymentStatus !== 'all') {
    params.set('paymentStatus', filters.paymentStatus)
  }
  if (filters.paymentDeadlineBefore) params.set('paymentDeadlineBefore', filters.paymentDeadlineBefore)
  if (filters.shippingFallback) params.set('shippingFallback', 'true')
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
  if (filters.dateTo) params.set('dateTo', filters.dateTo)
  if (filters.sort) params.set('sort', filters.sort)

  params.set('page', String(filters.page ?? 1))
  params.set('limit', String(filters.limit ?? 10))

  return params.toString()
}
