import {
  cloneComfyJson,
  createComfyClient,
  createComfyRequestError,
  downloadComfyOutput,
  findFirstComfyOutputFile,
  getOptionalComfyEnvValue,
  getPositiveComfyNumberEnv,
  mapComfyPromptInputs,
  readComfyJsonFile,
  setComfyMappedInput,
  submitComfyPrompt,
  uploadImageToComfy,
  waitForComfyHistory,
  type ComfyWorkflowMap,
} from './comfy-virtual-try-on.provider';
import { VirtualTryOnProviderError } from './virtual-try-on-provider';
import type { VirtualTryOnVideoProvider } from './virtual-try-on-video-provider';
import { VirtualTryOnVideoProviderError } from './virtual-try-on-video-provider';

const DEFAULT_VIDEO_TIMEOUT_MS = 600_000;
const DEFAULT_POLL_INTERVAL_MS = 4_000;
const DEFAULT_RATE_LIMIT_BACKOFF_MS = 8_000;

const toVideoProviderError = (error: unknown) => {
  const normalized = error instanceof VirtualTryOnProviderError
    ? error
    : createComfyRequestError(error, 'COMFY_VIDEO_REQUEST_FAILED');

  if (normalized instanceof VirtualTryOnVideoProviderError) return normalized;
  if (!(normalized instanceof VirtualTryOnProviderError)) {
    return new VirtualTryOnVideoProviderError(
      normalized instanceof Error ? normalized.message : 'Không thể tạo video lúc này',
    );
  }

  const errorCodeMap: Record<string, string> = {
    COMFY_CONFIG_INVALID: 'VIDEO_PROVIDER_CONFIG_INVALID',
    COMFY_CONFIG_MISSING: 'VIDEO_PROVIDER_CONFIG_MISSING',
    COMFY_PROMPT_REJECTED: 'VIDEO_PROVIDER_SUBMIT_FAILED',
    COMFY_RATE_LIMITED: 'VIDEO_PROVIDER_RATE_LIMITED',
    COMFY_NO_CREDITS: 'VIDEO_PROVIDER_NO_CREDITS',
    COMFY_TIMEOUT: 'VIDEO_PROVIDER_TIMEOUT',
    PROVIDER_SAFETY_BLOCKED: 'VIDEO_PROVIDER_SAFETY_BLOCKED',
  };

  return new VirtualTryOnVideoProviderError(
    normalized.message,
    normalized.statusCode,
    errorCodeMap[normalized.errorCode] || 'VIDEO_PROVIDER_FAILED',
  );
};

const requireVideoConfigPaths = () => {
  const workflowPath = process.env.VIRTUAL_TRY_ON_VIDEO_COMFY_WORKFLOW_PATH?.trim();
  const workflowMapPath = process.env.VIRTUAL_TRY_ON_VIDEO_COMFY_WORKFLOW_MAP_PATH?.trim();
  if (!workflowPath || !workflowMapPath) {
    throw new VirtualTryOnVideoProviderError(
      'Thiếu đường dẫn workflow hoặc workflow map sinh video',
      500,
      'VIDEO_PROVIDER_CONFIG_MISSING',
    );
  }
  return { workflowPath, workflowMapPath };
};

