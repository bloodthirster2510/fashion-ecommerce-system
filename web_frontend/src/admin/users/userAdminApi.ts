import { requestAdmin } from '../adminHttp'

export type ManagedUserRole = 'admin' | 'staff' | 'user'

export type ManagedUserAddress = {
  _id?: string
  customerName?: string
  province?: string
  district?: string | null
  ward?: string
  streetName?: string
  phoneNumber?: string
  isDefault?: boolean
}

export type ManagedUser = {
  _id: string
  name: string
  email: string
  phone?: string
  role: ManagedUserRole
  gender?: 'male' | 'female'
  dateOfBirth?: string
  address?: ManagedUserAddress[]
  loyaltyPoint?: number
  profileCompleted?: boolean
  avatarImage?: string | null
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

type ManagedUserApiResponse = Omit<ManagedUser, 'isActive'> & {
  isActive?: boolean | string
  status?: string
}

export type ManagedUserList = {
  items: ManagedUser[]
  totalItems: number
  page: number
  limit: number
  totalPages: number
}

export type ManagedUserFilters = {
  keyword?: string
  role?: ManagedUserRole | 'all'
  status?: 'all' | 'active' | 'blocked'
  page?: number
  limit?: number
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

export const forceManagedUserPasswordReset = (id: string) =>
  requestAdmin<null>(`/admin/users/${id}/force-password-reset`, {
    method: 'POST',
  })
