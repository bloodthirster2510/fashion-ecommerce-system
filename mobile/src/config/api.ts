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

const fetchWithTimeout = async (url: string, init?: ApiFetchInit) => {
  const { timeoutMs = requestTimeoutMs, retryOnTimeout: _retryOnTimeout, ...fetchInit } = init ?? {};
  const controller = new AbortController();
  const callerSignal = fetchInit.signal;
  const abortFromCaller = () => controller.abort();
  const timedOutRef = { current: false };
  const timeout = setTimeout(() => {
    timedOutRef.current = true;
    controller.abort();
  }, timeoutMs);

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
  } catch (error) {
    const isCallerAbort = callerSignal?.aborted && !timedOutRef.current;
    if (isCallerAbort) {
      throw new DOMException('Aborted by caller', 'AbortError');
    }
    throw error;
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
  const method = init?.method?.toUpperCase() ?? 'GET';
  const headers = new Headers(init?.headers);
  const isRead = method === 'GET' || method === 'HEAD';
  const fetchInit: ApiFetchInit = {
    ...init,
    // Public reads may use the platform HTTP cache and validators. Authenticated
    // data and writes are kept out of the shared native HTTP cache.
    cache: init?.cache ?? (isRead && !headers.has('Authorization') ? 'no-cache' : 'no-store'),
    headers,
  };
  const retryOnTimeout = init?.retryOnTimeout ?? ['GET', 'HEAD', 'OPTIONS'].includes(method);
  // Reads may fail over across known endpoints, including after session restore.
  // Writes stay on one endpoint unless a caller explicitly opts into replay.
  const baseUrls = retryOnTimeout
    ? getOrderedApiBaseUrls()
    : [preferredApiBaseUrl ?? API_BASE_URL];

  const callerAborted = init?.signal?.aborted === true;

  for (const [index, baseUrl] of baseUrls.entries()) {
    const requestUrl = `${baseUrl}${normalizedPath}`;

    try {
      const response = await fetchWithTimeout(requestUrl, fetchInit);
      preferredApiBaseUrl = baseUrl;
      return response;
    } catch (error) {
      const abortedByCaller = callerAborted || isAbortError(error);

      if (!isNetworkError(error)) {
        throw error;
      }

      if (!retryOnTimeout && abortedByCaller) {
        throw error;
      }

      if (abortedByCaller) {
        throw error;
      }

      if (__DEV__) {
        console.warn(`[API] Request failed for candidate ${index + 1}/${baseUrls.length}`, error);
      }
    }
  }

  throw new Error('Không thể kết nối máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại.');
};
