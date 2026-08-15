import type { VirtualTryOnQueueProcessorContext } from './virtual-try-on.queue';

const imageErrorsSafeBeforeSubmission = new Set([
  'COMFY_RATE_LIMITED',
  'COMFY_UPLOAD_FAILED',
]);

const imageErrorsSafeAfterSubmission = new Set([
  'COMFY_TIMEOUT',
  'COMFY_HISTORY_REQUEST_FAILED',
  'COMFY_REQUEST_FAILED',
  'COMFY_RATE_LIMITED',
]);

const videoErrorsSafeBeforeSubmission = new Set([
  'VIDEO_PROVIDER_RATE_LIMITED',
]);

const videoErrorsSafeAfterSubmission = new Set([
  'VIDEO_PROVIDER_TIMEOUT',
  'VIDEO_PROVIDER_RATE_LIMITED',
  'VIDEO_PROVIDER_FAILED',
]);

export const DEFAULT_VIRTUAL_TRY_ON_ATTEMPTS = 3;

export const hasVirtualTryOnRetryRemaining = (
  context: VirtualTryOnQueueProcessorContext | undefined,
) => Boolean(context && context.attemptsMade + 1 < context.maxAttempts);

export const isRetryableVirtualTryOnImageError = (
  errorCode: string,
  hasProviderJobId: boolean,
) => (hasProviderJobId
  ? imageErrorsSafeAfterSubmission.has(errorCode)
  : imageErrorsSafeBeforeSubmission.has(errorCode));

export const isRetryableVirtualTryOnVideoError = (
  errorCode: string,
  hasProviderJobId: boolean,
) => (hasProviderJobId
  ? videoErrorsSafeAfterSubmission.has(errorCode)
  : videoErrorsSafeBeforeSubmission.has(errorCode));
