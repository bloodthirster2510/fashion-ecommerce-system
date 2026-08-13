import { Queue, Worker, type Job } from 'bullmq';
import Redis from 'ioredis';
import { getRedisKeyPrefix } from '../../config/redis';

type Env = NodeJS.ProcessEnv | Record<string, string | undefined>;

export type VirtualTryOnQueueStage = 'image' | 'video';

type VirtualTryOnQueueJob = {
  jobId: string;
};

type VirtualTryOnQueueProcessors = {
  image: (jobId: string) => Promise<void>;
  video: (jobId: string) => Promise<void>;
};

export class VirtualTryOnQueueError extends Error {
  constructor(message: string, public readonly originalError?: unknown) {
    super(message);
    this.name = 'VirtualTryOnQueueError';
  }
}

const DEFAULT_CONNECT_TIMEOUT_MS = 5_000;
const DEFAULT_IMAGE_CONCURRENCY = 2;
const DEFAULT_VIDEO_CONCURRENCY = 1;
const QUEUE_NAMES: Record<VirtualTryOnQueueStage, string> = {
  image: 'virtual-try-on-image',
  video: 'virtual-try-on-video',
};

const queues: Partial<Record<VirtualTryOnQueueStage, Queue<VirtualTryOnQueueJob>>> = {};
const workers: Partial<Record<VirtualTryOnQueueStage, Worker<VirtualTryOnQueueJob>>> = {};
const connections: Redis[] = [];
let startPromise: Promise<boolean> | null = null;
let started = false;

const parseBoolean = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) return fallback;
  return value.trim().toLowerCase() === 'true';
};

const parsePositiveInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const getVirtualTryOnQueueConfig = (env: Env = process.env) => ({
  enabled: parseBoolean(env.VIRTUAL_TRY_ON_QUEUE_ENABLED, false),
  workerEnabled: parseBoolean(env.VIRTUAL_TRY_ON_QUEUE_WORKER_ENABLED, true),
  redisUrl: env.VIRTUAL_TRY_ON_QUEUE_REDIS_URL?.trim() || env.REDIS_URL?.trim() || '',
  prefix: `${getRedisKeyPrefix(env)}:bullmq`,
  connectTimeoutMs: parsePositiveInteger(
    env.VIRTUAL_TRY_ON_QUEUE_CONNECT_TIMEOUT_MS,
    DEFAULT_CONNECT_TIMEOUT_MS,
  ),
  imageConcurrency: parsePositiveInteger(
    env.VIRTUAL_TRY_ON_IMAGE_QUEUE_CONCURRENCY,
    DEFAULT_IMAGE_CONCURRENCY,
  ),
  videoConcurrency: parsePositiveInteger(
    env.VIRTUAL_TRY_ON_VIDEO_QUEUE_CONCURRENCY,
    DEFAULT_VIDEO_CONCURRENCY,
  ),
  requireNoEviction: parseBoolean(env.VIRTUAL_TRY_ON_QUEUE_REQUIRE_NOEVICTION, true),
});

export const isVirtualTryOnQueueEnabled = (env: Env = process.env) =>
  getVirtualTryOnQueueConfig(env).enabled;

export const getVirtualTryOnQueueHealth = (env: Env = process.env) => {
  const config = getVirtualTryOnQueueConfig(env);
  const producerReady = Boolean(started && queues.image && queues.video);
  const workerReady = !config.workerEnabled || Boolean(workers.image && workers.video);
  const ready = !config.enabled || (producerReady && workerReady);
  return {
    enabled: config.enabled,
    ready,
    producerReady,
    workerEnabled: config.workerEnabled,
    workerReady,
    status: !config.enabled ? 'disabled' : ready ? 'ready' : 'unavailable',
  };
};

const getMaxmemoryPolicy = async (connection: Redis) => {
  const configured = await connection.config('GET', 'maxmemory-policy');
  if (Array.isArray(configured) && configured.length > 0) {
    return String(configured[configured.length - 1]).trim().toLowerCase();
  }

  const memoryInfo = await connection.info('memory');
  const policyLine = memoryInfo
    .split(/\r?\n/)
    .find((line) => line.startsWith('maxmemory_policy:'));
  return policyLine?.split(':', 2)[1]?.trim().toLowerCase() || 'unknown';
};

const createConnection = async (
  url: string,
  connectTimeout: number,
  maxRetriesPerRequest: number | null,
  connectionName: string,
) => {
  const connection = new Redis(url, {
    connectionName,
    connectTimeout,
    lazyConnect: true,
    maxRetriesPerRequest,
  });
  connection.on('error', (error) => {
    console.error(`[virtual-try-on-queue] ${connectionName} Redis error:`, error.message);
  });
  await connection.connect();
  connections.push(connection);
  return connection;
};

const assertQueueRedisPolicy = async (connection: Redis, requireNoEviction: boolean) => {
  if (!requireNoEviction) return;
  const policy = await getMaxmemoryPolicy(connection);
  if (policy !== 'noeviction') {
    throw new Error(
      `BullMQ requires Redis maxmemory-policy=noeviction; current policy is ${policy}. `
      + 'Use a dedicated queue database and set VIRTUAL_TRY_ON_QUEUE_REDIS_URL.',
    );
  }
};

