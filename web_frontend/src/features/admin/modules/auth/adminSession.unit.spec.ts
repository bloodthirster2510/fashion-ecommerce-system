import { expect, test } from '@playwright/test'
import {
  clearAdminSession,
  getAdminSession,
  getStoredAdminUser,
  saveAdminSession,
  type AdminUser,
} from './adminSession'

const values = new Map<string, string>()
const localStorageMock = {
  get length() {
    return values.size
  },
  clear: () => values.clear(),
  getItem: (key: string) => values.get(key) ?? null,
  key: (index: number) => Array.from(values.keys())[index] ?? null,
  removeItem: (key: string) => values.delete(key),
  setItem: (key: string, value: string) => values.set(key, String(value)),
} as Storage

const validUser: AdminUser = {
  _id: 'admin-1',
  name: 'Admin User',
  email: 'admin@example.com',
  role: 'admin',
}

test.describe('admin session storage', () => {
  test.beforeEach(() => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { localStorage: localStorageMock },
    })
    values.clear()
    clearAdminSession()
  })

  test('keeps the access token in memory and removes legacy persisted tokens', () => {
    localStorageMock.setItem('admin_access_token', 'legacy-access')
    localStorageMock.setItem('admin_refresh_token', 'legacy-refresh')

    saveAdminSession({ accessToken: 'runtime-access', user: validUser })

    expect(getAdminSession()).toEqual({ accessToken: 'runtime-access', user: validUser })
    expect(localStorageMock.getItem('admin_access_token')).toBeNull()
    expect(localStorageMock.getItem('admin_refresh_token')).toBeNull()
    expect(localStorageMock.getItem('admin_user')).toBe(JSON.stringify(validUser))
  })

  test('rejects a corrupted stored admin identity even when its role looks valid', () => {
    localStorageMock.setItem('admin_user', JSON.stringify({ role: 'admin' }))

    expect(getStoredAdminUser()).toBeNull()
    expect(localStorageMock.getItem('admin_user')).toBeNull()
  })

  test('does not save an empty token or a non-admin identity', () => {
    expect(() => saveAdminSession({ accessToken: '  ', user: validUser })).toThrow(
      'Phiên đăng nhập quản trị không hợp lệ',
    )
    expect(() => saveAdminSession({
      accessToken: 'access-token',
      user: { ...validUser, role: 'user' },
    })).toThrow('Phiên đăng nhập quản trị không hợp lệ')
    expect(getAdminSession()).toBeNull()
  })
})
