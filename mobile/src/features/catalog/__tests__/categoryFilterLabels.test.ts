import {
  ALL_CATEGORY_FILTER_LABEL,
  getCategoryFilterOptionLabel,
} from '../categoryFilterLabels';

describe('category filter labels', () => {
  it('uses a concise label for a catch-all child category', () => {
    expect(getCategoryFilterOptionLabel('Giày / Dép', 'Giày / Dép khác')).toBe('Khác');
    expect(getCategoryFilterOptionLabel('Áo', 'Áo khác')).toBe('Khác');
  });

  it('keeps specific category names unchanged', () => {
    expect(getCategoryFilterOptionLabel('Giày / Dép', 'Giày cao gót')).toBe('Giày cao gót');
    expect(getCategoryFilterOptionLabel('Áo', 'Áo khoác')).toBe('Áo khoác');
  });

  it('exposes the shared all-categories label', () => {
    expect(ALL_CATEGORY_FILTER_LABEL).toBe('Tất cả');
  });
});
