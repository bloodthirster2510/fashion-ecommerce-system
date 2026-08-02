type CacheEntry<T> = {
  value: T;
  expiresAt: number;
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

const now = () => Date.now();

const isStale = <T>(entry: CacheEntry<T> | undefined, staleWindowMs: number) =>
  !!entry && now() > entry.expiresAt && now() <= entry.expiresAt + staleWindowMs;

export const invalidateCache = (keyPrefix?: string) => {
  if (!keyPrefix) {
    const keys = new Set([...store.keys(), ...inflight.keys(), ...revisions.keys()]);
    keys.forEach((key) => revisions.set(key, (revisions.get(key) ?? 0) + 1));
    store.clear();
    inflight.clear();
    return;
  }

  const keys = new Set([...store.keys(), ...inflight.keys(), ...revisions.keys()]);
  for (const key of keys) {
    if (!key.startsWith(keyPrefix)) continue;
    revisions.set(key, (revisions.get(key) ?? 0) + 1);
    store.delete(key);
    inflight.delete(key);
  }
};

const loadAndCache = <T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs: number,
  fallback?: () => T,
) => {
  const revision = (revisions.get(key) ?? 0) + 1;
  revisions.set(key, revision);

  let promise: Promise<T>;
  promise = loader()
    .then((value) => {
      if (revisions.get(key) === revision) {
        store.set(key, { value, expiresAt: now() + ttlMs });
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
    });

  inflight.set(key, { promise, expiresAt: now() + ttlMs });
  return promise;
};

export const withCache = async <T>(
  key: string,
  loader: () => Promise<T>,
  { ttlMs, staleWhileRevalidateMs = 0, forceRefresh = false }: CacheOptions,
): Promise<T> => {
  if (forceRefresh) {
    store.delete(key);
    return loadAndCache(key, loader, ttlMs);
  }

  const cached = store.get(key) as CacheEntry<T> | undefined;

  if (cached && now() <= cached.expiresAt) {
    return cached.value;
  }

  if (cached && staleWhileRevalidateMs > 0 && isStale(cached, staleWhileRevalidateMs)) {
    const existing = inflight.get(key) as InflightEntry<T> | undefined;
    if (!existing) {
      void loadAndCache(key, loader, ttlMs, () => cached.value);
    }
    return cached.value;
  }

  const existing = inflight.get(key) as InflightEntry<T> | undefined;
  if (existing && now() <= existing.expiresAt) {
    return existing.promise;
  }

  return loadAndCache(key, loader, ttlMs);
};
