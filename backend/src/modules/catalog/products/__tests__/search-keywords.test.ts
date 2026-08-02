import {
  buildSearchKeywordSuggestions,
  expandMaterialTokenGroups,
} from '../search-keywords';

describe('buildSearchKeywordSuggestions', () => {
  it('builds shopee-style suggestions for Vietnamese clothing queries', () => {
    const suggestions = buildSearchKeywordSuggestions({ query: 'áo nam' });

    expect(suggestions).toEqual(expect.arrayContaining([
      'áo nam polo',
      'áo nam kaki',
      'áo nam thể thao',
    ]));
  });

  it('supports unsigned and partial input', () => {
    const suggestions = buildSearchKeywordSuggestions({ query: 'ao nam p' });

    expect(suggestions[0]).toBe('áo nam polo');
  });

  it('builds marketplace-style pants suggestions', () => {
    const suggestions = buildSearchKeywordSuggestions({ query: 'quần' });

    expect(suggestions.slice(0, 4)).toEqual([
      'quần jean nam',
      'quần short nam',
      'quần jean nữ',
      'quần ống rộng nữ',
    ]);
  });

  it('collapses multi-word material aliases into a single synonym group', () => {
    expect(expandMaterialTokenGroups(['co', 'ton'])).toEqual([
      expect.arrayContaining(['cotton', 'cô tông', 'bông']),
    ]);
    expect(expandMaterialTokenGroups(['da', 'that'])).toEqual([
      expect.arrayContaining(['leather', 'da', 'da thật']),
    ]);
  });

  it('does not treat a product type as an equivalent material', () => {
    expect(expandMaterialTokenGroups(['ao', 'thun'])).toEqual([['ao'], ['thun']]);
    expect(expandMaterialTokenGroups(['hoodie'])).toEqual([['hoodie']]);
  });
});
