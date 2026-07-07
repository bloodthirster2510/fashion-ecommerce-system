import { createComfyVirtualTryOnProvider } from './comfy-virtual-try-on.provider';
import { createMockVirtualTryOnProvider } from './mock-virtual-try-on.provider';
import type { VirtualTryOnProvider } from './virtual-try-on-provider';
import { VirtualTryOnProviderError } from './virtual-try-on-provider';

export {
  buildVirtualTryOnPrompt,
} from './virtual-try-on-prompt';
export type {
  VirtualTryOnProvider,
  VirtualTryOnProviderBinaryOutput,
  VirtualTryOnProviderGarment,
  VirtualTryOnProviderInput,
  VirtualTryOnProviderResult,
} from './virtual-try-on-provider';
export { VirtualTryOnProviderError } from './virtual-try-on-provider';

export const createVirtualTryOnProvider = (providerName: string): VirtualTryOnProvider => {
  switch (providerName) {
    case 'mock':
      return createMockVirtualTryOnProvider();
    case 'comfy':
    case 'comfyui':
      return createComfyVirtualTryOnProvider();
    case 'disabled':
      throw new VirtualTryOnProviderError(
        'Tính năng phối đồ ảo đang tắt',
        503,
        'VIRTUAL_TRY_ON_DISABLED',
      );
    default:
      throw new VirtualTryOnProviderError(
        `Provider ${providerName} chưa được tích hợp cho phối đồ ảo`,
        502,
        'PROVIDER_NOT_CONFIGURED',
      );
  }
};
