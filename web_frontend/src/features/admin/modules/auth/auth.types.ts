export type AdminRole = 'admin' | 'staff'

export type AdminUser = {
  _id: string
  name: string
  email: string
  phone?: string
  role: string
  permissions?: string[]
  mustChangePassword?: boolean
  avatarImage?: string | null
  profileCompleted?: boolean
}

export type AdminSession = {
  accessToken: string
  refreshToken: string
  user: AdminUser
}

export type AdminLoginCredentials = {
  identifier: string
  password: string
}

export type ChangePasswordPayload = {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}
