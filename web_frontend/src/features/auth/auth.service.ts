import { axiosClient } from '../../services/axiosClient'
import { tokenService } from '../../services/tokenService'
import type { ApiResponse, AuthSession, LoginUnlockResult, OtpDeliveryInfo, Province, RegisterPayload, Ward } from './auth.types'
import { AuthApiError } from './auth.types'

const REFRESH_TOKEN_COOKIE_MODE_HEADER = 'X-Refresh-Token-Mode'

// Tất cả API auth và location đều trả về dạng { message, data, errors }.
// Gom logic parse response tại đây giúp component chỉ xử lý dữ liệu thành công hoặc AuthApiError.
const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  let response: Response

  try {
    response = await axiosClient.fetch(path, {
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
    throw new AuthApiError(body.message || 'Không thể xử lý yêu cầu.', body.errors, response.status, body.errorCode, body.data)
  }

  if (body.data === undefined) {
    throw new AuthApiError('Phản hồi từ server không hợp lệ.')
  }

  return body.data
}

// Web chỉ giữ accessToken trong memory. Refresh token nằm trong httpOnly cookie do backend set.
const saveSession = (session: AuthSession) => {
  tokenService.setAccessToken(session.accessToken)
  tokenService.setCurrentUser(session.user)
}

export const authService = {
  async login(identifier: string, password: string) {
    const session = await request<AuthSession>('/auth/login', {
      method: 'POST',
      headers: {
        [REFRESH_TOKEN_COOKIE_MODE_HEADER]: 'cookie',
      },
      body: JSON.stringify({ identifier, password }),
    })

    saveSession(session)
    return session
  },

  requestLoginUnlock(identifier: string, channel: 'email' | 'phone') {
    return request<LoginUnlockResult>('/auth/login/unlock/request', {
      method: 'POST',
      body: JSON.stringify({ identifier, channel }),
    })
  },

  verifyLoginUnlock(identifier: string, otp: string) {
    return request<null>('/auth/login/unlock/verify', {
      method: 'POST',
      body: JSON.stringify({ identifier, otp }),
    })
  },

  sendOtp(phone: string) {
    return request<OtpDeliveryInfo>('/auth/send-otp', {
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
      headers: {
        [REFRESH_TOKEN_COOKIE_MODE_HEADER]: 'cookie',
      },
      body: JSON.stringify(payload),
    })

    saveSession(session)
    return session
  },

  async logout(accessToken?: string | null) {
    await axiosClient.fetch('/auth/logout', {
      method: 'POST',
      headers: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        'Content-Type': 'application/json',
        [REFRESH_TOKEN_COOKIE_MODE_HEADER]: 'cookie',
      },
    }).catch(() => undefined)
  },

  getProvinces() {
    return request<Province[]>('/locations/provinces')
  },

  getWards(provinceCode: number) {
    return request<Ward[]>(`/locations/provinces/${provinceCode}/wards`)
  },
}
