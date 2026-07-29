import {
  createSearchEventId,
  mergeSearchHistory,
} from '../searchHistory';

describe('searchHistory helpers', () => {
  it('merges local and server history without case-insensitive duplicates', () => {
    expect(
      mergeSearchHistory(
        ['Áo polo', ' Quần   jean '],
        ['áo polo', 'Váy midi'],
      ),
    ).toEqual(['Áo polo', 'Quần jean', 'Váy midi']);
  });

  it('keeps at most ten recent keywords', () => {
    const keywords = Array.from({ length: 12 }, (_, index) => `keyword-${index}`);
    expect(mergeSearchHistory(keywords, [])).toHaveLength(10);
  });

  it('creates a fresh mobile event id for each search intent', () => {
    const first = createSearchEventId();
    const second = createSearchEventId();

    expect(first).toMatch(/^mobile-[a-z0-9]+-[a-z0-9]+$/);
    expect(second).not.toBe(first);
  });
});