const applyVideoWorkflowInputs = async (
  workflow: unknown,
  workflowMap: ComfyWorkflowMap,
  input: Parameters<VirtualTryOnVideoProvider['submit']>[0],
) => {
  const client = createComfyClient();
  const uploadTimeoutMs = getPositiveComfyNumberEnv(
    'VIRTUAL_TRY_ON_COMFY_REQUEST_TIMEOUT_MS',
    30_000,
  );
  const sourceFileName = await uploadImageToComfy(
    client,
    { url: input.sourceImageUrl, fileName: `${input.jobId}-video-source` },
    uploadTimeoutMs,
  );
  const sourceMapped = setComfyMappedInput(workflow, workflowMap, 'sourceImage', sourceFileName)
    || setComfyMappedInput(workflow, workflowMap, 'startFrame', sourceFileName);
  if (!sourceMapped) {
    throw new VirtualTryOnVideoProviderError(
      'Workflow map video phải khai báo sourceImage hoặc startFrame',
      500,
      'VIDEO_PROVIDER_CONFIG_INVALID',
    );
  }

  const promptMapping = mapComfyPromptInputs(
    workflow,
    workflowMap,
    input.prompt,
    input.negativePrompt,
  );
  if (!promptMapping.positivePromptMapped) {
    throw new VirtualTryOnVideoProviderError(
      'Workflow map video phải khai báo positivePrompt hoặc prompt',
      500,
      'VIDEO_PROVIDER_CONFIG_INVALID',
    );
  }

  setComfyMappedInput(
    workflow,
    workflowMap,
    'duration',
    input.durationSeconds,
  );
  setComfyMappedInput(
    workflow,
    workflowMap,
    'resolution',
    getOptionalComfyEnvValue('VIRTUAL_TRY_ON_VIDEO_RESOLUTION') || input.resolution,
  );
  setComfyMappedInput(workflow, workflowMap, 'generateAudio', input.generateAudio);

  const optionalInputs: Array<[string, string]> = [
    ['model', 'VIRTUAL_TRY_ON_VIDEO_MODEL'],
    ['aspectRatio', 'VIRTUAL_TRY_ON_VIDEO_ASPECT_RATIO'],
    ['mode', 'VIRTUAL_TRY_ON_VIDEO_MODE'],
  ];
  optionalInputs.forEach(([mapKey, envKey]) => {
    const value = getOptionalComfyEnvValue(envKey);
    if (value) setComfyMappedInput(workflow, workflowMap, mapKey, value);
  });

  return { client, sourceFileName, promptMapping };
};

export const createComfyVirtualTryOnVideoProvider = (): VirtualTryOnVideoProvider => ({
  async submit(input) {
    try {
      const { workflowPath, workflowMapPath } = requireVideoConfigPaths();
      const [workflowTemplate, workflowMap] = await Promise.all([
        readComfyJsonFile<unknown>(workflowPath),
        readComfyJsonFile<ComfyWorkflowMap>(workflowMapPath),
      ]);
      if (!workflowMap.outputs?.videoNodeIds?.length) {
        throw new VirtualTryOnVideoProviderError(
          'Workflow map video chưa khai báo outputs.videoNodeIds',
          500,
          'VIDEO_PROVIDER_CONFIG_INVALID',
        );
      }

      const workflow = cloneComfyJson(workflowTemplate);
      const { client, sourceFileName, promptMapping } = await applyVideoWorkflowInputs(workflow, workflowMap, input);
      const providerJobId = await submitComfyPrompt(client, workflow);

      return {
        providerJobId,
        metadata: {
          provider: 'comfy_kling',
          sourceFileName,
          model: getOptionalComfyEnvValue('VIRTUAL_TRY_ON_VIDEO_MODEL'),
          durationSeconds: input.durationSeconds,
          resolution: input.resolution,
          generateAudio: input.generateAudio,
          promptInputKey: promptMapping.positivePromptKey,
          negativePromptMapped: promptMapping.negativePromptMapped,
          negativePromptFallbackApplied: promptMapping.negativePromptFallbackApplied,
        },
      };
    } catch (error) {
      throw toVideoProviderError(error);
    }
  },

  async waitForResult(providerJobId) {
    try {
      const { workflowMapPath } = requireVideoConfigPaths();
      const workflowMap = await readComfyJsonFile<ComfyWorkflowMap>(workflowMapPath);
      const client = createComfyClient();
      const history = await waitForComfyHistory(
        client,
        providerJobId,
        getPositiveComfyNumberEnv('VIRTUAL_TRY_ON_VIDEO_TIMEOUT_MS', DEFAULT_VIDEO_TIMEOUT_MS),
        getPositiveComfyNumberEnv('VIRTUAL_TRY_ON_VIDEO_POLL_INTERVAL_MS', DEFAULT_POLL_INTERVAL_MS),
        getPositiveComfyNumberEnv(
          'VIRTUAL_TRY_ON_COMFY_RATE_LIMIT_BACKOFF_MS',
          DEFAULT_RATE_LIMIT_BACKOFF_MS,
        ),
      );
      const videoFile = findFirstComfyOutputFile(
        history,
        workflowMap.outputs?.videoNodeIds || [],
        ['videos', 'gifs', 'images'],
      );
      if (!videoFile) {
        throw new VirtualTryOnVideoProviderError(
          'Workflow ComfyUI hoàn tất nhưng không trả video',
          502,
          'VIDEO_OUTPUT_MISSING',
        );
      }

      const video = await downloadComfyOutput(client, videoFile, 'video/mp4');
      return {
        video,
        metadata: {
          providerJobId,
          outputVideo: video.comfyFile,
        },
      };
    } catch (error) {
      throw toVideoProviderError(error);
    }
  },
});
