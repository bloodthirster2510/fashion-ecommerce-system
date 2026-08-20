import {
  getVirtualTryOnCompletion,
  isVirtualTryOnRoute,
} from '../VirtualTryOnCompletionBanner';
import type { VirtualTryOnRealtimeEvent } from '../virtualTryOnRealtime';

const event = (
  overrides: Partial<VirtualTryOnRealtimeEvent> = {},
): VirtualTryOnRealtimeEvent => ({
  type: 'progress',
  jobId: '665000000000000000000301',
  status: 'processing',
  progress: 65,
  processingStage: 'image_persisting',
  generatedImageUrl: null,
  generatedImageUrls: [],
  generatedVideoUrl: null,
  videoStatus: 'queued',
  videoProgress: 0,
  updatedAt: '2026-08-20T01:00:10.000Z',
  at: '2026-08-20T01:00:10.000Z',
  ...overrides,
});

describe('getVirtualTryOnCompletion', () => {
  it('detects the image milestone while video is still queued', () => {
    expect(getVirtualTryOnCompletion(event({
      generatedImageUrl: 'https://example.com/look.jpg',
      generatedImageUrls: ['https://example.com/look.jpg', 'https://example.com/look-2.jpg'],
    }))).toEqual({
      key: '665000000000000000000301:image',
      jobId: '665000000000000000000301',
      kind: 'image',
      imageUrl: 'https://example.com/look.jpg',
      imageCount: 2,
    });
  });

  it('prioritizes the video milestone on the final combined event', () => {
    expect(getVirtualTryOnCompletion(event({
      type: 'succeeded',
      status: 'succeeded',
      progress: 100,
      processingStage: 'completed',
      generatedImageUrl: 'https://example.com/look.jpg',
      generatedVideoUrl: 'https://example.com/look.mp4',
      videoStatus: 'succeeded',
      videoProgress: 100,
    }))).toMatchObject({
      key: '665000000000000000000301:video',
      kind: 'video',
      imageUrl: 'https://example.com/look.jpg',
    });
  });

  it('ignores progress events that do not contain completed media', () => {
    expect(getVirtualTryOnCompletion(event())).toBeNull();
  });
});

describe('isVirtualTryOnRoute', () => {
  it('suppresses the banner across the virtual try-on flow', () => {
    expect(isVirtualTryOnRoute('VirtualTryOnBuilder')).toBe(true);
    expect(isVirtualTryOnRoute('VirtualTryOnResult')).toBe(true);
    expect(isVirtualTryOnRoute('Home')).toBe(false);
  });
});
