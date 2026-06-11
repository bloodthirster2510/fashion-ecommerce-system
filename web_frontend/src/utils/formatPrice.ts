export function formatPrice(value: number, locale = 'vi-VN', currency = 'VND') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}
