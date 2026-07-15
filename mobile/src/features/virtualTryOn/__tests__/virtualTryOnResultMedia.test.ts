import {
  getGeneratedTryOnImageUrls,
  getTryOnVideoPresentation,
} from '../virtualTryOnResultMedia';

describe('virtual try-on result media', () => {
  it('keeps generated images visible when video generation fails', () => {
    const job = {
      status: 'succeeded' as const,
      outputMode: 'image_and_video' as const,
      generatedImageUrl: 'https://cdn.example.com/look-1.png',
      generatedImageUrls: [
        'https://cdn.example.com/look-1.png',
        'https://cdn.example.com/look-2.png',
      ],
      generatedVideoUrl: 'https://cdn.example.com/stale-video.mp4',
      videoStatus: 'failed' as const,
    };

    expect(getGeneratedTryOnImageUrls(job)).toEqual([
      'https://cdn.example.com/look-1.png',
      'https://cdn.example.com/look-2.png',
    ]);
    expect(getTryOnVideoPresentation(job)).toEqual({ status: 'failed', url: null });
  });

  it('shows a video only when both status and URL confirm success', () => {
    const baseJob = {
      status: 'succeeded' as const,
      outputMode: 'image_and_video' as const,
      generatedImageUrl: 'https://cdn.example.com/look.png',
      generatedImageUrls: ['https://cdn.example.com/look.png'],
    };

    expect(getTryOnVideoPresentation({
      ...baseJob,
      generatedVideoUrl: ' https://cdn.example.com/look.mp4 ',
      videoStatus: 'succeeded',
    })).toEqual({ status: 'succeeded', url: 'https://cdn.example.com/look.mp4' });

    expect(getTryOnVideoPresentation({
      ...baseJob,
      generatedVideoUrl: null,
      videoStatus: 'succeeded',
    })).toEqual({ status: 'failed', url: null });
  });

  it('treats unfinished video state on a terminal job as a failed partial result', () => {
    expect(getTryOnVideoPresentation({
      status: 'succeeded',
      outputMode: 'image_and_video',
      generatedImageUrl: 'https://cdn.example.com/look.png',
      generatedImageUrls: ['https://cdn.example.com/look.png'],
      generatedVideoUrl: null,
      videoStatus: 'processing',
    })).toEqual({ status: 'failed', url: null });
  });

  it('ignores stale video data for image-only jobs', () => {
    expect(getTryOnVideoPresentation({
      status: 'succeeded',
      outputMode: 'image',
      generatedImageUrl: 'https://cdn.example.com/look.png',
      generatedImageUrls: ['https://cdn.example.com/look.png'],
      generatedVideoUrl: 'https://cdn.example.com/stale.mp4',
      videoStatus: 'succeeded',
    })).toEqual({ status: 'not_requested', url: null });
  });

  it('removes blank and duplicate image URLs without falling back to the source image', () => {
    expect(getGeneratedTryOnImageUrls({
      generatedImageUrl: 'https://cdn.example.com/look-1.png',
      generatedImageUrls: ['', '  ', 'https://cdn.example.com/look-1.png'],
    })).toEqual(['https://cdn.example.com/look-1.png']);

    expect(getGeneratedTryOnImageUrls({ generatedImageUrl: null, generatedImageUrls: [] })).toEqual([]);
  });
});
