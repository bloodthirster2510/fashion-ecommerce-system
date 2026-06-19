import { requestCustomer } from '../../services/customerHttp'
import type { AuthUser } from '../auth/auth.types'

export type UserAddress = {
  _id?: string
  customerName: string
  province: string
  ward: string
  streetName: string
  phoneNumber: string
  isDefault: boolean
}

export type UpdateProfilePayload = {
  name: string
  phone: string
  gender: 'male' | 'female'
  dateOfBirth: string
}

export type ChangePasswordPayload = {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

const request = requestCustomer

export const profileService = {
  getMe() {
    return request<AuthUser>('/users/me')
  },

  async updateMe(payload: UpdateProfilePayload) {
    return request<AuthUser>('/users/me', {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },

  getAddresses() {
    return request<UserAddress[]>('/users/me/addresses')
  },

  updateAddress(addressId: string, payload: Partial<UserAddress>) {
    return request<UserAddress[]>(`/users/me/addresses/${addressId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },

  changePassword(payload: ChangePasswordPayload) {
    return request<null>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
}
