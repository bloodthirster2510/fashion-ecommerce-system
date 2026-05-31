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

if (__DEV__) {
  console.log('[API] Base URLs', API_BASE_URLS);
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

export const apiFetch = async (path: string, init?: ApiFetchInit) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const retryOnTimeout = init?.retryOnTimeout ?? true;
  let lastNetworkError: unknown;
  const attemptedUrls: string[] = [];

  for (const baseUrl of API_BASE_URLS) {
    const requestUrl = `${baseUrl}${normalizedPath}`;
    attemptedUrls.push(requestUrl);

    try {
      return await fetchWithTimeout(requestUrl, init);
    } catch (error) {
      if (!isNetworkError(error)) {
        throw error;
      }

      if (!retryOnTimeout && isAbortError(error)) {
        throw error;
      }

      if (__DEV__) {
        console.warn(`[API] Failed ${baseUrl}${normalizedPath}`, error);
      }

      lastNetworkError = error;
    }
  }

  const message =
    lastNetworkError instanceof Error ? lastNetworkError.message : 'Network request failed';

  throw new Error(`${message}. Tried: ${attemptedUrls.join(', ')}`);
};
