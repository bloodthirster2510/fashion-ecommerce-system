export type AccountSection = 'profile' | 'orders' | 'favorites' | 'ranking' | 'coupons'

export type ProfileFormValues = {
  name: string
  phone: string
  gender: 'male' | 'female'
  dateOfBirth: string
  email: string
  streetName?: string
  provinceId?: number
  districtId?: number
  wardCode?: string
}

export type PasswordFormValues = {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}
