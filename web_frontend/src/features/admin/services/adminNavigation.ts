export const ADMIN_NAVIGATION_EVENT = 'admin:navigation'

export const notifyAdminNavigation = () => {
  window.dispatchEvent(new Event(ADMIN_NAVIGATION_EVENT))
}

export const buildOrderSectionUrl = (section: 'all' | 'online' | 'cod', queue?: string) => {
  const params = new URLSearchParams()
  if (section !== 'all') params.set('section', section)
  if (queue) params.set('queue', queue)
  const query = params.toString()
  return query ? `/admin/orders?${query}` : '/admin/orders'
}

export const navigateToOrderSection = (section: 'all' | 'online' | 'cod', queue?: string) => {
  const target = buildOrderSectionUrl(section, queue)
  if (`${window.location.pathname}${window.location.search}` !== target) {
    window.history.pushState(null, '', target)
    notifyAdminNavigation()
  }
}