const ACCESS_TOKEN_KEY = 'accessToken'
const REFRESH_TOKEN_KEY = 'refreshToken'
const CURRENT_USER_KEY = 'currentUser'

type StoredUser = {
  _id: string
  name: string
  email: string
  phone: string
  role: string
  gender?: 'male' | 'female'
  dateOfBirth?: string
  avatarImage?: string | null
}

// Bọc localStorage trong một service nhỏ để component không phụ thuộc trực tiếp
// vào key lưu trữ. Sau này đổi nơi lưu token chỉ cần sửa tại file này.
export const tokenService = {
  getAccessToken() {
    return localStorage.getItem(ACCESS_TOKEN_KEY)
  },
  setAccessToken(token: string) {
    localStorage.setItem(ACCESS_TOKEN_KEY, token)
  },
  clearAccessToken() {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
  },
  getRefreshToken() {
    return localStorage.getItem(REFRESH_TOKEN_KEY)
  },
  setRefreshToken(token: string) {
    localStorage.setItem(REFRESH_TOKEN_KEY, token)
  },
  clearRefreshToken() {
    localStorage.removeItem(REFRESH_TOKEN_KEY)
  },
  getCurrentUser(): StoredUser | null {
    const rawUser = localStorage.getItem(CURRENT_USER_KEY)
    if (!rawUser) return null

    try {
      return JSON.parse(rawUser) as StoredUser
    } catch {
      // Nếu dữ liệu user trong localStorage bị hỏng, xóa nó để header không render sai.
      localStorage.removeItem(CURRENT_USER_KEY)
      return null
    }
  },
  setCurrentUser(user: StoredUser) {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user))
  },
  clearCurrentUser() {
    localStorage.removeItem(CURRENT_USER_KEY)
  },
  clearSession() {
    // Đăng xuất cần xóa token và user để header quay lại trạng thái "Đăng nhập".
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem(CURRENT_USER_KEY)
  },
}
