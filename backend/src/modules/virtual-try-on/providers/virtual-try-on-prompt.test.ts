import { buildVirtualTryOnPrompt } from './virtual-try-on-prompt';
import type { VirtualTryOnProviderGarment } from './virtual-try-on-provider';

const garment = (overrides: Partial<VirtualTryOnProviderGarment>): VirtualTryOnProviderGarment => ({
  role: 'top',
  productId: 'product-1',
  variantId: 'variant-1',
  colorVariantId: 'color-1',
  imageUrl: 'https://example.com/product.png',
  name: 'Cotton T-shirt',
  color: 'blue',
  size: 'M',
  ...overrides,
});

describe('buildVirtualTryOnPrompt', () => {
  it('adds richer role, garment fidelity, and preset vocabulary', () => {
    const result = buildVirtualTryOnPrompt({
      preset: 'work',
      outfitMode: 'full_set',
      garments: [
        garment({ role: 'top', name: 'Oxford shirt', color: 'white' }),
        garment({ role: 'bottom', name: 'Straight jeans', color: 'indigo' }),
        garment({ role: 'shoes', name: 'Leather sneakers', color: 'black' }),
      ],
    });

    expect(result.prompt).toContain('align neckline, shoulders, sleeves');
    expect(result.prompt).toContain('align waistband, hips, rise');
    expect(result.prompt).toContain('correct left-right pairing');
    expect(result.prompt).toContain('faithfully transfer garment type, color, fabric texture');
    expect(result.prompt).toContain('clean professional styling');
    expect(result.prompt).toContain('coordinate all selected garments into a complete outfit');
    expect(result.negativePrompt).toContain('missing selected garment');
    expect(result.negativePrompt).toContain('floating shoes');
  });

  it('keeps custom scene wording while using outfit mode vocabulary', () => {
    const result = buildVirtualTryOnPrompt({
      preset: 'custom',
      outfitMode: 'top_bottom',
      customPrompt: 'warm coffee shop with window light',
      garments: [
        garment({ role: 'top', name: 'Linen shirt' }),
        garment({ role: 'bottom', name: 'Wide-leg trousers' }),
      ],
    });

    expect(result.prompt).toContain('scene requested by user: warm coffee shop with window light');
    expect(result.prompt).toContain('combine the selected top and bottom into a coherent outfit');
  });
});
