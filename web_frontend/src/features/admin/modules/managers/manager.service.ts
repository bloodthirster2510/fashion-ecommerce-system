import { requestAdmin } from '../../services/adminHttp'
import type {
  CreateStaffPayload,
  InternalAccount,
  InternalAccountFilters,
  InternalAccountList,
  StaffPermission,
} from './manager.types'

export const listInternalAccounts = (filters: InternalAccountFilters) => {
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

  return requestAdmin<InternalAccountList>(`/admin/accounts?${params.toString()}`)
}

export const createStaffAccount = (payload: CreateStaffPayload) =>
  requestAdmin<InternalAccount>('/admin/accounts/staff', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const updateStaffStatus = (id: string, isActive: boolean) =>
  requestAdmin<InternalAccount>(`/admin/accounts/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  })

export const updateStaffPermissions = (id: string, permissions: StaffPermission[]) =>
  requestAdmin<InternalAccount>(`/admin/accounts/${id}/permissions`, {
    method: 'PATCH',
    body: JSON.stringify({ permissions }),
  })

export const resetStaffTemporaryPassword = (id: string, temporaryPassword: string) =>
  requestAdmin<InternalAccount>(`/admin/accounts/${id}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ temporaryPassword }),
  })
