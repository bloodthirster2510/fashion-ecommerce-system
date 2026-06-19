import { API_BASE_URL } from '../config/api'

const normalizeApiPath = (path: string) => (path.startsWith('/') ? path : `/${path}`)

const buildUrl = (path: string) => `${API_BASE_URL}${normalizeApiPath(path)}`

export const axiosClient = {
  baseURL: API_BASE_URL,
  buildUrl,
  fetch(path: string, init?: RequestInit) {
    return fetch(buildUrl(path), {
      credentials: 'include',
      ...init,
    })
  },
}
