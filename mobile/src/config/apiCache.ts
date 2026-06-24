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
};

const store = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, InflightEntry<unknown>>();

const now = () => Date.now();

const isStale = <T>(entry: CacheEntry<T> | undefined, staleWindowMs: number) =>
  !!entry && now() > entry.expiresAt && now() <= entry.expiresAt + staleWindowMs;

export const invalidateCache = (keyPrefix?: string) => {
  if (!keyPrefix) {
    store.clear();
    inflight.clear();
    return;
  }

  for (const key of store.keys()) {
    if (key.startsWith(keyPrefix)) store.delete(key);
  }
  for (const key of inflight.keys()) {
    if (key.startsWith(keyPrefix)) inflight.delete(key);
  }
};

export const withCache = async <T>(
  key: string,
  loader: () => Promise<T>,
  { ttlMs, staleWhileRevalidateMs = 0 }: CacheOptions,
): Promise<T> => {
  const cached = store.get(key) as CacheEntry<T> | undefined;

  if (cached && now() <= cached.expiresAt) {
    return cached.value;
  }

  if (cached && staleWhileRevalidateMs > 0 && isStale(cached, staleWhileRevalidateMs)) {
    const existing = inflight.get(key) as InflightEntry<T> | undefined;
    if (!existing) {
      const promise = loader()
        .then((value) => {
          store.set(key, { value, expiresAt: now() + ttlMs });
          return value;
        })
        .catch(() => cached.value)
        .finally(() => inflight.delete(key));
      inflight.set(key, { promise, expiresAt: now() + ttlMs });
    }
    return cached.value;
  }

  const existing = inflight.get(key) as InflightEntry<T> | undefined;
  if (existing && now() <= existing.expiresAt) {
    return existing.promise;
  }

  const promise = loader()
    .then((value) => {
      store.set(key, { value, expiresAt: now() + ttlMs });
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, { promise, expiresAt: now() + ttlMs });

  return promise;
};