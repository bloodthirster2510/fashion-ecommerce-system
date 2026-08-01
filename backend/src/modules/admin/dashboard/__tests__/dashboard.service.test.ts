import {
  calculateDashboardChange,
  dashboardLowStockCondition,
  normalizeDashboardRange,
} from '../dashboard.service';

jest.mock('../../../../database/models', () => ({
  Inventory: {},
  Order: {},
  Product: {},
  User: {},
}));

describe('dashboard analytics helpers', () => {
  it('builds a Bangkok-aligned current and previous window', () => {
    const range = normalizeDashboardRange(
      { days: '7' },
      new Date('2026-07-14T10:00:00.000Z'),
    );

    expect(range.days).toBe(7);
    expect(range.from.toISOString()).toBe('2026-07-07T17:00:00.000Z');
    expect(range.to.toISOString()).toBe('2026-07-14T10:00:00.000Z');
    expect(range.previousFrom.toISOString()).toBe('2026-06-30T17:00:00.000Z');
    expect(range.previousTo.toISOString()).toBe('2026-07-07T17:00:00.000Z');
  });

  it('validates the requested duration', () => {
    expect(() => normalizeDashboardRange({ days: '0' })).toThrow('Dashboard days must be from 1 to 180');
    expect(() => normalizeDashboardRange({ days: '181' })).toThrow('Dashboard days must be from 1 to 180');
    expect(() => normalizeDashboardRange({ days: 'abc' })).toThrow('Dashboard days must be from 1 to 180');
  });

  it('calculates comparison changes without leaking infinity', () => {
    expect(calculateDashboardChange(120, 100)).toBe(20);
    expect(calculateDashboardChange(0, 0)).toBe(0);
    expect(calculateDashboardChange(10, 0)).toBeNull();
  });

  it('keeps out-of-stock SKUs separate from the low-stock count', () => {
    expect(dashboardLowStockCondition).toEqual({
      $and: [
        { $gt: ['$availableQuantity', 0] },
        { $lte: ['$availableQuantity', 5] },
      ],
    });
  });
});

