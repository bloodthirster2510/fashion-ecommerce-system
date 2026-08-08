import { buildVirtualTryOnPrompt, buildVirtualTryOnVideoPrompt } from './virtual-try-on-prompt';
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
    expect(result.prompt).toContain('align waistband, belt loops, hips, rise');
    expect(result.prompt).toContain('correct left-right pairing');
    expect(result.prompt).toContain('faithfully transfer garment type, color, fabric texture');
    expect(result.prompt).toContain('source person image is the only reference for face, identity');
    expect(result.prompt).toContain('do not copy or infer any face, body shape, pose');
    expect(result.prompt).toContain('clean professional styling');
    expect(result.prompt).toContain('complete outfit try-on');
    expect(result.prompt).toContain('show the pair on the feet with correct scale');
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
    expect(result.prompt).toContain('two-piece outfit try-on');
    expect(result.prompt).toContain('resolve the waist overlap naturally');
  });

  it('keeps unrelated garments unchanged for a single top try-on', () => {
    const result = buildVirtualTryOnPrompt({
      preset: 'none',
      outfitMode: 'single',
      garments: [
        garment({ role: 'top', name: 'Striped long-sleeve shirt', color: 'white navy' }),
      ],
    });

    expect(result.prompt).toContain('single top try-on');
    expect(result.prompt).toContain('preserve the original pants or skirt, shoes, accessories');
    expect(result.negativePrompt).toContain('changed pants or shoes when only top is selected');
  });

  it('adapts prompt framing for an upper-body source crop', () => {
    const result = buildVirtualTryOnPrompt({
      preset: 'none',
      outfitMode: 'single',
      sourceImageProfile: {
        bodyVisibility: 'good',
        visibleRegions: ['upper'],
        supportedModes: ['top', 'outerwear', 'accessory'],
        recommendedMode: 'top',
      },
      garments: [
        garment({ role: 'top', name: 'Striped long-sleeve shirt', color: 'white navy' }),
      ],
    });

    expect(result.prompt).toContain('preserve the original camera framing, crop');
    expect(result.prompt).toContain('source image is an upper-body crop');
    expect(result.prompt).toContain('without inventing legs or feet');
    expect(result.prompt).not.toContain('height, shoulder width, waist, legs, and skin tone');
  });

  it('uses footwear-specific instructions for shoes-only try-on', () => {
    const result = buildVirtualTryOnPrompt({
      preset: 'casual',
      outfitMode: 'single',
      garments: [
        garment({ role: 'shoes', name: 'Black leather sandals', color: 'black' }),
      ],
    });

    expect(result.prompt).toContain('single footwear try-on');
    expect(result.prompt).toContain('both selected shoes must be worn on the correct feet');
    expect(result.negativePrompt).toContain('bare feet');
    expect(result.negativePrompt).toContain('shoes on wrong feet');
  });

  it('adapts prompt framing for a feet source crop', () => {
    const result = buildVirtualTryOnPrompt({
      preset: 'casual',
      outfitMode: 'single',
      sourceImageProfile: {
        bodyVisibility: 'good',
        visibleRegions: ['feet'],
        supportedModes: ['shoes'],
        recommendedMode: 'shoes',
      },
      garments: [
        garment({ role: 'shoes', name: 'Black leather sandals', color: 'black' }),
      ],
    });

    expect(result.prompt).toContain('source image is a feet or footwear crop');
    expect(result.prompt).toContain('without inventing upper body or face');
  });

  it('handles dress, outerwear, shoes, and accessory as a full outfit recipe', () => {
    const result = buildVirtualTryOnPrompt({
      preset: 'party',
      outfitMode: 'full_set',
      garments: [
        garment({ role: 'dress', name: 'Midi dress', color: 'emerald' }),
        garment({ role: 'outerwear', name: 'Cream blazer', color: 'cream' }),
        garment({ role: 'shoes', name: 'Pointed heels', color: 'nude' }),
        garment({ role: 'accessory', name: 'Small shoulder bag', color: 'gold' }),
      ],
    });

    expect(result.prompt).toContain('treat it as the main body garment');
    expect(result.prompt).toContain('make it sit above the top or dress');
    expect(result.prompt).toContain('place them naturally without covering the face');
    expect(result.negativePrompt).toContain('dress split into separate top and bottom');
    expect(result.negativePrompt).toContain('accessory floating');
  });
});

describe('buildVirtualTryOnVideoPrompt', () => {
  it('uses the generated try-on image as an exact first frame and preserves the outfit', () => {
    const result = buildVirtualTryOnVideoPrompt({
      preset: 'party',
      durationSeconds: 8,
      customPrompt: 'evening event with warm lights',
    });

    expect(result.prompt).toContain('exact first frame');
    expect(result.prompt).toContain('continuous 8-second photorealistic fashion shot');
    expect(result.prompt).not.toContain('five-second');
    expect(result.prompt).toContain('small coordinated hip and shoulder turn');
    expect(result.prompt).toContain('ease smoothly into one simple movement');
    expect(result.prompt).toContain('natural acceleration and deceleration');
    expect(result.prompt).toContain('planted feet and hips initiate the weight transfer');
    expect(result.prompt).toContain('fabric reacts a moment after the body');
    expect(result.prompt).toContain('locked-off camera, stable perspective');
    expect(result.prompt).toContain('complete outfit, garment details, accessories, shoes');
    expect(result.prompt).toContain('keep the existing user scene context: evening event with warm lights');
    expect(result.negativePrompt).toContain('identity, face, body shape, or skin tone change');
    expect(result.negativePrompt).toContain('fabric melting');
    expect(result.negativePrompt).toContain('robotic motion');
    expect(result.negativePrompt).toContain('foot sliding');
    expect(result.negativePrompt).toContain('camera shake or drift');
  });

  it('stays within the Kling single-prompt limit when the avoid list is appended', () => {
    const result = buildVirtualTryOnVideoPrompt({
      preset: 'none',
      durationSeconds: 12,
      customPrompt: 'x'.repeat(200),
    });
    const effectivePrompt = [
      result.prompt,
      'STRICT AVOID LIST — none of the following outcomes may appear in the result:',
      result.negativePrompt,
    ].join('\n\n');

    expect(effectivePrompt.length).toBeLessThanOrEqual(2500);
  });

  it.each([
    ['work', 'gently straightens their posture'],
    ['casual', 'showing the outfit to a friend'],
    ['travel', 'faint steady breeze'],
    ['sport', 'softly flexing knees'],
    ['date', 'slight head tilt'],
  ] as const)('uses coordinated, restrained motion for the %s preset', (preset, expectedMotion) => {
    const result = buildVirtualTryOnVideoPrompt({
      preset,
      durationSeconds: 5,
    });

    expect(result.prompt).toContain(expectedMotion);
    expect(result.prompt).toContain('gently settle into a balanced final pose');
  });
});
