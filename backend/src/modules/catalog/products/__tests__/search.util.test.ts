import { toAccentInsensitiveRegex, tokenize } from '../search.util';

describe('search.util', () => {
  it('matches unsigned tokens against Vietnamese product names', () => {
    expect(toAccentInsensitiveRegex('quan').test('Quần jean nam')).toBe(true);
    expect(toAccentInsensitiveRegex('ao').test('Áo polo nam')).toBe(true);
    expect(toAccentInsensitiveRegex('nu').test('Quần ống rộng nữ')).toBe(true);
  });

  it('tokenizes Vietnamese keywords to unsigned search tokens', () => {
    expect(tokenize('quần jean nữ')).toEqual(['quan', 'jean', 'nu']);
  });
});
