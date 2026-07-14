import type { VirtualTryOnVideoProvider } from './virtual-try-on-video-provider';
import { VirtualTryOnVideoProviderError } from './virtual-try-on-video-provider';

export const createMockVirtualTryOnVideoProvider = (): VirtualTryOnVideoProvider => ({
  async submit(input) {
    return {
      providerJobId: `mock-video-${input.jobId}-${Date.now()}`,
      metadata: {
        mock: true,
        sourceImageUrl: input.sourceImageUrl,
        durationSeconds: input.durationSeconds,
        resolution: input.resolution,
      },
    };
  },

  async waitForResult(providerJobId) {
    const videoUrl = process.env.VIRTUAL_TRY_ON_MOCK_VIDEO_URL?.trim();
    if (!videoUrl) {
      throw new VirtualTryOnVideoProviderError(
        'Thiếu VIRTUAL_TRY_ON_MOCK_VIDEO_URL để giả lập kết quả video',
        500,
        'VIDEO_MOCK_OUTPUT_MISSING',
      );
    }

    return {
      videoUrl,
      metadata: { mock: true, providerJobId },
    };
  },
});
