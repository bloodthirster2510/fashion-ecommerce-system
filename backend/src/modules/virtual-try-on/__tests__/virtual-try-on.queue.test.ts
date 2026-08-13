import {
  getVirtualTryOnQueueConfig,
  getVirtualTryOnQueueHealth,
  isVirtualTryOnQueueEnabled,
} from '../virtual-try-on.queue';

describe('virtual try-on queue configuration', () => {
  it('is opt-in and can reuse REDIS_URL when explicitly enabled', () => {
    const config = getVirtualTryOnQueueConfig({
      REDIS_URL: 'redis://cache.example:6379',
      REDIS_KEY_PREFIX: 'shop',
    });

    expect(config.enabled).toBe(false);
    expect(config.redisUrl).toBe('redis://cache.example:6379');
    expect(config.prefix).toBe('shop:bullmq');
    expect(config.requireNoEviction).toBe(true);
  });

  it('prefers the dedicated queue URL and parses worker limits', () => {
    const env = {
      REDIS_URL: 'redis://cache.example:6379',
      VIRTUAL_TRY_ON_QUEUE_ENABLED: 'true',
      VIRTUAL_TRY_ON_QUEUE_REDIS_URL: 'redis://queue.example:6379',
      VIRTUAL_TRY_ON_QUEUE_WORKER_ENABLED: 'false',
      VIRTUAL_TRY_ON_IMAGE_QUEUE_CONCURRENCY: '4',
      VIRTUAL_TRY_ON_VIDEO_QUEUE_CONCURRENCY: '2',
    };
    const config = getVirtualTryOnQueueConfig(env);

    expect(isVirtualTryOnQueueEnabled(env)).toBe(true);
    expect(config.redisUrl).toBe('redis://queue.example:6379');
    expect(config.workerEnabled).toBe(false);
    expect(config.imageConcurrency).toBe(4);
    expect(config.videoConcurrency).toBe(2);
  });

  it('falls back to safe positive concurrency defaults', () => {
    const config = getVirtualTryOnQueueConfig({
      VIRTUAL_TRY_ON_IMAGE_QUEUE_CONCURRENCY: '0',
      VIRTUAL_TRY_ON_VIDEO_QUEUE_CONCURRENCY: 'invalid',
    });

    expect(config.imageConcurrency).toBe(2);
    expect(config.videoConcurrency).toBe(1);
  });

  it('reports a disabled queue as healthy without a Redis connection', () => {
    expect(getVirtualTryOnQueueHealth({ VIRTUAL_TRY_ON_QUEUE_ENABLED: 'false' })).toMatchObject({
      enabled: false,
      ready: true,
      status: 'disabled',
    });
  });
});
