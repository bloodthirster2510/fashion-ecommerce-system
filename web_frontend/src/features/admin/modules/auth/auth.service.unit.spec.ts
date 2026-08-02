import { expect, test } from '@playwright/test'
import {
  clearAdminSession,
  getAdminSession,
  saveAdminSession,
  type AdminUser,
} from './adminSession'
import { refreshAdminSession } from './auth.service'

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

const refreshResponse = (accessToken: string) => new Response(JSON.stringify({
  data: { accessToken },
}), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
})

test.describe('admin refresh lifecycle', () => {
  let originalFetch: typeof fetch
  let pendingResponses: Array<(response: Response) => void>
  let fetchCalls: number

  test.beforeEach(() => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { localStorage: localStorageMock },
    })
    values.clear()
    clearAdminSession()
    saveAdminSession({ accessToken: 'expired-access', user })
    pendingResponses = []
    fetchCalls = 0
    originalFetch = globalThis.fetch
    globalThis.fetch = (() => {
      fetchCalls += 1
      return new Promise<Response>((resolve) => pendingResponses.push(resolve))
    }) as typeof fetch
  })

  test.afterEach(() => {
    globalThis.fetch = originalFetch
    clearAdminSession()
  })

  test('shares one refresh request across concurrent 401 recovery paths', async () => {
    const first = refreshAdminSession()
    const second = refreshAdminSession()
    await Promise.resolve()

    expect(fetchCalls).toBe(1)
    pendingResponses[0](refreshResponse('next-access'))

    const [firstSession, secondSession] = await Promise.all([first, second])
    expect(firstSession).toEqual(secondSession)
    expect(getAdminSession()?.accessToken).toBe('next-access')
  })

  test('does not restore an old refresh after the local session is cleared', async () => {
    const refresh = refreshAdminSession()
    await Promise.resolve()
    clearAdminSession()
    pendingResponses[0](refreshResponse('stale-access'))

    await expect(refresh).rejects.toThrow('Phiên đăng nhập đã thay đổi')
    expect(getAdminSession()).toBeNull()
  })

  test('does not share an old refresh with a newly signed-in admin', async () => {
    const oldRefresh = refreshAdminSession()
    await Promise.resolve()

    const nextUser = { ...user, _id: 'admin-2', email: 'next@example.com' }
    clearAdminSession()
    saveAdminSession({ accessToken: 'next-login-access', user: nextUser })
    const nextRefresh = refreshAdminSession()
    await Promise.resolve()

    expect(fetchCalls).toBe(2)
    pendingResponses[1](refreshResponse('next-refreshed-access'))
    await expect(nextRefresh).resolves.toEqual({
      accessToken: 'next-refreshed-access',
      user: nextUser,
    })

    pendingResponses[0](refreshResponse('stale-access'))
    await expect(oldRefresh).rejects.toThrow('Phiên đăng nhập đã thay đổi')
    expect(getAdminSession()).toEqual({
      accessToken: 'next-refreshed-access',
      user: nextUser,
    })
  })
})
