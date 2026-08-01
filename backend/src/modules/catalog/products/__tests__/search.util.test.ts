import { toAccentInsensitiveRegex, toExactPhraseRegex, tokenize } from '../search.util';

describe('search.util', () => {
  it('matches unsigned tokens against Vietnamese product names', () => {
    expect(toAccentInsensitiveRegex('quan').test('Quần jean nam')).toBe(true);
    expect(toAccentInsensitiveRegex('ao').test('Áo polo nam')).toBe(true);
    expect(toAccentInsensitiveRegex('nu').test('Quần ống rộng nữ')).toBe(true);
  });

  it('tokenizes Vietnamese keywords to unsigned search tokens', () => {
    expect(tokenize('quần jean nữ')).toEqual(['quan', 'jean', 'nu']);
  });

  it('matches complete material words without matching fragments or another tone', () => {
    expect(toExactPhraseRegex('da').test('Giày da saffiano')).toBe(true);
    expect(toExactPhraseRegex('da').test('Áo dáng suông dài')).toBe(false);
    expect(toExactPhraseRegex('bông').test('Vải bông mềm')).toBe(true);
    expect(toExactPhraseRegex('bông').test('Bề mặt bóng đẹp')).toBe(false);
  });
});
