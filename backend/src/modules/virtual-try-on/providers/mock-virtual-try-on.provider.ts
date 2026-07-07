import type { VirtualTryOnProvider } from './virtual-try-on-provider';

export const createMockVirtualTryOnProvider = (): VirtualTryOnProvider => ({
  async generate(input) {
    return {
      imageUrl: input.sourceImageUrl,
      videoUrl: null,
      metadata: {
        mock: true,
        prompt: input.prompt,
        negativePrompt: input.negativePrompt,
        note: 'Mock provider returns the source image until an AI image provider is configured.',
      },
    };
  },
});
