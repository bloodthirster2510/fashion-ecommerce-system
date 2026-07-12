type SecureStoreModule = typeof import('expo-secure-store');

const HISTORY_KEY = 'search_history';
const MAX_HISTORY = 10;

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
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
};

export const addSearchHistory = async (keyword: string): Promise<void> => {
  const trimmed = keyword.trim();
  if (!trimmed) return;
  try {
    const current = await getSearchHistory();
    const next = [trimmed, ...current.filter((k) => k !== trimmed)].slice(0, MAX_HISTORY);
    await writeRaw(JSON.stringify(next));
  } catch {
    // Ignore storage errors
  }
};

export const removeSearchHistory = async (keyword: string): Promise<void> => {
  try {
    const current = await getSearchHistory();
    const next = current.filter((k) => k !== keyword);
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