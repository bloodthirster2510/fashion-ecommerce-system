const ACCESS_TOKEN_KEY = 'accessToken'
const REFRESH_TOKEN_KEY = 'refreshToken'
const CURRENT_USER_KEY = 'currentUser'

let runtimeAccessToken: string | null = null

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

const clearLegacyTokenStorage = () => {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

// Bọc session trong một service nhỏ để component không phụ thuộc trực tiếp
// vào key lưu trữ. Token chỉ giữ trong memory; localStorage chỉ còn user profile.
export const tokenService = {
  getAccessToken() {
    clearLegacyTokenStorage()
    return runtimeAccessToken
  },
  setAccessToken(token: string) {
    runtimeAccessToken = token
    clearLegacyTokenStorage()
  },
  clearAccessToken() {
    runtimeAccessToken = null
    clearLegacyTokenStorage()
  },
  getRefreshToken() {
    clearLegacyTokenStorage()
    return null
  },
  setRefreshToken(token: string) {
    void token
    clearLegacyTokenStorage()
  },
  clearRefreshToken() {
    clearLegacyTokenStorage()
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
    // Đăng xuất cần xóa access token runtime và user để header quay lại trạng thái "Đăng nhập".
    runtimeAccessToken = null
    clearLegacyTokenStorage()
    localStorage.removeItem(CURRENT_USER_KEY)
  },
}
