import { createClient, type RedisClientType } from 'redis';

type Env = NodeJS.ProcessEnv | Record<string, string | undefined>;

const DEFAULT_CONNECT_TIMEOUT_MS = 5_000;
const DEFAULT_RECONNECT_MAX_DELAY_MS = 5_000;
const DEFAULT_RECONNECT_MAX_RETRIES = 5;

let client: RedisClientType | null = null;
let connectPromise: Promise<boolean> | null = null;
let lastConnectionError: string | null = null;

const parseBoolean = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) return fallback;
  return value.trim().toLowerCase() === 'true';
};

const parsePositiveInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const isRedisEnabled = (env: Env = process.env) => {
  const urlConfigured = Boolean(env.REDIS_URL?.trim());
  return parseBoolean(env.REDIS_ENABLED, urlConfigured);
};

export const isRedisRequired = (env: Env = process.env) =>
  parseBoolean(env.REDIS_REQUIRED, false);

const createRedisClient = (url: string, env: Env) => {
  const connectTimeout = parsePositiveInteger(
    env.REDIS_CONNECT_TIMEOUT_MS,
    DEFAULT_CONNECT_TIMEOUT_MS,
  );
  const maxReconnectDelay = parsePositiveInteger(
    env.REDIS_RECONNECT_MAX_DELAY_MS,
    DEFAULT_RECONNECT_MAX_DELAY_MS,
  );
  const maxReconnectRetries = parsePositiveInteger(
    env.REDIS_RECONNECT_MAX_RETRIES,
    DEFAULT_RECONNECT_MAX_RETRIES,
  );

  const redisClient = createClient({
    url,
    socket: {
      connectTimeout,
      reconnectStrategy: (retries) => {
        if (retries >= maxReconnectRetries) {
          return new Error('Redis reconnect retry limit reached');
        }
        return Math.min(100 * (retries + 1), maxReconnectDelay);
      },
    },
  });

  redisClient.on('ready', () => {
    lastConnectionError = null;
    console.log('[redis] Connection ready');
  });
  redisClient.on('reconnecting', () => {
    console.warn('[redis] Reconnecting');
  });
  redisClient.on('error', (error) => {
    lastConnectionError = error instanceof Error ? error.message : String(error);
    console.error('[redis] Connection error:', lastConnectionError);
  });

  return redisClient;
};

export const connectRedis = async (env: Env = process.env) => {
  if (!isRedisEnabled(env)) {
    console.log('[redis] Disabled');
    return false;
  }

  const url = env.REDIS_URL?.trim();
  if (!url) {
    const error = new Error('REDIS_URL is required when Redis is enabled');
    if (isRedisRequired(env)) throw error;
    console.warn(`[redis] ${error.message}; continuing without Redis`);
    return false;
  }

  if (client?.isReady) return true;
  if (connectPromise) return connectPromise;

  client ??= createRedisClient(url, env);
  connectPromise = client.connect()
    .then(() => true)
    .catch((error) => {
      lastConnectionError = error instanceof Error ? error.message : String(error);
      if (isRedisRequired(env)) throw error;
      console.warn('[redis] Initial connection failed; continuing without Redis');
      client?.destroy();
      client = null;
      return false;
    })
    .finally(() => {
      connectPromise = null;
    });

  return connectPromise;
};

export const getRedisClient = () => client?.isReady ? client : null;

export const getRedisKeyPrefix = (env: Env = process.env) => {
  const configured = env.REDIS_KEY_PREFIX?.trim().replace(/:+$/g, '');
  return configured || 'fashion';
};

export const buildRedisKey = (namespace: string, key: string, env: Env = process.env) =>
  `${getRedisKeyPrefix(env)}:${namespace}:${key}`;

export const getRedisHealth = (env: Env = process.env) => ({
  enabled: isRedisEnabled(env),
  required: isRedisRequired(env),
  ready: Boolean(client?.isReady),
  status: client?.isReady ? 'ready' : isRedisEnabled(env) ? 'unavailable' : 'disabled',
});

export const disconnectRedis = async () => {
  const redisClient = client;
  client = null;
  connectPromise = null;

  if (!redisClient) return;
  if (redisClient.isOpen) {
    await redisClient.close();
  } else {
    redisClient.destroy();
  }
};
