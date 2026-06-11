import { axiosClient } from '../../services/axiosClient'
import { tokenService } from '../../services/tokenService'
import type { ApiResponse, AuthUser } from '../auth/auth.types'
import { AuthApiError } from '../auth/auth.types'

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

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const accessToken = tokenService.getAccessToken()

  if (!accessToken) {
    throw new AuthApiError('Vui lòng đăng nhập để quản lý tài khoản.')
  }

  let response: Response

  try {
    response = await fetch(`${axiosClient.baseURL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        // Các API /users/me và /auth/change-password đều được bảo vệ bằng JWT.
        // Gắn token tại service để component không phải biết chi tiết xác thực.
        Authorization: `Bearer ${accessToken}`,
        ...init?.headers,
      },
    })
  } catch {
    throw new AuthApiError('Không thể kết nối tới server. Vui lòng kiểm tra backend đang chạy ở port 5000.')
  }

  let body: ApiResponse<T>

  try {
    body = (await response.json()) as ApiResponse<T>
  } catch {
    throw new AuthApiError('Server trả về dữ liệu không hợp lệ.')
  }

  if (!response.ok) {
    throw new AuthApiError(body.message || 'Không thể xử lý yêu cầu.', body.errors)
  }

  if (body.data === undefined) {
    throw new AuthApiError('Phản hồi từ server không hợp lệ.')
  }

  return body.data
}

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
