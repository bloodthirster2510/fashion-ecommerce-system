import { buildSearchKeywordSuggestions } from '../search-keywords';

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
});
