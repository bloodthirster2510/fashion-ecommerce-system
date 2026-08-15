export type ApiValidationError = {
  field: string
  message: string
}

// Shape response thống nhất mà backend trả về cho API auth và location.
export type ApiResponse<T> = {
  message?: string
  data?: T
  errors?: ApiValidationError[]
  errorCode?: string
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

export type OtpDeliveryInfo = {
  mode: 'mock' | 'real'
  provider: 'mock' | 'twilio' | 'esms'
  testOtp?: string
}

export type EmailDeliveryInfo = {
  mode: 'mock' | 'real'
  provider: 'mock' | 'smtp'
  testToken?: string
  testUrl?: string
}

export type PasswordRecoveryResult =
  | { method: 'email'; delivery?: EmailDeliveryInfo }
  | { method: 'phone'; delivery?: OtpDeliveryInfo }

export type LoginUnlockResult = {
  method: 'email' | 'phone'
  delivery: {
    mode: 'mock' | 'real'
    provider: 'mock' | 'smtp' | 'twilio' | 'esms'
    testOtp?: string
  }
}

// Contract gửi lên POST /auth/register.
// address là địa chỉ giao hàng mặc định được tạo cùng user.
export type RegisterPayload = {
  name: string
  phone: string
  email?: string
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
  status?: number
  errorCode?: string
  data?: unknown

  constructor(
    message: string,
    errors?: ApiValidationError[],
    status?: number,
    errorCode?: string,
    data?: unknown,
  ) {
    super(message)
    this.name = 'AuthApiError'
    this.errors = errors
    this.status = status
    this.errorCode = errorCode
    this.data = data
  }
}
