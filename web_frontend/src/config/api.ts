const DEFAULT_API_BASE_URL = 'http://localhost:5000/api'

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '')
const runtimeEnv = (import.meta as ImportMeta & { readonly env?: ImportMetaEnv }).env

export const API_BASE_URL = normalizeBaseUrl(
  runtimeEnv?.VITE_API_BASE_URL ??
    runtimeEnv?.VITE_API_URL ??
    DEFAULT_API_BASE_URL,
)
