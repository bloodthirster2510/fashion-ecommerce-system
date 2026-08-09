type CacheEntry<T> = {
  value: T;
  expiresAt: number;
  staleUntil: number;
};

type InflightEntry<T> = {
  promise: Promise<T>;
  expiresAt: number;
};

type CacheOptions = {
  ttlMs: number;
  staleWhileRevalidateMs?: number;
  forceRefresh?: boolean;
};

const store = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, InflightEntry<unknown>>();
const revisions = new Map<string, number>();
const MAX_CACHE_ENTRIES = 100;
const MAX_INFLIGHT_AGE_MS = 2 * 60 * 1000;

const now = () => Date.now();

const isStale = <T>(entry: CacheEntry<T> | undefined) =>
  !!entry && now() > entry.expiresAt && now() <= entry.staleUntil;

const forgetRevisionIfUnused = (key: string) => {
  if (!store.has(key) && !inflight.has(key)) revisions.delete(key);
};

const deleteStoredEntry = (key: string) => {
  store.delete(key);
  forgetRevisionIfUnused(key);
};

const touchStoredEntry = <T>(key: string, entry: CacheEntry<T>) => {
  store.delete(key);
  store.set(key, entry as CacheEntry<unknown>);
};

const pruneStore = () => {
  const currentTime = now();

  for (const [key, entry] of store) {
    if (currentTime > entry.staleUntil) deleteStoredEntry(key);
  }

  while (store.size > MAX_CACHE_ENTRIES) {
    const oldestKey = store.keys().next().value as string | undefined;
    if (!oldestKey) break;
    deleteStoredEntry(oldestKey);
  }
};

export const invalidateCache = (keyPrefix?: string) => {
  if (!keyPrefix) {
    const keys = new Set([...store.keys(), ...inflight.keys(), ...revisions.keys()]);
    keys.forEach((key) => {
      if (inflight.has(key)) revisions.set(key, (revisions.get(key) ?? 0) + 1);
      else revisions.delete(key);
    });
    store.clear();
    inflight.clear();
    return;
  }

  const keys = new Set([...store.keys(), ...inflight.keys(), ...revisions.keys()]);
  for (const key of keys) {
    if (!key.startsWith(keyPrefix)) continue;
    if (inflight.has(key)) revisions.set(key, (revisions.get(key) ?? 0) + 1);
    else revisions.delete(key);
    store.delete(key);
    inflight.delete(key);
  }
};

const loadAndCache = <T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs: number,
  staleWhileRevalidateMs: number,
  fallback?: () => T,
) => {
  const revision = (revisions.get(key) ?? 0) + 1;
  revisions.set(key, revision);

  let loading: Promise<T>;
  try {
    loading = loader();
  } catch (error) {
    loading = Promise.reject(error);
  }

  let promise: Promise<T>;
  promise = loading
    .then((value) => {
      if (revisions.get(key) === revision) {
        const expiresAt = now() + ttlMs;
        store.set(key, {
          value,
          expiresAt,
          staleUntil: expiresAt + staleWhileRevalidateMs,
        });
        pruneStore();
      }
      return value;
    })
    .catch((error: unknown) => {
      if (fallback) return fallback();
      throw error;
    })
    .finally(() => {
      const current = inflight.get(key) as InflightEntry<T> | undefined;
      if (current?.promise === promise) inflight.delete(key);
      forgetRevisionIfUnused(key);
    });

  inflight.set(key, { promise, expiresAt: now() + MAX_INFLIGHT_AGE_MS });
  return promise;
};

export const withCache = async <T>(
  key: string,
  loader: () => Promise<T>,
  { ttlMs, staleWhileRevalidateMs = 0, forceRefresh = false }: CacheOptions,
): Promise<T> => {
  pruneStore();

  if (forceRefresh) {
    store.delete(key);
    return loadAndCache(key, loader, ttlMs, staleWhileRevalidateMs);
  }

  const cached = store.get(key) as CacheEntry<T> | undefined;

  if (cached && now() <= cached.expiresAt) {
    touchStoredEntry(key, cached);
    return cached.value;
  }

  if (cached && staleWhileRevalidateMs > 0 && isStale(cached)) {
    touchStoredEntry(key, cached);
    const existing = inflight.get(key) as InflightEntry<T> | undefined;
    if (!existing) {
      void loadAndCache(key, loader, ttlMs, staleWhileRevalidateMs, () => cached.value);
    }
    return cached.value;
  }

  const existing = inflight.get(key) as InflightEntry<T> | undefined;
  if (existing && now() <= existing.expiresAt) {
    return existing.promise;
  }

  return loadAndCache(key, loader, ttlMs, staleWhileRevalidateMs);
};
