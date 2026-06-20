export const ADMIN_NOTIFICATION_REFRESH_EVENT = 'admin:notifications:refresh'

export const requestAdminNotificationRefresh = () => {
  window.dispatchEvent(new Event(ADMIN_NOTIFICATION_REFRESH_EVENT))
}
