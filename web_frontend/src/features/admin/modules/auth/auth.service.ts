import type {
  AdminLoginCredentials,
  AdminSession,
  ChangePasswordPayload,
} from './auth.types'

type ApiResponse<T> = {
  message?: string
  data?: T
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  import.meta.env.VITE_API_URL ??
  'http://localhost:5000/api'

const parseResponse = async <T>(response: Response, fallbackMessage: string) => {
  const result = (await response.json().catch(() => ({}))) as ApiResponse<T>

  if (!response.ok || result.data === undefined) {
    throw new Error(result.message || fallbackMessage)
  }

  return result.data
}

export const loginAdmin = async (
  credentials: AdminLoginCredentials,
): Promise<AdminSession> => {
  const response = await fetch(`${API_BASE_URL}/auth/admin/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
  })

  return parseResponse<AdminSession>(response, 'Không thể đăng nhập')
}

export const changeAdminPassword = async (
  accessToken: string,
  payload: ChangePasswordPayload,
) => {
  const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  const result = (await response.json().catch(() => ({}))) as ApiResponse<null>

  if (!response.ok) {
    throw new Error(result.message || 'Không thể đổi mật khẩu')
  }
}
