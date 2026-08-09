import { resolveFocusRefreshMode } from '../useStaleFocusEffect';

describe('resolveFocusRefreshMode', () => {
  it('uses a blocking load until the current query has data', () => {
    expect(resolveFocusRefreshMode(null, 'catalog:all', 'refresh')).toBe('loading');
    expect(resolveFocusRefreshMode('catalog:male', 'catalog:female', 'silent')).toBe('loading');
  });

  it('uses the requested background mode for the same query', () => {
    expect(resolveFocusRefreshMode('catalog:all', 'catalog:all', 'refresh')).toBe('refresh');
    expect(resolveFocusRefreshMode('orders:user-a', 'orders:user-a', 'silent')).toBe('silent');
  });
});
