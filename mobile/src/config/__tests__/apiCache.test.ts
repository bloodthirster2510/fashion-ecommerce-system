import { invalidateCache, withCache } from '../apiCache';

describe('API cache refresh behavior', () => {
  beforeEach(() => invalidateCache());

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
});
