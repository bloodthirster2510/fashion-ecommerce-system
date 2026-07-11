import {
  buildComfyTryOnPrompt,
  configureMultiGarmentInputs,
  getComfySafetyBlockReason,
} from './comfy-virtual-try-on.provider';

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
  it('pins visible identity, body shape, and pose to the person reference image', () => {
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

    expect(prompt).toContain('Use reference image 1 as the only source for the visible person identity cues');
    expect(prompt).toContain('body shape, body proportions');
    expect(prompt).toContain('Never copy or blend in the face, body, pose');
    expect(prompt).toContain('Reference image 1 is the person photo and controls the person appearance');
    expect(prompt).toContain('Reference image 2: top — White shirt, white.');
  });

  it('preserves upper-body crop instead of forcing full-body framing', () => {
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
      {
        bodyVisibility: 'good',
        visibleRegions: ['upper'],
        supportedModes: ['top', 'outerwear', 'accessory'],
        recommendedMode: 'top',
      },
    );

    expect(prompt).toContain('preserve the source upper-body crop');
    expect(prompt).toContain('do not invent legs, feet, or full-body framing');
    expect(prompt).not.toContain('Each of the four cells must show a full-body photo');
  });
});

describe('getComfySafetyBlockReason', () => {
  it('detects Gemini safety blocks from ComfyUI history diagnostics', () => {
    const reason = getComfySafetyBlockReason({
      status: {
        status_str: 'error',
        messages: [
          [
            'execution_error',
            {
              node_id: '9',
              exception_message: 'The image generation request was blocked by safety filters.',
            },
          ],
        ],
      },
    });

    expect(reason).toContain('blocked by safety filters');
  });

  it('detects safety blocks from prompt/node errors', () => {
    const reason = getComfySafetyBlockReason({
      error: {
        type: 'prompt_outputs_failed_validation',
        message: 'finish_reason: SAFETY',
      },
      node_errors: {
        '9': {
          errors: [{ message: 'IMAGE_SAFETY' }],
        },
      },
    });

    expect(reason).toBeTruthy();
  });

  it('does not treat normal safety ratings as a block', () => {
    const reason = getComfySafetyBlockReason({
      status: { status_str: 'success' },
      outputs: {
        '12': {
          images: [{ filename: 'try-on.png', type: 'output' }],
        },
      },
      response: {
        safetyRatings: [
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', probability: 'NEGLIGIBLE' },
        ],
      },
    });

    expect(reason).toBeNull();
  });
});
