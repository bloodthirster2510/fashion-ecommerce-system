type ScreenDataCacheEntry<T> = {
  value: T;
  updatedAt: number;
};

const DEFAULT_MAX_AGE_MS = 5 * 60 * 1000;
const store = new Map<string, ScreenDataCacheEntry<unknown>>();

export const readScreenData = <T>(
  key: string,
  maxAgeMs = DEFAULT_MAX_AGE_MS,
): T | undefined => {
  const entry = store.get(key) as ScreenDataCacheEntry<T> | undefined;
  if (!entry) return undefined;

  if (Date.now() - entry.updatedAt > maxAgeMs) {
    store.delete(key);
    return undefined;
  }

  return entry.value;
};

export const writeScreenData = <T>(key: string, value: T) => {
  store.set(key, { value, updatedAt: Date.now() });
};

export const invalidateScreenData = (keyPrefix?: string) => {
  if (!keyPrefix) {
    store.clear();
    return;
  }

  for (const key of store.keys()) {
    if (key.startsWith(keyPrefix)) store.delete(key);
  }
};
