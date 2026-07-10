import { buildComfyTryOnPrompt, configureMultiGarmentInputs } from './comfy-virtual-try-on.provider';

describe('configureMultiGarmentInputs', () => {
  it('adds one independent load/resize branch per garment and batches them after the person image', () => {
    const workflow: Record<string, { inputs: Record<string, unknown>; class_type: string }> = {
      '1': { inputs: { image: 'person.png' }, class_type: 'LoadImage' },
      '35': { inputs: { image: 'outfit.png' }, class_type: 'LoadImage' },
      '37': {
        inputs: {
          target_width: ['38', 0],
          target_height: ['38', 1],
          image: ['35', 0],
        },
        class_type: 'ResizeAndPadImage',
      },
      '38': { inputs: { image: ['1', 0] }, class_type: 'GetImageSize' },
      '56': {
        inputs: {
          'images.image0': ['1', 0],
          'images.image1': ['37', 0],
          'images.image4': ['999', 0],
        },
        class_type: 'BatchImagesNode',
      },
    };

    const configured = configureMultiGarmentInputs(
      workflow,
      {
        multiGarment: {
          loadImageNodeId: '35',
          resizeNodeId: '37',
          batchNodeId: '56',
          batchInputPrefix: 'images.image',
          personBatchInputKey: 'images.image0',
        },
      },
      ['top.png', 'bottom.png', 'shoes.png'],
    );

    expect(configured).toBe(true);
    expect(workflow['35'].inputs.image).toBe('top.png');
    expect(workflow['57'].inputs.image).toBe('bottom.png');
    expect(workflow['58'].inputs.image).toEqual(['57', 0]);
    expect(workflow['59'].inputs.image).toBe('shoes.png');
    expect(workflow['60'].inputs.image).toEqual(['59', 0]);
    expect(workflow['56'].inputs).toEqual({
      'images.image0': ['1', 0],
      'images.image1': ['37', 0],
      'images.image2': ['58', 0],
      'images.image3': ['60', 0],
    });
  });
});

describe('buildComfyTryOnPrompt', () => {
  it('pins identity, face, body shape, and pose to the person reference image', () => {
    const prompt = buildComfyTryOnPrompt(
      'base try-on prompt',
      [
        {
          role: 'top',
          productId: 'product-1',
          variantId: 'variant-1',
          colorVariantId: 'color-1',
          imageUrl: 'https://example.com/top.png',
          name: 'White shirt',
          color: 'white',
        },
      ],
      true,
    );

    expect(prompt).toContain('Use reference image 1 as the only source for the person identity, face');
    expect(prompt).toContain('body shape, body proportions');
    expect(prompt).toContain('Never copy or blend in the face, body, pose');
    expect(prompt).toContain('Reference image 1 is the person photo and controls the person appearance');
    expect(prompt).toContain('Reference image 2: top — White shirt, white.');
  });
});
