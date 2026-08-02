import * as FileSystem from 'expo-file-system/legacy';

type ScreenDataCacheEntry<T> = {
  value: T;
  updatedAt: number;
  maxAgeMs: number;
  persistent: boolean;
};

type PersistedScreenDataCache = {
  version: 1;
  entries: Array<{
    key: string;
    value: unknown;
    updatedAt: number;
    maxAgeMs: number;
  }>;
};

type ScreenDataWriteOptions = {
  maxAgeMs?: number;
  persist?: boolean;
};

const DEFAULT_MAX_AGE_MS = 5 * 60 * 1000;
const DEFAULT_PERSISTENT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_MEMORY_ENTRIES = 100;
const MAX_PERSISTENT_ENTRIES = 30;
const CACHE_FILE_URI = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}screen-data-cache-v1.json`
  : null;
const PERSISTENT_KEYS = new Set(['home:categories', 'home:best-sellers']);
const PERSISTENT_PREFIXES = ['catalog:detail:'];
const store = new Map<string, ScreenDataCacheEntry<unknown>>();
const invalidationEvents: Array<{ prefix?: string; revision: number }> = [];

let hydrationPromise: Promise<void> | null = null;
let persistenceQueue = Promise.resolve();
let cacheGeneration = 0;
let invalidationRevision = 0;

const isPersistentKey = (key: string) => (
  PERSISTENT_KEYS.has(key) || PERSISTENT_PREFIXES.some((prefix) => key.startsWith(prefix))
);

const publishInvalidation = (prefix?: string) => {
  invalidationRevision += 1;
  invalidationEvents.push({ prefix, revision: invalidationRevision });
  if (invalidationEvents.length > 100) invalidationEvents.shift();
};

export const getScreenDataInvalidationRevision = (scope: string) => {
  let latestRevision = 0;

  invalidationEvents.forEach((event) => {
    const overlapsScope = !event.prefix
      || scope.startsWith(event.prefix)
      || event.prefix.startsWith(scope);
    if (overlapsScope) latestRevision = event.revision;
  });

  return latestRevision;
};

const isExpired = (entry: ScreenDataCacheEntry<unknown>, currentTime = Date.now()) => (
  currentTime - entry.updatedAt > entry.maxAgeMs
);

const touchEntry = (key: string, entry: ScreenDataCacheEntry<unknown>) => {
  store.delete(key);
  store.set(key, entry);
};

const getPersistentSnapshot = (): PersistedScreenDataCache => ({
  version: 1,
  entries: Array.from(store.entries())
    .filter(([key, entry]) => entry.persistent && isPersistentKey(key) && !isExpired(entry))
    .slice(-MAX_PERSISTENT_ENTRIES)
    .map(([key, entry]) => ({
      key,
      value: entry.value,
      updatedAt: entry.updatedAt,
      maxAgeMs: entry.maxAgeMs,
    })),
});

const schedulePersistence = () => {
  if (!CACHE_FILE_URI) return;

  persistenceQueue = persistenceQueue
    .catch(() => undefined)
    .then(async () => {
      await FileSystem.writeAsStringAsync(CACHE_FILE_URI, JSON.stringify(getPersistentSnapshot()));
    })
    .catch(() => undefined);
};

const removeEntry = (key: string) => {
  const entry = store.get(key);
  if (!entry) return false;
  store.delete(key);
  return entry.persistent;
};

const pruneStore = () => {
  let persistentEntryRemoved = false;
  const currentTime = Date.now();

  for (const [key, entry] of store) {
    if (isExpired(entry, currentTime)) {
      persistentEntryRemoved = removeEntry(key) || persistentEntryRemoved;
    }
  }

  while (store.size > MAX_MEMORY_ENTRIES) {
    const oldestKey = store.keys().next().value as string | undefined;
    if (!oldestKey) break;
    persistentEntryRemoved = removeEntry(oldestKey) || persistentEntryRemoved;
  }

  if (persistentEntryRemoved) schedulePersistence();
};

const isPersistedEntry = (value: unknown): value is PersistedScreenDataCache['entries'][number] => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const entry = value as Partial<PersistedScreenDataCache['entries'][number]>;
  return typeof entry.key === 'string'
    && Number.isFinite(entry.updatedAt)
    && Number.isFinite(entry.maxAgeMs)
    && (entry.maxAgeMs ?? 0) > 0;
};

export const hydrateScreenDataCache = () => {
  if (hydrationPromise) return hydrationPromise;

  const hydrationGeneration = cacheGeneration;
  hydrationPromise = (async () => {
    if (!CACHE_FILE_URI) return;

    try {
      const info = await FileSystem.getInfoAsync(CACHE_FILE_URI);
      if (!info.exists) return;

      const parsed = JSON.parse(await FileSystem.readAsStringAsync(CACHE_FILE_URI)) as Partial<PersistedScreenDataCache>;
      if (parsed.version !== 1 || !Array.isArray(parsed.entries) || cacheGeneration !== hydrationGeneration) return;

      const currentTime = Date.now();
      parsed.entries
        .filter(isPersistedEntry)
        .filter((entry) => isPersistentKey(entry.key) && currentTime - entry.updatedAt <= entry.maxAgeMs)
        .slice(-MAX_PERSISTENT_ENTRIES)
        .forEach((entry) => {
          const current = store.get(entry.key);
          if (current && current.updatedAt >= entry.updatedAt) return;
          store.set(entry.key, { ...entry, persistent: true });
        });
      pruneStore();
    } catch {
      // Invalid or unavailable disk cache should never block app startup.
    }
  })();

  return hydrationPromise;
};

export const flushScreenDataCachePersistence = () => persistenceQueue;

export const readScreenData = <T>(
  key: string,
  maxAgeMs?: number,
): T | undefined => {
  pruneStore();
  const entry = store.get(key) as ScreenDataCacheEntry<T> | undefined;
  if (!entry) return undefined;

  const effectiveMaxAgeMs = maxAgeMs ?? entry.maxAgeMs;
  if (Date.now() - entry.updatedAt > effectiveMaxAgeMs) {
    const removedPersistentEntry = removeEntry(key);
    if (removedPersistentEntry) schedulePersistence();
    return undefined;
  }

  touchEntry(key, entry as ScreenDataCacheEntry<unknown>);
  return entry.value;
};

export const writeScreenData = <T>(
  key: string,
  value: T,
  options: ScreenDataWriteOptions = {},
) => {
  const persistent = options.persist !== false && isPersistentKey(key);
  const maxAgeMs = options.maxAgeMs
    ?? (persistent ? DEFAULT_PERSISTENT_MAX_AGE_MS : DEFAULT_MAX_AGE_MS);

  store.delete(key);
  store.set(key, { value, updatedAt: Date.now(), maxAgeMs, persistent });
  pruneStore();
  if (persistent) schedulePersistence();
};

export const invalidateScreenData = (keyPrefix?: string) => {
  cacheGeneration += 1;
  let persistentEntryRemoved = false;

  if (!keyPrefix) {
    persistentEntryRemoved = Array.from(store.values()).some((entry) => entry.persistent);
    store.clear();
  } else {
    for (const key of Array.from(store.keys())) {
      if (!key.startsWith(keyPrefix)) continue;
      persistentEntryRemoved = removeEntry(key) || persistentEntryRemoved;
    }
  }

  if (persistentEntryRemoved) schedulePersistence();
  publishInvalidation(keyPrefix);
};
