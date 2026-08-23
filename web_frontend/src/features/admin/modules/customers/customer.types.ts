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

export type ManagedCustomerOrder = {
  _id: string
  orderCode: string
  totalAmount: number
  status: string
  paymentMethod: string
  paymentStatus: string
  createdAt: string
}

export type ManagedCustomerActivity = {
  id: string
  type:
    | 'account'
    | 'order'
    | 'support'
    | 'review'
    | 'interaction'
    | 'virtual_try_on'
    | 'audit'
  title: string
  description: string
  occurredAt: string
  metadata?: Record<string, unknown>
  actor?: {
    id: string
    name?: string
    email?: string
    avatarImage?: string | null
    role: string
  }
}

export type ManagedCustomerInsights = {
  orders: {
    totalOrders: number
    successfulOrders: number
    totalSpent: number
    recentOrders: ManagedCustomerOrder[]
  }
  activity: {
    items: ManagedCustomerActivity[]
    pagination: {
      page: number
      limit: number
      totalItems: number
      totalPages: number
    }
  }
}

export type ManagedCustomerNoteAuthor = {
  _id: string
  name?: string
  email?: string
  avatarImage?: string | null
}

export type ManagedCustomerNote = {
  _id: string
  customerId: string
  content: string
  createdBy: ManagedCustomerNoteAuthor | string
  updatedBy: ManagedCustomerNoteAuthor | string
  createdAt: string
  updatedAt: string
}
