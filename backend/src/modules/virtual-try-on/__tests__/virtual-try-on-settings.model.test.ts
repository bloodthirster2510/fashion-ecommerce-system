import { Types } from 'mongoose';
import { VirtualTryOnSettings } from '../../../database/models/virtual-try-on-settings.model';

const validSettings = () => ({
  key: 'virtual_try_on',
  enabled: true,
  imageProvider: 'comfy',
  imageModel: 'flux-fill-dev.safetensors',
  imageAspectRatio: '3:4',
  imageResolution: '2K',
  videoProvider: 'comfy_kling',
  videoModel: 'kling-v3-omni',
  videoDurationSeconds: 5,
  videoResolution: '720p',
  videoAspectRatio: '9:16',
  videoGenerateAudio: false,
  maxConcurrentJobsPerUser: 2,
  maxVideoJobsPerUserPerDay: 5,
  maxConcurrentVideoJobsPerUser: 1,
  promptMaxLength: 240,
  promptViolationLimitPerDay: 4,
  version: 1,
  history: [],
  updatedBy: new Types.ObjectId(),
});

describe('VirtualTryOnSettings model', () => {
  it('validates the singleton runtime configuration', async () => {
    await expect(new VirtualTryOnSettings(validSettings()).validate()).resolves.toBeUndefined();
  });

  it.each([
    ['maxConcurrentJobsPerUser', 11],
    ['maxVideoJobsPerUserPerDay', 51],
    ['maxConcurrentVideoJobsPerUser', 6],
    ['promptMaxLength', 501],
    ['promptViolationLimitPerDay', 21],
  ])('rejects out-of-range %s', async (field, value) => {
    const document = new VirtualTryOnSettings({ ...validSettings(), [field]: value });

    await expect(document.validate()).rejects.toMatchObject({
      errors: { [field]: expect.anything() },
    });
  });

  it('retains at most twenty rollback snapshots', async () => {
    const configuration = {
      enabled: true,
      imageProvider: 'comfy',
      imageModel: 'flux-fill-dev.safetensors',
      imageAspectRatio: '3:4',
      imageResolution: '2K',
      videoProvider: 'comfy_kling',
      videoModel: 'kling-v3-omni',
      videoDurationSeconds: 5,
      videoResolution: '720p',
      videoAspectRatio: '9:16',
      videoGenerateAudio: false,
      maxConcurrentJobsPerUser: 1,
      maxVideoJobsPerUserPerDay: 3,
      maxConcurrentVideoJobsPerUser: 1,
      promptMaxLength: 200,
      promptViolationLimitPerDay: 5,
    };
    const history = Array.from({ length: 21 }, (_, index) => ({
      version: index + 1,
      configuration,
      changedAt: new Date(),
    }));
    const document = new VirtualTryOnSettings({ ...validSettings(), history });

    await expect(document.validate()).rejects.toMatchObject({
      errors: { history: expect.anything() },
    });
  });
});
