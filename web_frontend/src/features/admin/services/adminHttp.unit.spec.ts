import { expect, test } from '@playwright/test'
import {
  clearAdminSession,
  getAdminSession,
  saveAdminSession,
  type AdminUser,
} from '../modules/auth/adminSession'
import { requestAdmin } from './adminHttp'

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

const user: AdminUser = {
  _id: 'admin-1',
  name: 'Admin User',
  email: 'admin@example.com',
  role: 'admin',
}

const jsonResponse = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
})

test('an expired request from an old admin does not clear a newer login', async () => {
  let dispatchedSessionExpired = 0
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: localStorageMock,
      dispatchEvent: () => {
        dispatchedSessionExpired += 1
        return true
      },
    },
  })
  values.clear()
  clearAdminSession()
  saveAdminSession({ accessToken: 'old-access', user })

  const originalFetch = globalThis.fetch
  let resolveRefresh!: (response: Response) => void
  let fetchCalls = 0
  globalThis.fetch = (() => {
    fetchCalls += 1
    if (fetchCalls === 1) {
      return Promise.resolve(jsonResponse(401, { message: 'expired' }))
    }
    return new Promise<Response>((resolve) => { resolveRefresh = resolve })
  }) as typeof fetch

  try {
    const oldRequest = requestAdmin('/admin/dashboard/overview')
    while (!resolveRefresh) {
      await Promise.resolve()
    }

    const nextUser = { ...user, _id: 'admin-2', email: 'next@example.com' }
    clearAdminSession()
    saveAdminSession({ accessToken: 'new-access', user: nextUser })
    resolveRefresh(jsonResponse(401, { message: 'refresh expired' }))

    await expect(oldRequest).rejects.toThrow()
    expect(getAdminSession()).toEqual({ accessToken: 'new-access', user: nextUser })
    expect(dispatchedSessionExpired).toBe(0)
  } finally {
    globalThis.fetch = originalFetch
    clearAdminSession()
  }
})
