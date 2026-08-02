jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  getInfoAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
}));

import * as FileSystem from 'expo-file-system/legacy';
import {
  flushScreenDataCachePersistence,
  getScreenDataInvalidationRevision,
  hydrateScreenDataCache,
  invalidateScreenData,
  readScreenData,
  writeScreenData,
} from '../screenDataCache';

const mockedFileSystem = FileSystem as jest.Mocked<typeof FileSystem>;

describe('screen data cache', () => {
  beforeEach(async () => {
    jest.restoreAllMocks();
    invalidateScreenData();
    await flushScreenDataCachePersistence();
    jest.clearAllMocks();
  });

  it('hydrates only allow-listed public data from disk', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(2_000);
    mockedFileSystem.getInfoAsync.mockResolvedValue({ exists: true } as Awaited<ReturnType<typeof FileSystem.getInfoAsync>>);
    mockedFileSystem.readAsStringAsync.mockResolvedValue(JSON.stringify({
      version: 1,
      entries: [
        { key: 'home:categories', value: ['public'], updatedAt: 1_000, maxAgeMs: 10_000 },
        { key: 'orders:user-a', value: ['private'], updatedAt: 1_000, maxAgeMs: 10_000 },
      ],
    }));

    await hydrateScreenDataCache();

    expect(readScreenData('home:categories')).toEqual(['public']);
    expect(readScreenData('orders:user-a')).toBeUndefined();
  });

  it('reuses data across screen instances while it is fresh', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_000);
    writeScreenData('favorites:user-a', { items: ['product-a'] });

    expect(readScreenData('favorites:user-a')).toEqual({ items: ['product-a'] });
  });

  it('expires old data and isolates cache keys', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000);
    writeScreenData('orders:user-a', ['order-a']);
    writeScreenData('orders:user-b', ['order-b']);

    now.mockReturnValue(7_001);
    expect(readScreenData('orders:user-a', 6_000)).toBeUndefined();
    expect(readScreenData('orders:user-b', 10_000)).toEqual(['order-b']);
  });

  it('invalidates only the requested prefix', () => {
    writeScreenData('cart:user-a', { total: 1 });
    writeScreenData('orders:user-a', { total: 2 });

    invalidateScreenData('cart:');

    expect(readScreenData('cart:user-a')).toBeUndefined();
    expect(readScreenData('orders:user-a')).toEqual({ total: 2 });
  });

  it('publishes invalidation revisions only to overlapping cache scopes', () => {
    const cartRevision = getScreenDataInvalidationRevision('cart:');
    const orderRevision = getScreenDataInvalidationRevision('orders:');

    invalidateScreenData('cart:');

    expect(getScreenDataInvalidationRevision('cart:')).toBeGreaterThan(cartRevision);
    expect(getScreenDataInvalidationRevision('orders:')).toBe(orderRevision);
  });

  it('persists public catalog data without writing private account data', async () => {
    writeScreenData('home:best-sellers', ['product-a']);
    writeScreenData('orders:user-a', ['order-a']);
    await flushScreenDataCachePersistence();

    const serialized = mockedFileSystem.writeAsStringAsync.mock.calls.at(-1)?.[1];
    expect(typeof serialized).toBe('string');
    const payload = JSON.parse(serialized as string) as { entries: Array<{ key: string }> };
    expect(payload.entries.map((entry) => entry.key)).toContain('home:best-sellers');
    expect(payload.entries.map((entry) => entry.key)).not.toContain('orders:user-a');
  });

  it('evicts the least recently used entry when memory capacity is exceeded', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_000);
    for (let index = 0; index <= 100; index += 1) {
      writeScreenData(`private:${index}`, index);
    }

    expect(readScreenData('private:0')).toBeUndefined();
    expect(readScreenData('private:100')).toBe(100);
  });
});
