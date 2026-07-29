import {
  buildDateOfBirth,
  buildManualWardCode,
  getDayOptions,
} from '../registerValidation';

describe('register validation helpers', () => {
  const today = new Date(2026, 6, 29);

  it('builds day options for leap years and regular years', () => {
    expect(getDayOptions('2', '2024')).toHaveLength(29);
    expect(getDayOptions('2', '2025')).toHaveLength(28);
    expect(getDayOptions('', '2025')).toHaveLength(31);
  });

  it('accepts a real date for a customer between 13 and 100 years old', () => {
    expect(buildDateOfBirth('29', '2', '2000', today)).toBe('2000-02-29');
    expect(buildDateOfBirth('29', '7', '2013', today)).toBe('2013-07-29');
    expect(buildDateOfBirth('29', '7', '1926', today)).toBe('1926-07-29');
  });

  it('rejects missing, impossible, underage, and overage dates', () => {
    expect(buildDateOfBirth('', '7', '2000', today)).toBeNull();
    expect(buildDateOfBirth('29', '2', '2025', today)).toBeNull();
    expect(buildDateOfBirth('30', '7', '2013', today)).toBeNull();
    expect(buildDateOfBirth('28', '7', '1925', today)).toBeNull();
  });

  it('normalizes fallback ward codes', () => {
    expect(buildManualWardCode('79', '  Phường Bến Nghé  ')).toBe(
      'manual-79-phường-bến-nghé',
    );
    expect(buildManualWardCode('', 'Xã Mới')).toBe('manual-unknown-xã-mới');
  });
});