const createQueue = (
  stage: VirtualTryOnQueueStage,
  connection: Redis,
  prefix: string,
) => new Queue<VirtualTryOnQueueJob>(QUEUE_NAMES[stage], {
  connection,
  prefix,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2_000 },
    removeOnComplete: true,
    removeOnFail: { age: 86_400, count: 1_000 },
  },
});

const createWorker = (
  stage: VirtualTryOnQueueStage,
  processor: VirtualTryOnQueueProcessors[VirtualTryOnQueueStage],
  connection: Redis,
  prefix: string,
  concurrency: number,
) => {
  const worker = new Worker<VirtualTryOnQueueJob>(
    QUEUE_NAMES[stage],
    async (job: Job<VirtualTryOnQueueJob>) => processor(job.data.jobId),
    { connection, prefix, concurrency },
  );
  worker.on('failed', (job, error) => {
    console.error(
      `[virtual-try-on-queue] ${stage} job ${job?.data.jobId || 'unknown'} failed:`,
      error.message,
    );
  });
  worker.on('error', (error) => {
    console.error(`[virtual-try-on-queue] ${stage} worker error:`, error.message);
  });
  return worker;
};

export const startVirtualTryOnQueue = async (
  processors: VirtualTryOnQueueProcessors,
  options: { startWorker?: boolean; env?: Env } = {},
) => {
  const env = options.env ?? process.env;
  const config = getVirtualTryOnQueueConfig(env);
  if (!config.enabled) {
    console.log('[virtual-try-on-queue] Disabled; using in-process scheduling');
    return false;
  }
  if (!config.redisUrl) {
    throw new Error('VIRTUAL_TRY_ON_QUEUE_REDIS_URL or REDIS_URL is required when the queue is enabled');
  }
  if (started) return true;
  if (startPromise) return startPromise;

  startPromise = (async () => {
    try {
      const producerConnection = await createConnection(
        config.redisUrl,
        config.connectTimeoutMs,
        1,
        'virtual-try-on-producer',
      );
      await assertQueueRedisPolicy(producerConnection, config.requireNoEviction);

      queues.image = createQueue('image', producerConnection, config.prefix);
      queues.video = createQueue('video', producerConnection, config.prefix);
      await Promise.all([queues.image.waitUntilReady(), queues.video.waitUntilReady()]);

      const shouldStartWorker = options.startWorker ?? config.workerEnabled;
      if (shouldStartWorker) {
        const [imageConnection, videoConnection] = await Promise.all([
          createConnection(config.redisUrl, config.connectTimeoutMs, null, 'virtual-try-on-image-worker'),
          createConnection(config.redisUrl, config.connectTimeoutMs, null, 'virtual-try-on-video-worker'),
        ]);
        workers.image = createWorker(
          'image',
          processors.image,
          imageConnection,
          config.prefix,
          config.imageConcurrency,
        );
        workers.video = createWorker(
          'video',
          processors.video,
          videoConnection,
          config.prefix,
          config.videoConcurrency,
        );
        await Promise.all([workers.image.waitUntilReady(), workers.video.waitUntilReady()]);
      }

      started = true;
      console.log(
        `[virtual-try-on-queue] Ready (${shouldStartWorker ? 'producer + worker' : 'producer only'})`,
      );
      return true;
    } catch (error) {
      await stopVirtualTryOnQueue();
      throw error;
    } finally {
      startPromise = null;
    }
  })();

  return startPromise;
};

export const enqueueVirtualTryOnJob = async (
  stage: VirtualTryOnQueueStage,
  jobId: string,
) => {
  const queue = queues[stage];
  if (!queue || !started) {
    throw new VirtualTryOnQueueError(`Virtual try-on ${stage} queue is not ready`);
  }

  try {
    const existing = await queue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (['active', 'waiting', 'delayed', 'prioritized', 'waiting-children'].includes(state)) return;
      await existing.remove();
    }

    await queue.add(stage, { jobId }, { jobId });
  } catch (error) {
    throw new VirtualTryOnQueueError(
      `Failed to enqueue virtual try-on ${stage} job ${jobId}`,
      error,
    );
  }
};

export const removeVirtualTryOnJobs = async (jobId: string) => {
  if (!started) return;
  await Promise.all((Object.values(queues) as Queue<VirtualTryOnQueueJob>[]).map(async (queue) => {
    const job = await queue.getJob(jobId);
    if (!job) return;
    const state = await job.getState();
    if (state !== 'active') await job.remove();
  }));
};

export const stopVirtualTryOnQueue = async () => {
  const activeWorkers = Object.values(workers) as Worker<VirtualTryOnQueueJob>[];
  const activeQueues = Object.values(queues) as Queue<VirtualTryOnQueueJob>[];
  delete workers.image;
  delete workers.video;
  delete queues.image;
  delete queues.video;
  started = false;

  await Promise.allSettled(activeWorkers.map((worker) => worker.close(true)));
  await Promise.allSettled(activeQueues.map((queue) => queue.close()));
  const activeConnections = connections.splice(0, connections.length);
  await Promise.allSettled(activeConnections.map(async (connection) => {
    if (connection.status === 'ready') await connection.quit();
    else connection.disconnect();
  }));
};
