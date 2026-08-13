import { clearMemoryCache, cacheGetJson, cacheSetJson } from '../cache';

describe('cache utility memory fallback', () => {
  beforeEach(() => {
    clearMemoryCache();
  });

  it('stores JSON values with a TTL when Redis is unavailable', async () => {
    const value = { products: ['shirt'] };

    await cacheSetJson('test-cache', 'query', value, 1_000);

    await expect(cacheGetJson('test-cache', 'query')).resolves.toEqual(value);
  });

  it('does not cache values when the TTL is disabled', async () => {
    await cacheSetJson('test-cache', 'disabled', { value: true }, 0);

    await expect(cacheGetJson('test-cache', 'disabled')).resolves.toBeNull();
  });

  it('expires memory fallback entries', async () => {
    jest.useFakeTimers();
    try {
      await cacheSetJson('test-cache', 'temporary', { value: true }, 50);
      jest.advanceTimersByTime(51);

      await expect(cacheGetJson('test-cache', 'temporary')).resolves.toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
});
