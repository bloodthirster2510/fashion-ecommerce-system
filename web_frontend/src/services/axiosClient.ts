// Backend local đang chạy theo PORT=5000 trong backend/.env.
// Khi deploy hoặc đổi port, khai báo VITE_API_BASE_URL để ghi đè URL mặc định này.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'

export const axiosClient = {
  baseURL: API_BASE_URL,
}
