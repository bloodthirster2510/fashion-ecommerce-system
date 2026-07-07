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

export type ManagedUserList = {
  items: ManagedUser[]
  totalItems: number
  page: number
  limit: number
  totalPages: number
}

export type ManagedUserSummary = {
  total: number
  active: number
  blocked: number
  completedProfiles: number
  activeLast30Days: number
  newLast7Days: number
}

export type ManagedUserFilters = {
  keyword?: string
  role?: ManagedUserRole | 'all'
  status?: 'all' | 'active' | 'blocked'
  page?: number
  limit?: number
}
