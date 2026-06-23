import { NativeModules, Platform } from 'react-native';

const DEFAULT_DEV_API_PORT = '5000';
const DEFAULT_REQUEST_TIMEOUT_MS = 8000;

type ApiFetchInit = Parameters<typeof fetch>[1] & {
  timeoutMs?: number;
  retryOnTimeout?: boolean;
};

const getHostFromMetro = () => {
  const scriptURL = NativeModules.SourceCode?.scriptURL;

  if (!scriptURL) {
    return undefined;
  }

  return scriptURL.match(/^[a-z]+:\/\/([^/:]+)/i)?.[1];
};

const getDefaultDevApiHost = () =>
  getHostFromMetro() ??
  Platform.select({
    android: '10.0.2.2',
    ios: 'localhost',
    default: 'localhost',
  }) ?? 'localhost';

const trimTrailingSlashes = (url: string) => url.replace(/\/+$/, '');
const compactUnique = (values: Array<string | undefined>) =>
  Array.from(new Set(values.filter((value): value is string => Boolean(value))));

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const configuredApiHost = process.env.EXPO_PUBLIC_API_HOST?.trim();
const configuredApiPort = process.env.EXPO_PUBLIC_API_PORT?.trim() || DEFAULT_DEV_API_PORT;
const configuredRequestTimeoutMs = Number(process.env.EXPO_PUBLIC_API_TIMEOUT_MS);
const requestTimeoutMs = Number.isFinite(configuredRequestTimeoutMs)
  ? configuredRequestTimeoutMs
  : DEFAULT_REQUEST_TIMEOUT_MS;

const toApiUrl = (host: string) => `http://${host}:${configuredApiPort}/api`;
const defaultApiUrl = toApiUrl(configuredApiHost || getDefaultDevApiHost());
const fallbackApiUrls = compactUnique([
  configuredApiUrl ? trimTrailingSlashes(configuredApiUrl) : undefined,
  defaultApiUrl,
  getHostFromMetro() ? toApiUrl(getHostFromMetro()!) : undefined,
  Platform.OS === 'android' ? toApiUrl('10.0.2.2') : undefined,
  toApiUrl('localhost'),
]).map(trimTrailingSlashes);

export const API_BASE_URLS = fallbackApiUrls;
export const API_BASE_URL = API_BASE_URLS[0];
let preferredApiBaseUrl: string | undefined;

if (__DEV__) {
  console.log('[API] Base URL candidates configured', API_BASE_URLS.length);
}

const isNetworkError = (error: unknown) =>
  error instanceof TypeError ||
  (error instanceof Error && /Network request failed|Failed to fetch|Load failed|AbortError|aborted/i.test(error.message)) ||
  (typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError');

const isAbortError = (error: unknown) =>
  (error instanceof Error && /AbortError|aborted/i.test(error.message)) ||
  (typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError');

const hasAuthorizationHeader = (headers: ApiFetchInit['headers']) => {
  if (!headers) {
    return false;
  }

  if (typeof Headers !== 'undefined' && headers instanceof Headers) {
    return headers.has('authorization');
  }

  if (Array.isArray(headers)) {
    return headers.some(([key]) => key.toLowerCase() === 'authorization');
  }

  return Object.keys(headers).some((key) => key.toLowerCase() === 'authorization');
};

const fetchWithTimeout = async (url: string, init?: ApiFetchInit) => {
  const { timeoutMs = requestTimeoutMs, retryOnTimeout: _retryOnTimeout, ...fetchInit } = init ?? {};
  const controller = new AbortController();
  const callerSignal = fetchInit.signal;
  const abortFromCaller = () => controller.abort();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  if (callerSignal?.aborted) {
    controller.abort();
  } else {
    callerSignal?.addEventListener('abort', abortFromCaller, { once: true });
  }

  try {
    return await fetch(url, {
      ...fetchInit,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
    callerSignal?.removeEventListener('abort', abortFromCaller);
  }
};

const getOrderedApiBaseUrls = () => {
  if (!preferredApiBaseUrl || !API_BASE_URLS.includes(preferredApiBaseUrl)) {
    return API_BASE_URLS;
  }

  return [
    preferredApiBaseUrl,
    ...API_BASE_URLS.filter((baseUrl) => baseUrl !== preferredApiBaseUrl),
  ];
};

export const apiFetch = async (path: string, init?: ApiFetchInit) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const retryOnTimeout = init?.retryOnTimeout ?? true;
  // Keep authenticated calls on the endpoint that successfully handled login.
  // Using the first configured URL here breaks devices when login succeeds
  // through a later LAN or Metro-derived candidate.
  const baseUrls = hasAuthorizationHeader(init?.headers)
    ? [preferredApiBaseUrl ?? API_BASE_URL]
    : getOrderedApiBaseUrls();

  for (const [index, baseUrl] of baseUrls.entries()) {
    const requestUrl = `${baseUrl}${normalizedPath}`;

    try {
      const response = await fetchWithTimeout(requestUrl, init);
      preferredApiBaseUrl = baseUrl;
      return response;
    } catch (error) {
      if (!isNetworkError(error)) {
        throw error;
      }

      if (!retryOnTimeout && isAbortError(error)) {
        throw error;
      }

      if (__DEV__) {
        console.warn(`[API] Request failed for candidate ${index + 1}/${baseUrls.length}`, error);
      }
    }
  }

  throw new Error('Không thể kết nối máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại.');
};
