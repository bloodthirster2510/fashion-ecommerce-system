import { axiosClient } from '../../services/axiosClient'
import { tokenService } from '../../services/tokenService'
import type { ApiResponse, AuthSession, Province, RegisterPayload, Ward } from './auth.types'
import { AuthApiError } from './auth.types'

// Tất cả API auth và location đều trả về dạng { message, data, errors }.
// Gom logic parse response tại đây giúp component chỉ xử lý dữ liệu thành công hoặc AuthApiError.
const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  let response: Response

  try {
    response = await fetch(`${axiosClient.baseURL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    })
  } catch {
    // fetch chỉ ném lỗi tại đây khi request chưa thể nhận response:
    // thường do backend chưa chạy, sai port hoặc mất kết nối mạng.
    throw new AuthApiError('Không thể kết nối tới server. Vui lòng kiểm tra backend đang chạy ở port 5000.')
  }

  let body: ApiResponse<T>

  try {
    body = (await response.json()) as ApiResponse<T>
  } catch {
    // API chuẩn của dự án luôn trả JSON. Nếu nhận HTML hoặc body rỗng,
    // giữ thông báo riêng để phân biệt với lỗi validation từ backend.
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

// Backend trả cả hai token sau khi đăng nhập hoặc đăng ký.
// accessToken dùng cho request cần xác thực; refreshToken dùng để xin accessToken mới khi hết hạn.
const saveSession = (session: AuthSession) => {
  tokenService.setAccessToken(session.accessToken)
  tokenService.setRefreshToken(session.refreshToken)
  tokenService.setCurrentUser(session.user)
}

export const authService = {
  async login(identifier: string, password: string) {
    const session = await request<AuthSession>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    })

    saveSession(session)
    return session
  },

  sendOtp(phone: string) {
    return request<null>('/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    })
  },

  verifyOtp(phone: string, otp: string) {
    return request<{ otpToken: string }>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, otp }),
    })
  },

  async register(payload: RegisterPayload) {
    const session = await request<AuthSession>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    })

    saveSession(session)
    return session
  },

  getProvinces() {
    return request<Province[]>('/locations/provinces')
  },

  getWards(provinceCode: number) {
    return request<Ward[]>(`/locations/provinces/${provinceCode}/wards`)
  },
}
