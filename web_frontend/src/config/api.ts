const DEFAULT_API_PORT = '5000'
const DEFAULT_API_BASE_PATH = '/api'
const LOCALHOST_ALIASES = new Set(['localhost', '127.0.0.1', '0.0.0.0'])

const isPrivateLanHost = (hostname: string) =>
  hostname.startsWith('192.168.') ||
  hostname.startsWith('10.') ||
  /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '')
const runtimeEnv = (import.meta as ImportMeta & { readonly env?: ImportMetaEnv }).env

const getDefaultApiBaseUrl = () => {
  if (typeof window === 'undefined') {
    return `http://localhost:${DEFAULT_API_PORT}${DEFAULT_API_BASE_PATH}`
  }

  const { hostname } = window.location
  const apiHost = hostname === '0.0.0.0' ? 'localhost' : hostname

  if (runtimeEnv?.DEV && (LOCALHOST_ALIASES.has(hostname) || isPrivateLanHost(hostname))) {
    return `http://${apiHost}:${DEFAULT_API_PORT}${DEFAULT_API_BASE_PATH}`
  }

  return `http://localhost:${DEFAULT_API_PORT}${DEFAULT_API_BASE_PATH}`
}

export const API_BASE_URL = normalizeBaseUrl(
  runtimeEnv?.VITE_API_BASE_URL ??
    runtimeEnv?.VITE_API_URL ??
    getDefaultApiBaseUrl(),
)
