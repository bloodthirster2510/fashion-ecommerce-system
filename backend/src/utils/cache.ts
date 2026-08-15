import crypto from 'crypto';
import { buildRedisKey, getRedisClient } from '../config/redis';

type MemoryCacheEntry = {
  expiresAt: number;
  value: unknown;
};

const MAX_MEMORY_CACHE_ENTRIES = 1_000;
const memoryCache = new Map<string, MemoryCacheEntry>();
let lastRedisCacheErrorAt = 0;

const normalizeNamespace = (namespace: string) =>
  namespace.trim().toLowerCase().replace(/[^a-z0-9:_-]+/g, '-');

const buildCacheKey = (namespace: string, key: string) => {
  const digest = crypto.createHash('sha256').update(key).digest('hex');
  return buildRedisKey(`cache:${normalizeNamespace(namespace)}`, digest);
};

const logRedisCacheError = (operation: string, error: unknown) => {
  const now = Date.now();
  if (now - lastRedisCacheErrorAt < 30_000) return;
  lastRedisCacheErrorAt = now;
  console.error(
    `[redis-cache] ${operation} failed; using source data or memory fallback:`,
    error instanceof Error ? error.message : String(error),
  );
};

const getMemoryValue = <T>(key: string): T | null => {
  const cached = memoryCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    memoryCache.delete(key);
    return null;
  }
  return cached.value as T;
};

const setMemoryValue = <T>(key: string, value: T, ttlMs: number) => {
  memoryCache.delete(key);
  memoryCache.set(key, { value, expiresAt: Date.now() + ttlMs });

  if (memoryCache.size <= MAX_MEMORY_CACHE_ENTRIES) return;
  for (const [entryKey, entry] of memoryCache) {
    if (entry.expiresAt <= Date.now()) memoryCache.delete(entryKey);
  }
  while (memoryCache.size > MAX_MEMORY_CACHE_ENTRIES) {
    const oldestKey = memoryCache.keys().next().value;
    if (!oldestKey) break;
    memoryCache.delete(oldestKey);
  }
};

export const cacheGetJson = async <T>(namespace: string, key: string): Promise<T | null> => {
  const cacheKey = buildCacheKey(namespace, key);
  const redisClient = getRedisClient();

  if (redisClient) {
    try {
      const value = await redisClient.get(cacheKey);
      if (value === null) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      logRedisCacheError('GET', error);
    }
  }

  return getMemoryValue<T>(cacheKey);
};

export const cacheSetJson = async <T>(
  namespace: string,
  key: string,
  value: T,
  ttlMs: number,
) => {
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) return;
  const cacheKey = buildCacheKey(namespace, key);
  const redisClient = getRedisClient();

  if (redisClient) {
    try {
      await redisClient.set(cacheKey, JSON.stringify(value), { PX: Math.ceil(ttlMs) });
      return;
    } catch (error) {
      logRedisCacheError('SET', error);
    }
  }

  setMemoryValue(cacheKey, value, ttlMs);
};

export const cacheDeleteNamespace = async (namespace: string) => {
  const normalizedNamespace = normalizeNamespace(namespace);
  const namespacePrefix = buildRedisKey(`cache:${normalizedNamespace}`, '');

  for (const key of memoryCache.keys()) {
    if (key.startsWith(namespacePrefix)) memoryCache.delete(key);
  }

  const redisClient = getRedisClient();
  if (!redisClient) return;

  try {
    for await (const keys of redisClient.scanIterator({
      MATCH: `${namespacePrefix}*`,
      COUNT: 100,
    })) {
      if (keys.length > 0) await redisClient.del(keys);
    }
  } catch (error) {
    logRedisCacheError('namespace invalidation', error);
  }
};

export const clearMemoryCache = (namespace?: string) => {
  if (!namespace) {
    memoryCache.clear();
    return;
  }

  const namespacePrefix = buildRedisKey(`cache:${normalizeNamespace(namespace)}`, '');
  for (const key of memoryCache.keys()) {
    if (key.startsWith(namespacePrefix)) memoryCache.delete(key);
  }
};
