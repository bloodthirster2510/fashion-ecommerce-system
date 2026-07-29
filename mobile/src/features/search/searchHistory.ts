import { apiFetch } from '../../config/api';
import { getRecommendationSessionId } from '../recommendation/recommendationSession';

type SecureStoreModule = typeof import('expo-secure-store');

const HISTORY_KEY = 'search_history';
const MAX_HISTORY = 10;

export type MobileSearchSource =
  | 'mobile_manual'
  | 'mobile_history'
  | 'mobile_suggestion';

const fallbackStore = new Map<string, string>();
let secureStorePromise: Promise<SecureStoreModule | null> | null = null;

declare const require: (moduleName: string) => unknown;

const loadSecureStore = async (): Promise<SecureStoreModule | null> => {
  if (!secureStorePromise) {
    secureStorePromise = Promise.resolve()
      .then(() => require('expo-secure-store') as SecureStoreModule)
      .catch(() => null);
  }
  return secureStorePromise;
};

const readRaw = async (): Promise<string | null> => {
  const secureStore = await loadSecureStore();
  if (secureStore) {
    return secureStore.getItem(HISTORY_KEY);
  }
  return fallbackStore.get(HISTORY_KEY) ?? null;
};

const writeRaw = async (value: string): Promise<void> => {
  const secureStore = await loadSecureStore();
  if (secureStore) {
    secureStore.setItem(HISTORY_KEY, value);
  } else {
    fallbackStore.set(HISTORY_KEY, value);
  }
};

export const getSearchHistory = async (): Promise<string[]> => {
  try {
    const raw = await readRaw();
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
};

const normalizeKeyword = (keyword: string) =>
  keyword.trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi-VN');

export const mergeSearchHistory = (
  primary: string[],
  secondary: string[],
  limit = MAX_HISTORY,
) => {
  const seen = new Set<string>();

  return [...primary, ...secondary]
    .map((keyword) => keyword.trim().replace(/\s+/g, ' '))
    .filter((keyword) => {
      const key = normalizeKeyword(keyword);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
};

export const createSearchEventId = () =>
  `mobile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

export const addSearchHistory = async (keyword: string): Promise<void> => {
  const trimmed = keyword.trim();
  if (!trimmed) return;
  try {
    const current = await getSearchHistory();
    const next = mergeSearchHistory([trimmed], current);
    await writeRaw(JSON.stringify(next));
  } catch {
    // Ignore storage errors
  }
};

export const removeSearchHistory = async (keyword: string): Promise<void> => {
  try {
    const current = await getSearchHistory();
    const keywordKey = normalizeKeyword(keyword);
    const next = current.filter((item) => normalizeKeyword(item) !== keywordKey);
    await writeRaw(JSON.stringify(next));
  } catch {
    // Ignore storage errors
  }
};

export const clearSearchHistory = async (): Promise<void> => {
  try {
    const secureStore = await loadSecureStore();
    if (secureStore) {
      await secureStore.deleteItemAsync(HISTORY_KEY);
    } else {
      fallbackStore.delete(HISTORY_KEY);
    }
  } catch {
    // Ignore storage errors
  }
};

type SearchHistoryApiResponse<T> = {
  message?: string;
  data?: T;
};

const requestSearchHistory = async <T>(
  path: string,
  token: string,
  init?: Parameters<typeof apiFetch>[1],
) => {
  const sessionId = await getRecommendationSessionId();
  const response = await apiFetch(path, {
    ...init,
    headers: {
      'X-Session-Id': sessionId,
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
  const payload = (await response.json()) as SearchHistoryApiResponse<T>;

  if (!response.ok || payload.data === undefined) {
    throw Object.assign(
      new Error(payload.message || 'Không thể đồng bộ lịch sử tìm kiếm'),
      { status: response.status },
    );
  }

  return payload.data;
};

export const syncSearchHistory = async (token: string): Promise<string[]> => {
  const localHistory = await getSearchHistory();
  const result = await requestSearchHistory<{
    keywords: Array<{ keyword: string; lastSearchedAt: string }>;
  }>('/search-history/sync?limit=10', token, { method: 'POST' });
  const merged = mergeSearchHistory(
    localHistory,
    result.keywords.map((item) => item.keyword),
  );

  await writeRaw(JSON.stringify(merged));
  return merged;
};

export const deleteServerSearchHistory = async (
  token: string,
  keyword?: string,
): Promise<void> => {
  const query = keyword ? `?keyword=${encodeURIComponent(keyword)}` : '';
  await requestSearchHistory<{ deletedCount: number }>(
    `/search-history/me${query}`,
    token,
    { method: 'DELETE' },
  );
};
