import { resolveSuggestionImage } from '../product.suggest.service';

describe('product search suggestions', () => {
  it('keeps a legacy catalog image host from breaking the suggestion response', () => {
    const legacyImage = 'https://buggy.yodycdn.com/images/product/polo.webp';

    expect(resolveSuggestionImage(legacyImage, 'https://res.cloudinary.com/demo/fallback.webp'))
      .toBe(legacyImage);
  });

  it('falls back to the product image when a variant has no image', () => {
    const productImage = 'https://res.cloudinary.com/demo/product.webp';

    expect(resolveSuggestionImage(undefined, productImage)).toBe(productImage);
  });
});
