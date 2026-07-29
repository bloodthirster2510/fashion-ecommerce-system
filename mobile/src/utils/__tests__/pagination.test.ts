import { hasNextPage, mergePageItems } from '../pagination';

describe('pagination helpers', () => {
  it('appends unseen items and refreshes duplicates without changing their position', () => {
    expect(mergePageItems(
      [{ _id: 'a', value: 1 }, { _id: 'b', value: 2 }],
      [{ _id: 'b', value: 20 }, { _id: 'c', value: 3 }],
    )).toEqual([
      { _id: 'a', value: 1 },
      { _id: 'b', value: 20 },
      { _id: 'c', value: 3 },
    ]);
  });

  it('reports whether another numbered page is available', () => {
    expect(hasNextPage({ page: 1, limit: 20, totalItems: 21, totalPages: 2 })).toBe(true);
    expect(hasNextPage({ page: 2, limit: 20, totalItems: 21, totalPages: 2 })).toBe(false);
    expect(hasNextPage(null)).toBe(false);
  });
});
