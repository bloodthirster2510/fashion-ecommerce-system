export type StaffPermission =
  | 'products.read'
  | 'products.write'
  | 'catalog.read'
  | 'catalog.write'
  | 'orders.read'
  | 'orders.update'
  | 'inventory.read'
  | 'inventory.write'
  | 'promotions.read'
  | 'promotions.write'
  | 'loyalty.read'
  | 'loyalty.write'
  | 'customers.read'
  | 'customers.manage'
  | 'reviews.moderate'
  | 'support.reply'
  | 'reports.read'

export type InternalAccountRole = 'admin' | 'staff'

export type InternalAccount = {
  _id: string
  name: string
  email: string
  phone?: string
  role: InternalAccountRole
  permissions?: StaffPermission[]
  mustChangePassword?: boolean
  isActive: boolean
  createdAt?: string
  updatedAt?: string
  lastLoginAt?: string
  passwordChangedAt?: string
}

export type InternalAccountList = {
  items: InternalAccount[]
  totalItems: number
  page: number
  limit: number
  totalPages: number
}

export type InternalAccountFilters = {
  keyword?: string
  role?: InternalAccountRole | 'all'
  status?: 'all' | 'active' | 'blocked'
  page?: number
  limit?: number
}

export type CreateStaffPayload = {
  name: string
  email: string
  phone?: string
  password: string
  permissions: StaffPermission[]
}
