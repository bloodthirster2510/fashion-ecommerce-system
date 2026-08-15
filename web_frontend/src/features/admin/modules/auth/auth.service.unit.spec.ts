import { expect, test } from '@playwright/test'
import {
  clearAdminSession,
  getAdminSession,
  saveAdminSession,
  type AdminUser,
} from './adminSession'
import { getCurrentAdminUser, refreshAdminSession } from './auth.service'

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

const refreshResponse = (accessToken: string, refreshedUser: AdminUser = user) => new Response(JSON.stringify({
  data: { accessToken, user: refreshedUser },
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
    pendingResponses[1](refreshResponse('next-refreshed-access', nextUser))
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

  test('uses fresh permissions returned by the refresh endpoint', async () => {
    const latestUser = {
      ...user,
      role: 'staff',
      permissions: ['orders.read'],
    }
    const refresh = refreshAdminSession()
    await Promise.resolve()
    pendingResponses[0](new Response(JSON.stringify({
      data: { accessToken: 'next-access', user: latestUser },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    await expect(refresh).resolves.toEqual({
      accessToken: 'next-access',
      user: latestUser,
    })
    expect(getAdminSession()?.user).toEqual(latestUser)
  })

  test('loads the current admin user with the access token', async () => {
    const latestUser = { ...user, role: 'staff', permissions: ['products.read'] }
    globalThis.fetch = (async (_input, init) => {
      expect(init?.headers).toEqual({ Authorization: 'Bearer current-access' })
      return new Response(JSON.stringify({ data: latestUser }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as typeof fetch

    await expect(getCurrentAdminUser('current-access')).resolves.toEqual(latestUser)
  })
})
