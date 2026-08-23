export const ADMIN_TIME_ZONE = 'Asia/Ho_Chi_Minh'

type DateValue = string | number | Date | null | undefined

const DATE_TIME_INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/

const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
  timeZone: ADMIN_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const timeFormatter = new Intl.DateTimeFormat('vi-VN', {
  timeZone: ADMIN_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

const inputFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: ADMIN_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

const toValidDate = (value: DateValue) => {
  if (value === null || value === undefined || value === '') return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const getPart = (parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) =>
  parts.find((part) => part.type === type)?.value ?? ''

export const formatAdminDate = (value: DateValue, fallback = 'Chưa có') => {
  const date = toValidDate(value)
  return date ? dateFormatter.format(date) : fallback
}

export const formatAdminTime = (value: DateValue, fallback = '--:--') => {
  const date = toValidDate(value)
  return date ? timeFormatter.format(date) : fallback
}

export const formatAdminDateTime = (value: DateValue, fallback = 'Chưa có') => {
  const date = toValidDate(value)
  return date ? `${dateFormatter.format(date)} · ${timeFormatter.format(date)}` : fallback
}

export const formatAdminDateInput = (value: DateValue) => {
  const date = toValidDate(value)
  if (!date) return ''

  const parts = inputFormatter.formatToParts(date)
  return `${getPart(parts, 'year')}-${getPart(parts, 'month')}-${getPart(parts, 'day')}`
}

export const formatAdminDateTimeInput = (value: DateValue) => {
  if (typeof value === 'string' && DATE_TIME_INPUT_PATTERN.test(value)) return value

  const date = toValidDate(value)
  if (!date) return ''

  const parts = inputFormatter.formatToParts(date)
  return `${getPart(parts, 'year')}-${getPart(parts, 'month')}-${getPart(parts, 'day')}T${getPart(parts, 'hour')}:${getPart(parts, 'minute')}`
}

export const parseAdminDateTimeInput = (value: string) => {
  const match = DATE_TIME_INPUT_PATTERN.exec(value)
  if (!match) return new Date(Number.NaN)

  const [, yearText, monthText, dayText, hourText, minuteText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const hour = Number(hourText)
  const minute = Number(minuteText)
  const validationDate = new Date(Date.UTC(year, month - 1, day, hour, minute))

  if (
    validationDate.getUTCFullYear() !== year
    || validationDate.getUTCMonth() !== month - 1
    || validationDate.getUTCDate() !== day
    || validationDate.getUTCHours() !== hour
    || validationDate.getUTCMinutes() !== minute
  ) {
    return new Date(Number.NaN)
  }

  return new Date(Date.UTC(year, month - 1, day, hour - 7, minute))
}

export const toAdminISOString = (value: string) => {
  const date = DATE_TIME_INPUT_PATTERN.test(value)
    ? parseAdminDateTimeInput(value)
    : toValidDate(value)
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null
}
