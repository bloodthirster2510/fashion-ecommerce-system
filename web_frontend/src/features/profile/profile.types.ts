export type AccountSection = 'profile' | 'orders' | 'favorites' | 'ranking' | 'coupons' | 'payment'

export type ProfileFormValues = {
  name: string
  phone: string
  gender: 'male' | 'female'
  dateOfBirth: string
  email: string
  streetName?: string
  provinceCode?: string
  wardCode?: string
}

export type PasswordFormValues = {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}
