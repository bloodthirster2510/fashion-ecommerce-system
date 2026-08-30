import { expect, test } from '@playwright/test'
import {
  formatAdminDate,
  formatAdminDateInput,
  formatAdminDateTime,
  formatAdminDateTimeInput,
  formatAdminTime,
  parseAdminDateTimeInput,
  toAdminISOString,
} from './dateTime'

test.describe('admin Vietnam date and time formatting', () => {
  const instant = '2026-08-23T18:15:00.000Z'

  test('always displays an instant in Vietnam time', () => {
    expect(formatAdminDate(instant)).toBe('24/08/2026')
    expect(formatAdminTime(instant)).toBe('01:15')
    expect(formatAdminDateTime(instant)).toBe('24/08/2026 · 01:15')
  })

  test('creates stable date and datetime input values in Vietnam time', () => {
    expect(formatAdminDateInput(instant)).toBe('2026-08-24')
    expect(formatAdminDateTimeInput(instant)).toBe('2026-08-24T01:15')
    expect(formatAdminDateTimeInput('2026-08-24T01:15')).toBe('2026-08-24T01:15')
  })

  test('parses datetime-local values as Vietnam wall time', () => {
    expect(parseAdminDateTimeInput('2026-08-24T01:15').toISOString()).toBe(instant)
    expect(toAdminISOString('2026-08-24T01:15')).toBe(instant)
    expect(Number.isNaN(parseAdminDateTimeInput('2026-02-31T01:15').getTime())).toBe(true)
  })

  test('uses safe fallbacks for missing or invalid values', () => {
    expect(formatAdminDateTime('not-a-date')).toBe('Chưa có')
    expect(formatAdminDate(null, '—')).toBe('—')
    expect(formatAdminDateInput('not-a-date')).toBe('')
    expect(toAdminISOString('not-a-date')).toBeNull()
  })
})
