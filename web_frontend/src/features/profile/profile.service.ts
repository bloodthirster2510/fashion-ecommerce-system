import { requestCustomer } from '../../services/customerHttp'
import type { AuthUser } from '../auth/auth.types'

export type UserAddress = {
  _id?: string
  customerName: string
  province: string
  provinceCode?: string | null
  provinceId?: number | null
  district?: string | null
  districtId?: number | null
  ward: string
  wardCode?: string
  streetName: string
  phoneNumber: string
  ghnProvinceId?: number | null
  ghnDistrictId?: number | null
  ghnWardCode?: string | null
  ghnMappingStatus?: 'mapped' | 'missing' | 'manual'
  ghnMappingConfidence?: 'exact' | 'manual' | 'legacy' | null
  ghnMappingVerifiedAt?: string | null
  isDefault: boolean
}

type GhnMasterDataResponse<T> = {
  data: T[]
}

export type GhnProvince = {
  ProvinceID: number
  ProvinceName: string
}

export type GhnDistrict = {
  DistrictID: number
  DistrictName: string
  ProvinceID?: number
}

export type GhnWard = {
  WardCode: string
  WardName: string
  DistrictID?: number
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

export type UploadAvatarPayload = {
  imageBase64: string
  mimeType: string
}

export type MembershipTier = {
  _id?: string
  name: string
  level: number
  minPoint: number
  maxPoint: number | null
  discountPercent: number
  benefitDescription: string
  cardColor?: string | null
  textColor?: string | null
  badgeColor?: string | null
  iconName?: string | null
}

export type UserMembership = {
  currentTier: MembershipTier | null
  nextTier: MembershipTier | null
  loyaltyPoint: number
  pointToNextTier: number | null
  progressPercent: number
  tiers: MembershipTier[]
}

export type CustomerCoupon = {
  _id: string
  code: string
  name: string
  description?: string | null
  discountType: 'percent' | 'fixed' | 'free_shipping'
  discountValue: number
  maxDiscountAmount?: number | null
  minOrderAmount: number
  endAt: string
}

export type AvailableCouponItem = {
  coupon: CustomerCoupon
  isApplicable: boolean | null
  reason: string | null
  estimatedDiscountAmount: number
  estimatedShippingDiscountAmount: number
}

export type AvailableCouponsResponse = {
  items: AvailableCouponItem[]
  pagination: {
    page: number
    limit: number
    totalItems: number
    totalPages: number
  }
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

  addAddress(payload: UserAddress) {
    return request<UserAddress[]>('/users/me/addresses', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  getMembership() {
    return request<UserMembership>('/users/me/membership')
  },

  getAvailableCoupons(payload: { cartItemIds?: string[]; paymentMethod?: 'COD' | 'VNPAY'; page?: number; limit?: number } = {}) {
    return request<AvailableCouponsResponse>('/coupons/available', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  async getGhnProvinces() {
    const result = await request<GhnMasterDataResponse<GhnProvince>>('/ghn/provinces')
    return result.data
  },

  async getGhnDistricts(provinceId: number) {
    const result = await request<GhnMasterDataResponse<GhnDistrict>>(`/ghn/districts?provinceId=${provinceId}`)
    return result.data
  },

  async getGhnWards(districtId: number) {
    const result = await request<GhnMasterDataResponse<GhnWard>>(`/ghn/wards?districtId=${districtId}`)
    return result.data
  },

  updateAddress(addressId: string, payload: Partial<UserAddress>) {
    return request<UserAddress[]>(`/users/me/addresses/${addressId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },

  deleteAddress(addressId: string) {
    return request<null>(`/users/me/addresses/${addressId}`, {
      method: 'DELETE',
    })
  },

  setDefaultAddress(addressId: string) {
    return request<UserAddress[]>(`/users/me/addresses/${addressId}/default`, {
      method: 'PATCH',
    })
  },

  uploadAvatar(payload: UploadAvatarPayload) {
    return request<AuthUser>('/users/me/avatar', {
      method: 'POST',
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
