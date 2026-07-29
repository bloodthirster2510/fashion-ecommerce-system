import { requestAdmin } from '../../services/adminHttp'
import type {
  ManagedUser,
  ManagedUserFilters,
  ManagedUserList,
  ManagedUserRole,
  ManagedUserSummary,
} from './customer.types'

type ManagedUserApiResponse = Omit<ManagedUser, 'isActive'> & {
  isActive?: boolean | string
  status?: string
}

const normalizeManagedUserStatus = (user: ManagedUserApiResponse): ManagedUser => {
  const rawStatus = typeof user.status === 'string' ? user.status.toLowerCase() : undefined
  const rawIsActive = user.isActive

  if (typeof rawIsActive === 'boolean') {
    return { ...user, isActive: rawIsActive }
  }

  if (typeof rawIsActive === 'string') {
    return { ...user, isActive: ['true', 'active', 'enabled'].includes(rawIsActive.toLowerCase()) }
  }

  if (rawStatus) {
    return { ...user, isActive: ['active', 'enabled'].includes(rawStatus) }
  }

  return { ...user, isActive: false }
}

export const listManagedUsers = (filters: ManagedUserFilters) => {
  const params = new URLSearchParams()
  const keyword = filters.keyword?.trim()

  if (keyword) {
    params.set('keyword', keyword)
  }

  if (filters.role && filters.role !== 'all') {
    params.set('role', filters.role)
  }

  if (filters.status === 'active') {
    params.set('isActive', 'true')
  }

  if (filters.status === 'blocked') {
    params.set('isActive', 'false')
  }

  params.set('page', String(filters.page ?? 1))
  params.set('limit', String(filters.limit ?? 10))

  return requestAdmin<ManagedUserList & { items: ManagedUserApiResponse[] }>(`/admin/users?${params.toString()}`)
    .then((result) => ({
      ...result,
      items: result.items.map(normalizeManagedUserStatus),
    }))
}

export const getManagedUser = (id: string) =>
  requestAdmin<ManagedUserApiResponse>(`/admin/users/${id}`).then(normalizeManagedUserStatus)

export const getManagedUserSummary = (keyword = '') => {
  const params = new URLSearchParams()
  const trimmedKeyword = keyword.trim()

  if (trimmedKeyword) {
    params.set('keyword', trimmedKeyword)
  }

  const query = params.toString()
  return requestAdmin<ManagedUserSummary>(`/admin/users/summary${query ? `?${query}` : ''}`)
}

export const updateManagedUserStatus = (id: string, isActive: boolean) =>
  requestAdmin<ManagedUserApiResponse>(`/admin/users/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  }).then(normalizeManagedUserStatus)

export const updateManagedUserRole = (id: string, role: ManagedUserRole) =>
  requestAdmin<ManagedUserApiResponse>(`/admin/users/${id}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  }).then(normalizeManagedUserStatus)

export type PasswordResetDeliveryInfo = {
  mode: 'mock' | 'real'
  provider: 'mock' | 'smtp'
  testToken?: string
  testUrl?: string
}

export const forceManagedUserPasswordReset = (id: string) =>
  requestAdmin<PasswordResetDeliveryInfo>(`/admin/users/${id}/force-password-reset`, {
    method: 'POST',
  })
