import type { VirtualTryOnRealtimeEvent } from './virtualTryOnRealtime';
import type { VirtualTryOnJob } from './virtualTryOn.types';

const terminalStatuses = new Set<VirtualTryOnJob['status']>([
  'succeeded',
  'failed',
  'canceled',
]);
const statusOrder: Record<VirtualTryOnJob['status'], number> = {
  queued: 0,
  processing: 1,
  succeeded: 2,
  failed: 2,
  canceled: 2,
};

const timestamp = (value: string) => {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};

export const preferFreshVirtualTryOnJob = (
  current: VirtualTryOnJob,
  incoming: VirtualTryOnJob,
) => {
  if (current._id !== incoming._id) return incoming;

  const currentTimestamp = timestamp(current.updatedAt);
  const incomingTimestamp = timestamp(incoming.updatedAt);
  if (currentTimestamp !== null && incomingTimestamp !== null) {
    if (incomingTimestamp < currentTimestamp) return current;
    if (incomingTimestamp > currentTimestamp) return incoming;
  }

  if (terminalStatuses.has(current.status) && !terminalStatuses.has(incoming.status)) {
    return current;
  }
  if (statusOrder[incoming.status] < statusOrder[current.status]) {
    return current;
  }
  if (current.status === incoming.status && incoming.progress < current.progress) {
    return current;
  }
  if (current.videoStatus === incoming.videoStatus && incoming.videoProgress < current.videoProgress) {
    return current;
  }
  return incoming;
};

export const mergeVirtualTryOnRealtimeEvent = (
  current: VirtualTryOnJob,
  event: VirtualTryOnRealtimeEvent,
) => {
  if (event.jobId !== current._id) return current;

  return preferFreshVirtualTryOnJob(current, {
    ...current,
    status: event.status,
    progress: event.progress,
    processingStage: event.processingStage ?? current.processingStage,
    generatedImageUrl: event.generatedImageUrl !== undefined
      ? event.generatedImageUrl
      : current.generatedImageUrl,
    generatedImageUrls: event.generatedImageUrls ?? current.generatedImageUrls,
    generatedVideoUrl: event.generatedVideoUrl !== undefined
      ? event.generatedVideoUrl
      : current.generatedVideoUrl,
    videoStatus: event.videoStatus ?? current.videoStatus,
    videoProgress: event.videoProgress ?? current.videoProgress,
    videoErrorCode: event.videoErrorCode !== undefined
      ? event.videoErrorCode
      : current.videoErrorCode,
    videoErrorMessage: event.videoErrorMessage !== undefined
      ? event.videoErrorMessage
      : current.videoErrorMessage,
    errorCode: event.errorCode !== undefined ? event.errorCode : current.errorCode,
    errorMessage: event.errorMessage !== undefined ? event.errorMessage : current.errorMessage,
    updatedAt: event.updatedAt,
  });
};
