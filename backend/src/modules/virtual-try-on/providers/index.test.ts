import {
  createVirtualTryOnProvider,
  createVirtualTryOnVideoProvider,
  getVirtualTryOnVideoConfiguration,
} from './index';

describe('createVirtualTryOnProvider', () => {
  it.each(['fashionshop-tryon', '/fashionshop-tryon'])(
    'uses the real try-on provider alias %s',
    (providerName) => {
      expect(createVirtualTryOnProvider(providerName)).toEqual(expect.objectContaining({
        generate: expect.any(Function),
      }));
    },
  );

  it('keeps mock provider for local mobile testing', () => {
    expect(createVirtualTryOnProvider('mock')).toEqual(expect.objectContaining({
      generate: expect.any(Function),
    }));
  });
});

describe('virtual try-on video provider', () => {
  it.each(['comfy_kling', 'comfy-kling', 'kling'])(
    'supports the Kling ComfyUI alias %s',
    (providerName) => {
      expect(createVirtualTryOnVideoProvider(providerName)).toEqual(expect.objectContaining({
        submit: expect.any(Function),
        waitForResult: expect.any(Function),
      }));
    },
  );

  it('stays unavailable until the workflow and map files are supplied', () => {
    const previous = {
      provider: process.env.VIRTUAL_TRY_ON_VIDEO_PROVIDER,
      workflow: process.env.VIRTUAL_TRY_ON_VIDEO_COMFY_WORKFLOW_PATH,
      map: process.env.VIRTUAL_TRY_ON_VIDEO_COMFY_WORKFLOW_MAP_PATH,
      baseUrl: process.env.VIRTUAL_TRY_ON_COMFY_BASE_URL,
      serviceUrl: process.env.VIRTUAL_TRY_ON_SERVICE_URL,
    };
    process.env.VIRTUAL_TRY_ON_VIDEO_PROVIDER = 'comfy_kling';
    process.env.VIRTUAL_TRY_ON_VIDEO_COMFY_WORKFLOW_PATH = '';
    process.env.VIRTUAL_TRY_ON_VIDEO_COMFY_WORKFLOW_MAP_PATH = '';
    process.env.VIRTUAL_TRY_ON_COMFY_BASE_URL = 'http://localhost:8188';
    delete process.env.VIRTUAL_TRY_ON_SERVICE_URL;

    expect(getVirtualTryOnVideoConfiguration()).toEqual(expect.objectContaining({
      ready: false,
      issues: expect.arrayContaining(['VIDEO_WORKFLOW_MISSING', 'VIDEO_WORKFLOW_MAP_MISSING']),
    }));

    Object.entries(previous).forEach(([key, value]) => {
      const envName = {
        provider: 'VIRTUAL_TRY_ON_VIDEO_PROVIDER',
        workflow: 'VIRTUAL_TRY_ON_VIDEO_COMFY_WORKFLOW_PATH',
        map: 'VIRTUAL_TRY_ON_VIDEO_COMFY_WORKFLOW_MAP_PATH',
        baseUrl: 'VIRTUAL_TRY_ON_COMFY_BASE_URL',
        serviceUrl: 'VIRTUAL_TRY_ON_SERVICE_URL',
      }[key]!;
      if (value === undefined) delete process.env[envName];
      else process.env[envName] = value;
    });
  });

  it('is available with the mock video provider and an output URL', () => {
    const previousProvider = process.env.VIRTUAL_TRY_ON_VIDEO_PROVIDER;
    const previousMockVideoUrl = process.env.VIRTUAL_TRY_ON_MOCK_VIDEO_URL;
    process.env.VIRTUAL_TRY_ON_VIDEO_PROVIDER = 'mock';
    process.env.VIRTUAL_TRY_ON_MOCK_VIDEO_URL = 'https://example.com/mock-video.mp4';

    try {
      expect(getVirtualTryOnVideoConfiguration()).toEqual(expect.objectContaining({
        provider: 'mock',
        ready: true,
        issues: [],
      }));
    } finally {
      if (previousProvider === undefined) delete process.env.VIRTUAL_TRY_ON_VIDEO_PROVIDER;
      else process.env.VIRTUAL_TRY_ON_VIDEO_PROVIDER = previousProvider;

      if (previousMockVideoUrl === undefined) delete process.env.VIRTUAL_TRY_ON_MOCK_VIDEO_URL;
      else process.env.VIRTUAL_TRY_ON_MOCK_VIDEO_URL = previousMockVideoUrl;
    }
  });

  it.each([
    ['4', 5],
    ['9', 9],
    ['13', 12],
  ])('clamps the configured default duration %s to %i seconds', (configured, expected) => {
    const previousDuration = process.env.VIRTUAL_TRY_ON_VIDEO_DURATION_SECONDS;
    process.env.VIRTUAL_TRY_ON_VIDEO_DURATION_SECONDS = configured;

    try {
      expect(getVirtualTryOnVideoConfiguration()).toEqual(expect.objectContaining({
        durationSeconds: expected,
        minDurationSeconds: 5,
        maxDurationSeconds: 12,
      }));
    } finally {
      if (previousDuration === undefined) delete process.env.VIRTUAL_TRY_ON_VIDEO_DURATION_SECONDS;
      else process.env.VIRTUAL_TRY_ON_VIDEO_DURATION_SECONDS = previousDuration;
    }
  });

  it('uses eight seconds when the configured duration is blank', () => {
    const previousDuration = process.env.VIRTUAL_TRY_ON_VIDEO_DURATION_SECONDS;
    process.env.VIRTUAL_TRY_ON_VIDEO_DURATION_SECONDS = '';

    try {
      expect(getVirtualTryOnVideoConfiguration().durationSeconds).toBe(5);
    } finally {
      if (previousDuration === undefined) delete process.env.VIRTUAL_TRY_ON_VIDEO_DURATION_SECONDS;
      else process.env.VIRTUAL_TRY_ON_VIDEO_DURATION_SECONDS = previousDuration;
    }
  });
});
