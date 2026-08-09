import { invalidateCache, withCache } from '../apiCache';

describe('API cache refresh behavior', () => {
  beforeEach(() => invalidateCache());
  afterEach(() => jest.restoreAllMocks());

  it('reuses a fresh cached value', async () => {
    const loader = jest.fn().mockResolvedValue('first');

    expect(await withCache('product:1', loader, { ttlMs: 60_000 })).toBe('first');
    expect(await withCache('product:1', loader, { ttlMs: 60_000 })).toBe('first');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('forces a network refresh even while the cached value is fresh', async () => {
    const loader = jest.fn()
      .mockResolvedValueOnce('before-admin-update')
      .mockResolvedValueOnce('after-admin-update');

    await withCache('product:1', loader, { ttlMs: 60_000 });
    expect(await withCache('product:1', loader, { ttlMs: 60_000, forceRefresh: true }))
      .toBe('after-admin-update');
    expect(await withCache('product:1', loader, { ttlMs: 60_000 })).toBe('after-admin-update');
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('does not let an older request overwrite a forced refresh', async () => {
    let resolveOld: (value: string) => void = () => undefined;
    let resolveFresh: (value: string) => void = () => undefined;
    const oldLoader = jest.fn(() => new Promise<string>((resolve) => { resolveOld = resolve; }));
    const freshLoader = jest.fn(() => new Promise<string>((resolve) => { resolveFresh = resolve; }));

    const oldRequest = withCache('product:1', oldLoader, { ttlMs: 60_000 });
    const freshRequest = withCache('product:1', freshLoader, { ttlMs: 60_000, forceRefresh: true });

    resolveFresh('fresh');
    await expect(freshRequest).resolves.toBe('fresh');
    resolveOld('stale');
    await expect(oldRequest).resolves.toBe('stale');

    const unexpectedLoader = jest.fn().mockResolvedValue('unexpected');
    await expect(withCache('product:1', unexpectedLoader, { ttlMs: 60_000 })).resolves.toBe('fresh');
    expect(unexpectedLoader).not.toHaveBeenCalled();
  });

  it('deduplicates concurrent requests for the same key', async () => {
    let resolveLoader: (value: string) => void = () => undefined;
    const loader = jest.fn(() => new Promise<string>((resolve) => { resolveLoader = resolve; }));

    const first = withCache('product:shared', loader, { ttlMs: 60_000 });
    const second = withCache('product:shared', loader, { ttlMs: 60_000 });

    expect(loader).toHaveBeenCalledTimes(1);
    resolveLoader('shared');
    await expect(Promise.all([first, second])).resolves.toEqual(['shared', 'shared']);
  });

  it('returns stale data immediately and refreshes it in the background', async () => {
    const currentTime = jest.spyOn(Date, 'now').mockReturnValue(1_000);
    const loader = jest.fn()
      .mockResolvedValueOnce('cached')
      .mockResolvedValueOnce('refreshed');
    const options = { ttlMs: 1_000, staleWhileRevalidateMs: 5_000 };

    await expect(withCache('product:swr', loader, options)).resolves.toBe('cached');
    currentTime.mockReturnValue(2_500);
    await expect(withCache('product:swr', loader, options)).resolves.toBe('cached');
    await Promise.resolve();
    await expect(withCache('product:swr', loader, options)).resolves.toBe('refreshed');
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('bounds the number of retained entries with LRU eviction', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_000);

    for (let index = 0; index <= 100; index += 1) {
      await withCache(`product:${index}`, async () => index, { ttlMs: 60_000 });
    }

    const reloader = jest.fn().mockResolvedValue('reloaded');
    await expect(withCache('product:0', reloader, { ttlMs: 60_000 })).resolves.toBe('reloaded');
    expect(reloader).toHaveBeenCalledTimes(1);
  });
});
