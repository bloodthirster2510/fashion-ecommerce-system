import { normalizeProductDescription } from '../productDescription';

describe('normalizeProductDescription', () => {
  it('preserves source line breaks while removing extra spaces', () => {
    expect(normalizeProductDescription('Dòng một\n  Dòng   hai\n\nDòng ba')).toBe(
      'Dòng một\nDòng hai\nDòng ba',
    );
  });

  it('converts common scraped HTML blocks into readable lines', () => {
    expect(normalizeProductDescription('<p>Chất liệu cotton</p><ul><li>Mềm</li><li>Thoáng</li></ul>')).toBe(
      'Chất liệu cotton\n• Mềm\n• Thoáng',
    );
  });
});
