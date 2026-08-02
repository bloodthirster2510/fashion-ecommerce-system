import { invalidateScreenData, readScreenData, writeScreenData } from '../screenDataCache';

describe('screen data cache', () => {
  beforeEach(() => {
    invalidateScreenData();
    jest.restoreAllMocks();
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
});
