export function formatDate(value: string | number | Date, locale = 'vi-VN') {
  return new Intl.DateTimeFormat(locale).format(new Date(value))
}
