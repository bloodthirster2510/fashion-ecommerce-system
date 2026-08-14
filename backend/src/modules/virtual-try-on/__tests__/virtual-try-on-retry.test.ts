import {
  hasVirtualTryOnRetryRemaining,
  isRetryableVirtualTryOnImageError,
  isRetryableVirtualTryOnVideoError,
} from '../virtual-try-on-retry';

describe('virtual try-on retry policy', () => {
  it('retries a timeout only when the existing ComfyUI prompt can be resumed', () => {
    expect(isRetryableVirtualTryOnImageError('COMFY_TIMEOUT', true)).toBe(true);
    expect(isRetryableVirtualTryOnImageError('COMFY_TIMEOUT', false)).toBe(false);
  });

  it('allows safe pre-submission retries but rejects terminal image errors', () => {
    expect(isRetryableVirtualTryOnImageError('COMFY_RATE_LIMITED', false)).toBe(true);
    expect(isRetryableVirtualTryOnImageError('COMFY_UPLOAD_FAILED', false)).toBe(true);
    expect(isRetryableVirtualTryOnImageError('COMFY_NO_CREDITS', true)).toBe(false);
    expect(isRetryableVirtualTryOnImageError('PROVIDER_SAFETY_BLOCKED', true)).toBe(false);
    expect(isRetryableVirtualTryOnImageError('COMFY_CONFIG_MISSING', false)).toBe(false);
  });

  it('only retries a video timeout after its provider job id was persisted', () => {
    expect(isRetryableVirtualTryOnVideoError('VIDEO_PROVIDER_TIMEOUT', true)).toBe(true);
    expect(isRetryableVirtualTryOnVideoError('VIDEO_PROVIDER_TIMEOUT', false)).toBe(false);
    expect(isRetryableVirtualTryOnVideoError('VIDEO_PROVIDER_SAFETY_BLOCKED', true)).toBe(false);
    expect(isRetryableVirtualTryOnVideoError('VIDEO_PROVIDER_NO_CREDITS', true)).toBe(false);
  });

  it('stops retrying on the final configured attempt', () => {
    expect(hasVirtualTryOnRetryRemaining({ attemptsMade: 0, maxAttempts: 3 })).toBe(true);
    expect(hasVirtualTryOnRetryRemaining({ attemptsMade: 1, maxAttempts: 3 })).toBe(true);
    expect(hasVirtualTryOnRetryRemaining({ attemptsMade: 2, maxAttempts: 3 })).toBe(false);
    expect(hasVirtualTryOnRetryRemaining(undefined)).toBe(false);
  });
});
