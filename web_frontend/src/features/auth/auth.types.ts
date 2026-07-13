export type ApiValidationError = {
  field: string
  message: string
}

// Shape response thống nhất mà backend trả về cho API auth và location.
export type ApiResponse<T> = {
  message?: string
  data?: T
  errors?: ApiValidationError[]
}

export type AuthUser = {
  _id: string
  name: string
  email: string
  phone: string
  role: string
  gender?: 'male' | 'female'
  dateOfBirth?: string
  avatarImage?: string | null
}

// Sau login hoặc register thành công, backend trả phiên đăng nhập mới.
export type AuthSession = {
  accessToken: string
  refreshToken?: string
  user: AuthUser
}

// Contract gửi lên POST /auth/register.
// address là địa chỉ giao hàng mặc định được tạo cùng user.
export type RegisterPayload = {
  name: string
  phone: string
  email: string
  gender: 'male' | 'female'
  dateOfBirth: string
  address: {
    customerName: string
    province: string
    ward: string
    streetName: string
    phoneNumber: string
    isDefault: boolean
  }
  password: string
  confirmPassword: string
  otpToken: string
  acceptedTerms: true
  policyVersion: string
}

export type Province = {
  name: string
  code: number
}

export type Ward = {
  name: string
  code: number
}

export class AuthApiError extends Error {
  errors?: ApiValidationError[]

  constructor(message: string, errors?: ApiValidationError[]) {
    super(message)
    this.name = 'AuthApiError'
    this.errors = errors
  }
}
