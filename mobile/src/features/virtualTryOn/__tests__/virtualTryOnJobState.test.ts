import {
  mergeVirtualTryOnRealtimeEvent,
  preferFreshVirtualTryOnJob,
} from '../virtualTryOnJobState';
import type { VirtualTryOnRealtimeEvent } from '../virtualTryOnRealtime';
import type { VirtualTryOnJob } from '../virtualTryOn.types';

const job = (overrides: Partial<VirtualTryOnJob> = {}): VirtualTryOnJob => ({
  _id: '665000000000000000000301',
  status: 'processing',
  progress: 50,
  processingStage: 'image_generation',
  sourceAsset: null,
  sourceImageUrl: 'https://example.com/source.jpg',
  selectedItems: [],
  outfitMode: 'single',
  contextPreset: 'none',
  outputMode: 'image',
  generatedImageUrl: null,
  generatedImageUrls: [],
  generatedVideoUrl: null,
  videoStatus: 'not_requested',
  videoProgress: 0,
  provider: 'mock',
  totalFinalPrice: 0,
  createdAt: '2026-08-02T01:00:00.000Z',
  updatedAt: '2026-08-02T01:00:10.000Z',
  ...overrides,
});

describe('preferFreshVirtualTryOnJob', () => {
  it('keeps a newer terminal state when an older poll finishes late', () => {
    const completed = job({
      status: 'succeeded',
      progress: 100,
      processingStage: 'completed',
      generatedImageUrls: ['https://example.com/result.jpg'],
      updatedAt: '2026-08-02T01:00:20.000Z',
    });
    const stalePoll = job({ updatedAt: '2026-08-02T01:00:15.000Z' });

    expect(preferFreshVirtualTryOnJob(completed, stalePoll)).toBe(completed);
  });

  it('accepts a newer retry even though its status and progress restart', () => {
    const failed = job({
      status: 'failed',
      progress: 100,
      processingStage: 'completed',
      updatedAt: '2026-08-02T01:00:20.000Z',
    });
    const retried = job({
      status: 'queued',
      progress: 0,
      processingStage: 'queued',
      updatedAt: '2026-08-02T01:00:21.000Z',
    });

    expect(preferFreshVirtualTryOnJob(failed, retried)).toBe(retried);
  });

  it('does not regress progress when timestamps are equal', () => {
    const current = job({ progress: 70 });
    const lowerProgress = job({ progress: 40 });

    expect(preferFreshVirtualTryOnJob(current, lowerProgress)).toBe(current);
  });

  it('does not regress status or video progress when timestamps are equal', () => {
    const current = job({
      status: 'processing',
      progress: 70,
      videoStatus: 'processing',
      videoProgress: 50,
    });
    const queued = job({ status: 'queued', progress: 70 });
    const lowerVideoProgress = job({ progress: 70, videoStatus: 'processing', videoProgress: 20 });

    expect(preferFreshVirtualTryOnJob(current, queued)).toBe(current);
    expect(preferFreshVirtualTryOnJob(current, lowerVideoProgress)).toBe(current);
  });
});

describe('mergeVirtualTryOnRealtimeEvent', () => {
  it('ignores an out-of-order realtime event', () => {
    const current = job({
      status: 'succeeded',
      progress: 100,
      processingStage: 'completed',
      generatedImageUrls: ['https://example.com/result.jpg'],
      updatedAt: '2026-08-02T01:00:20.000Z',
    });
    const staleEvent: VirtualTryOnRealtimeEvent = {
      type: 'progress',
      jobId: current._id,
      status: 'processing',
      progress: 80,
      updatedAt: '2026-08-02T01:00:19.000Z',
      at: '2026-08-02T01:00:21.000Z',
    };

    expect(mergeVirtualTryOnRealtimeEvent(current, staleEvent)).toBe(current);
  });

  it('applies a newer event while preserving omitted media fields', () => {
    const current = job({ generatedImageUrls: ['https://example.com/result.jpg'] });
    const event: VirtualTryOnRealtimeEvent = {
      type: 'progress',
      jobId: current._id,
      status: 'processing',
      progress: 75,
      processingStage: 'video_generation',
      videoStatus: 'processing',
      videoProgress: 25,
      updatedAt: '2026-08-02T01:00:11.000Z',
      at: '2026-08-02T01:00:11.000Z',
    };

    expect(mergeVirtualTryOnRealtimeEvent(current, event)).toMatchObject({
      status: 'processing',
      progress: 75,
      processingStage: 'video_generation',
      generatedImageUrls: ['https://example.com/result.jpg'],
      videoStatus: 'processing',
      videoProgress: 25,
      updatedAt: event.updatedAt,
    });
  });
});
