jest.mock('../apiCache', () => ({ invalidateCache: jest.fn() }));
jest.mock('../screenDataCache', () => ({ invalidateScreenData: jest.fn() }));

import { invalidateCache } from '../apiCache';
import { invalidateScreenData } from '../screenDataCache';
import {
  clearUserScopedCaches,
  invalidateAfterMutation,
  invalidateCatalogCaches,
  invalidateOrderCaches,
} from '../cacheInvalidation';

const mockedInvalidateCache = invalidateCache as jest.MockedFunction<typeof invalidateCache>;
const mockedInvalidateScreenData = invalidateScreenData as jest.MockedFunction<typeof invalidateScreenData>;

describe('mobile cache invalidation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('clears every user-scoped cache without deleting public catalog detail data', () => {
    clearUserScopedCaches();

    expect(mockedInvalidateScreenData.mock.calls.map(([prefix]) => prefix)).toEqual([
      'home:recommendations:',
      'catalog:list:',
      'cart:',
      'favorites:',
      'orders:',
      'notifications:',
    ]);
    expect(mockedInvalidateCache).toHaveBeenCalledWith('orderSummary:');
    expect(mockedInvalidateScreenData).not.toHaveBeenCalledWith('catalog:detail:');
  });

  it('invalidates order summaries together with order screens', () => {
    invalidateOrderCaches();

    expect(mockedInvalidateScreenData).toHaveBeenCalledWith('orders:');
    expect(mockedInvalidateCache).toHaveBeenCalledWith('orderSummary:');
  });

  it('can invalidate one product while refreshing catalog lists', () => {
    invalidateCatalogCaches('product-a');

    expect(mockedInvalidateCache).toHaveBeenCalledWith('product:product-a');
    expect(mockedInvalidateScreenData).toHaveBeenCalledWith('catalog:detail:product-a');
    expect(mockedInvalidateScreenData).toHaveBeenCalledWith('catalog:list:');
    expect(mockedInvalidateScreenData).toHaveBeenCalledWith('home:best-sellers');
  });

  it('runs invalidation only after a successful mutation', async () => {
    const invalidate = jest.fn();
    await expect(invalidateAfterMutation(Promise.resolve('ok'), invalidate)).resolves.toBe('ok');
    expect(invalidate).toHaveBeenCalledTimes(1);

    invalidate.mockClear();
    await expect(invalidateAfterMutation(Promise.reject(new Error('failed')), invalidate)).rejects.toThrow('failed');
    expect(invalidate).not.toHaveBeenCalled();
  });
});
