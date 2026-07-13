import {
  calculateAnalyticsChangePercent,
  calculateAnalyticsRate,
  normalizeRecommendationAnalyticsQuery,
} from '../recommendation-analytics.service';

jest.mock('../../../database/models', () => ({
  Product: {},
  RecommendationEvent: {},
  RecommendationRequest: {},
  SearchHistory: {},
  UserProductInteraction: {},
  RECOMMENDATION_CONTEXTS: ['home', 'product_detail_similar', 'cart'],
}));

describe('recommendation analytics helpers', () => {
  it('normalizes rates without leaking NaN or Infinity to the dashboard', () => {
    expect(calculateAnalyticsRate(3, 12)).toBe(0.25);
    expect(calculateAnalyticsRate(1, 3)).toBe(0.3333);
    expect(calculateAnalyticsRate(2, 0)).toBe(0);
    expect(calculateAnalyticsChangePercent(15, 10)).toBe(50);
    expect(calculateAnalyticsChangePercent(3, 0)).toBeNull();
    expect(calculateAnalyticsChangePercent(0, 0)).toBe(0);
  });

  it('builds the current and previous analytics windows from filters', () => {
    const result = normalizeRecommendationAnalyticsQuery(
      {
        from: '2026-07-01',
        to: '2026-07-10',
        context: 'cart',
        algorithmVersion: 'v3_cart_complementary',
      },
      new Date('2026-07-13T10:00:00.000Z'),
    );

    expect(result.filters).toEqual({
      context: 'cart',
      algorithmVersion: 'v3_cart_complementary',
    });
    expect(result.range.from.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    expect(result.range.to.toISOString().startsWith('2026-07-10')).toBe(true);
    expect(result.range.previousTo.getTime()).toBe(result.range.from.getTime() - 1);
  });

  it('rejects invalid filters before querying MongoDB', () => {
    expect(() => normalizeRecommendationAnalyticsQuery({ days: '181' })).toThrow(
      'Recommendation analytics days must be from 1 to 180',
    );
    expect(() => normalizeRecommendationAnalyticsQuery({ context: 'checkout' })).toThrow(
      'Invalid recommendation context',
    );
    expect(() => normalizeRecommendationAnalyticsQuery({ from: '2026-07-10', to: '2026-07-01' }))
      .toThrow('Recommendation analytics end date must be after start date');
  });
});
