import {
  calculateAnalyticsChangePercent,
  calculateAnalyticsRate,
  normalizeRecommendationAnalyticsQuery,
  toMetricSnapshot,
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
    expect(result.range.to.toISOString()).toBe('2026-07-10T23:59:59.999Z');
    expect(result.range.previousTo.getTime()).toBe(result.range.from.getTime() - 1);
  });

  it('separates legacy order creation from paid and net attribution', () => {
    const metrics = toMetricSnapshot(
      { requests: 5, recommendations: 10, fallbackRequests: 1 },
      [
        { _id: 'impression', count: 10, amount: 0, reversedCount: 0, reversedAmount: 0 },
        { _id: 'add_to_cart', count: 4, amount: 0, reversedCount: 0, reversedAmount: 0 },
        { _id: 'purchase', count: 2, amount: 0, reversedCount: 0, reversedAmount: 0 },
        { _id: 'order_created', count: 1, amount: 0, reversedCount: 0, reversedAmount: 0 },
        { _id: 'payment_completed', count: 2, amount: 360000, reversedCount: 0, reversedAmount: 0 },
        { _id: 'order_cancelled', count: 1, amount: 180000, reversedCount: 1, reversedAmount: 180000 },
        { _id: 'order_returned', count: 1, amount: 180000, reversedCount: 0, reversedAmount: 0 },
      ],
    );

    expect(metrics.ordersCreated).toBe(3);
    expect(metrics.paymentsCompleted).toBe(2);
    expect(metrics.reversedPayments).toBe(1);
    expect(metrics.netPayments).toBe(1);
    expect(metrics.grossAttributedRevenue).toBe(360000);
    expect(metrics.netAttributedRevenue).toBe(180000);
    expect(metrics.cartToOrderRate).toBe(0.75);
    expect(metrics.orderToPaymentRate).toBe(0.6667);
    expect(metrics.netPaymentRate).toBe(0.1);

    const reversalOnlyWindow = toMetricSnapshot(undefined, [
      { _id: 'order_returned', count: 1, amount: 180000, reversedCount: 1, reversedAmount: 180000 },
    ]);
    expect(reversalOnlyWindow.netPayments).toBe(-1);
    expect(reversalOnlyWindow.netAttributedRevenue).toBe(-180000);
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
    expect(() => normalizeRecommendationAnalyticsQuery({ from: '2026-01-01', to: '2026-07-01' }))
      .toThrow('Recommendation analytics date range cannot exceed 180 days');
  });
});
