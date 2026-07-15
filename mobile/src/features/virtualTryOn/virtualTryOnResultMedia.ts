import type { TryOnVideoStatus, VirtualTryOnJob } from './virtualTryOn.types';

type ResultMediaJob = Pick<
  VirtualTryOnJob,
  'status' | 'outputMode' | 'generatedImageUrl' | 'generatedImageUrls' | 'generatedVideoUrl' | 'videoStatus'
>;

export type TryOnVideoPresentation = {
  status: 'not_requested' | 'pending' | 'succeeded' | 'failed' | 'canceled';
  url: string | null;
};

const normalizeUrl = (value?: string | null) => value?.trim() || null;

export const getGeneratedTryOnImageUrls = (
  job: Pick<ResultMediaJob, 'generatedImageUrl' | 'generatedImageUrls'>,
) => {
  const urls = [...(job.generatedImageUrls ?? []), job.generatedImageUrl]
    .map(normalizeUrl)
    .filter((url): url is string => Boolean(url));

  return [...new Set(urls)];
};

const isTerminalJobStatus = (status: ResultMediaJob['status']) =>
  status === 'succeeded' || status === 'failed' || status === 'canceled';

const terminalVideoStatus = (
  status: TryOnVideoStatus,
  hasUrl: boolean,
): TryOnVideoPresentation['status'] => {
  if (status === 'canceled') return 'canceled';
  if (status === 'succeeded' && hasUrl) return 'succeeded';
  return 'failed';
};

export const getTryOnVideoPresentation = (job: ResultMediaJob): TryOnVideoPresentation => {
  if (job.outputMode !== 'image_and_video') {
    return { status: 'not_requested', url: null };
  }

  const url = normalizeUrl(job.generatedVideoUrl);
  if (job.videoStatus === 'failed' || job.videoStatus === 'canceled' || job.videoStatus === 'succeeded') {
    const status = terminalVideoStatus(job.videoStatus, Boolean(url));
    return { status, url: status === 'succeeded' ? url : null };
  }

  if (isTerminalJobStatus(job.status)) {
    return { status: job.status === 'canceled' ? 'canceled' : 'failed', url: null };
  }

  return { status: 'pending', url: null };
};
