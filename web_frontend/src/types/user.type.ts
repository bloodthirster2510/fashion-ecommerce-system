import type { ID } from './common.type'

export type UserRole = 'admin' | 'staff' | 'user'

export type User = {
  _id: ID
  name: string
  email: string
  role: UserRole
}
