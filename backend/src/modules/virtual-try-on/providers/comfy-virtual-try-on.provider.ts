import axios, { type AxiosInstance } from 'axios';
import { readFile } from 'fs/promises';
import path from 'path';
import type {
  VirtualTryOnProvider,
  VirtualTryOnProviderBinaryOutput,
  VirtualTryOnProviderGarment,
  VirtualTryOnProviderInput,
} from './virtual-try-on-provider';
import { VirtualTryOnProviderError } from './virtual-try-on-provider';

type ComfyWorkflowMap = {
  inputs?: Record<string, string>;
  outputs?: {
    imageNodeIds?: string[];
    videoNodeIds?: string[];
  };
};

type ComfyUploadResponse = {
  name?: string;
  subfolder?: string;
  type?: string;
};

type ComfyPromptResponse = {
  prompt_id?: string;
  number?: number;
  error?: unknown;
  node_errors?: unknown;
};

type ComfyOutputFile = {
  filename: string;
  subfolder?: string;
  type?: string;
};

type ComfyHistoryEntry = {
  outputs?: Record<string, Record<string, ComfyOutputFile[] | undefined>>;
};

type ComfyDownloadedFile = VirtualTryOnProviderBinaryOutput & {
  comfyFile: ComfyOutputFile;
};

type GarmentProcessingResponse = {
  imageBase64?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  layout?: string;
  extractedItems?: unknown[];
};

const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_POLL_INTERVAL_MS = 1_500;

const imageMimeExtensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const videoMimeExtensions: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'image/gif': 'gif',
};

const sleep = (ms: number) => new Promise<void>((resolve) => {
  const timer = setTimeout(resolve, ms);
  timer.unref?.();
});

const readJsonFile = async <T>(filePath: string): Promise<T> => {
  try {
    const content = await readFile(path.resolve(filePath), 'utf8');
    return JSON.parse(content) as T;
  } catch {
    throw new VirtualTryOnProviderError(
      `Cannot read ComfyUI config file: ${filePath}`,
      500,
      'COMFY_CONFIG_INVALID',
    );
  }
};

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const setByPath = (target: unknown, pathSpec: string, value: unknown) => {
  const keys = pathSpec.split('.').map((key) => key.trim()).filter(Boolean);
  if (!keys.length) {
    throw new VirtualTryOnProviderError('ComfyUI workflow map contains an empty path', 500, 'COMFY_MAP_INVALID');
  }

  let cursor = target as Record<string, unknown>;
  for (const key of keys.slice(0, -1)) {
    const next = cursor[key];
    if (!next || typeof next !== 'object') {
      throw new VirtualTryOnProviderError(
        `ComfyUI workflow path not found: ${pathSpec}`,
        500,
        'COMFY_MAP_INVALID',
      );
    }
    cursor = next as Record<string, unknown>;
  }

  cursor[keys[keys.length - 1]] = value;
};

const getFileExtension = (mimeType: string, fallback: string) => (
  imageMimeExtensions[mimeType] || videoMimeExtensions[mimeType] || fallback
);

const sanitizeFileNamePart = (value: string) => value.replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 80);

const getArrayBuffer = async (url: string, timeoutMs: number) => {
  const response = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    timeout: timeoutMs,
  });
  const mimeType = String(response.headers['content-type'] || 'image/png').split(';')[0].trim();
  return {
    buffer: Buffer.from(response.data),
    mimeType,
  };
};

const uploadImageBinaryToComfy = async (
  client: AxiosInstance,
  input: { buffer: Buffer; mimeType: string; fileName: string },
) => {
  const formData = new FormData();
  formData.append(
    'image',
    new Blob([input.buffer], { type: input.mimeType }),
    `${sanitizeFileNamePart(input.fileName)}.${getFileExtension(input.mimeType, 'png')}`,
  );
  formData.append('overwrite', 'true');

  const response = await client.post<ComfyUploadResponse>('/upload/image', formData);
  if (!response.data?.name) {
    throw new VirtualTryOnProviderError('ComfyUI image upload did not return a file name', 502, 'COMFY_UPLOAD_FAILED');
  }

  return response.data.name;
};

const createComfyClient = () => {
  const baseURL = process.env.VIRTUAL_TRY_ON_COMFY_BASE_URL || process.env.VIRTUAL_TRY_ON_SERVICE_URL;
  if (!baseURL) {
    throw new VirtualTryOnProviderError(
      'Missing VIRTUAL_TRY_ON_COMFY_BASE_URL or VIRTUAL_TRY_ON_SERVICE_URL',
      500,
      'COMFY_CONFIG_MISSING',
    );
  }

  const apiKey = process.env.VIRTUAL_TRY_ON_API_KEY?.trim();
  const headers: Record<string, string> = {};
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
    headers['X-API-Key'] = apiKey;
  }

  return axios.create({
    baseURL,
    timeout: Number(process.env.VIRTUAL_TRY_ON_COMFY_REQUEST_TIMEOUT_MS || 30_000),
    headers,
  });
};

const uploadImageToComfy = async (
  client: AxiosInstance,
  input: { url: string; fileName: string },
  timeoutMs: number,
) => {
  const image = await getArrayBuffer(input.url, timeoutMs);
  return uploadImageBinaryToComfy(client, {
    ...image,
    fileName: input.fileName,
  });
};

const getGarmentInputKeys = (garment: VirtualTryOnProviderGarment) => {
  const byRole: Record<string, string[]> = {
    top: ['topImage'],
    bottom: ['bottomImage'],
    dress: ['dressImage'],
    shoes: ['shoesImage'],
    outerwear: ['outerwearImage', 'topImage'],
    accessory: ['accessoryImage'],
  };

  return byRole[garment.role] || [];
};

const getGarmentProcessingTimeoutMs = () => {
  const timeoutMs = Number(process.env.VIRTUAL_TRY_ON_GARMENT_PROCESSING_TIMEOUT_MS);
  return Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 30_000;
};

const shouldFailOpenGarmentProcessing = () =>
  process.env.VIRTUAL_TRY_ON_GARMENT_PROCESSING_FAIL_OPEN === 'true';

const getCollageLayout = (input: VirtualTryOnProviderInput) => {
  if (input.outfitMode === 'single') return 'single';
  if (input.outfitMode === 'top_bottom') return 'top_bottom';
  return 'full_set';
};

const createGarmentCollage = async (
  input: VirtualTryOnProviderInput,
  timeoutMs: number,
): Promise<VirtualTryOnProviderBinaryOutput | null> => {
  const endpoint = process.env.VIRTUAL_TRY_ON_GARMENT_PROCESSING_URL?.trim();
  if (!endpoint) return null;

  try {
    const items = await Promise.all(input.garments.map(async (garment) => {
      const image = await getArrayBuffer(garment.imageUrl, timeoutMs);
      return {
        imageBase64: image.buffer.toString('base64'),
        mimeType: image.mimeType,
        role: garment.role,
        label: garment.name,
      };
    }));

    const response = await axios.post<GarmentProcessingResponse>(
      endpoint,
      {
        items,
        layout: getCollageLayout(input),
        width: 768,
        height: 768,
        backgroundColor: '#ffffff',
      },
      {
        timeout: getGarmentProcessingTimeoutMs(),
        maxBodyLength: Infinity,
      },
    );

    if (!response.data?.imageBase64) {
      throw new VirtualTryOnProviderError(
        'Garment processing did not return a collage image',
        502,
        'GARMENT_PROCESSING_OUTPUT_MISSING',
      );
    }

    return {
      buffer: Buffer.from(response.data.imageBase64, 'base64'),
      mimeType: response.data.mimeType || 'image/png',
      fileName: `${input.jobId}-garment-collage`,
    };
  } catch (error) {
    if (shouldFailOpenGarmentProcessing()) {
      console.warn('Garment processing failed open:', error);
      return null;
    }

    if (error instanceof VirtualTryOnProviderError) throw error;
    throw new VirtualTryOnProviderError(
      'Cannot prepare garment collage',
      502,
      'GARMENT_PROCESSING_FAILED',
    );
  }
};

const setMappedInput = (
  workflow: unknown,
  workflowMap: ComfyWorkflowMap,
  key: string,
  value: unknown,
) => {
  const pathSpec = workflowMap.inputs?.[key];
  if (!pathSpec) return false;
  setByPath(workflow, pathSpec, value);
  return true;
};

const applyWorkflowInputs = async (
  client: AxiosInstance,
  workflow: unknown,
  workflowMap: ComfyWorkflowMap,
  input: VirtualTryOnProviderInput,
  timeoutMs: number,
) => {
  const sourceFileName = await uploadImageToComfy(
    client,
    { url: input.sourceImageUrl, fileName: `${input.jobId}-person` },
    timeoutMs,
  );

  const sourceMapped = setMappedInput(workflow, workflowMap, 'sourceImage', sourceFileName)
    || setMappedInput(workflow, workflowMap, 'personImage', sourceFileName);

  if (!sourceMapped) {
    throw new VirtualTryOnProviderError(
      'ComfyUI workflow map must define sourceImage or personImage',
      500,
      'COMFY_MAP_INVALID',
    );
  }

  const garmentFileNames: string[] = [];
  let mappedGarmentCount = 0;
  let garmentImageMapped = false;
  const garmentCollage = workflowMap.inputs?.garmentImage
    ? await createGarmentCollage(input, timeoutMs)
    : null;

  if (garmentCollage) {
    const fileName = await uploadImageBinaryToComfy(client, garmentCollage);
    garmentFileNames.push(fileName);
    if (setMappedInput(workflow, workflowMap, 'garmentImage', fileName)) {
      mappedGarmentCount += input.garments.length;
      garmentImageMapped = true;
    }
  }

  for (const garment of garmentCollage ? [] : input.garments) {
    const fileName = await uploadImageToComfy(
      client,
      { url: garment.imageUrl, fileName: `${input.jobId}-${garment.role}-${garment.colorVariantId}` },
      timeoutMs,
    );
    garmentFileNames.push(fileName);

    for (const inputKey of getGarmentInputKeys(garment)) {
      if (setMappedInput(workflow, workflowMap, inputKey, fileName)) {
        mappedGarmentCount += 1;
        break;
      }
    }
  }

  if (!garmentImageMapped && garmentFileNames.length && setMappedInput(workflow, workflowMap, 'garmentImage', garmentFileNames[0])) {
    mappedGarmentCount += 1;
  }
  if (garmentFileNames.length && setMappedInput(workflow, workflowMap, 'garmentImages', garmentFileNames)) {
    mappedGarmentCount += garmentFileNames.length;
  }

  if (mappedGarmentCount === 0) {
    throw new VirtualTryOnProviderError(
      'ComfyUI workflow map must define at least one garment image input',
      500,
      'COMFY_MAP_INVALID',
    );
  }

  if (!setMappedInput(workflow, workflowMap, 'positivePrompt', input.prompt)) {
    setMappedInput(workflow, workflowMap, 'prompt', input.prompt);
  }
  setMappedInput(workflow, workflowMap, 'negativePrompt', input.negativePrompt);
  if (input.seed !== undefined) setMappedInput(workflow, workflowMap, 'seed', input.seed);

  return { sourceFileName, garmentFileNames };
};

const submitPrompt = async (client: AxiosInstance, workflow: unknown) => {
  const response = await client.post<ComfyPromptResponse>('/prompt', {
    prompt: workflow,
    client_id: `fashion-shop-${Date.now()}`,
  });

  if (!response.data.prompt_id) {
    throw new VirtualTryOnProviderError(
      `ComfyUI rejected workflow: ${JSON.stringify(response.data.error || response.data.node_errors || {})}`,
      502,
      'COMFY_PROMPT_REJECTED',
    );
  }

  return response.data.prompt_id;
};

const waitForHistory = async (
  client: AxiosInstance,
  promptId: string,
  timeoutMs: number,
  pollIntervalMs: number,
) => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const response = await client.get<Record<string, ComfyHistoryEntry>>(`/history/${promptId}`);
    const entry = response.data?.[promptId];
    if (entry?.outputs) return entry;
    await sleep(pollIntervalMs);
  }

  throw new VirtualTryOnProviderError('ComfyUI workflow timed out', 504, 'COMFY_TIMEOUT');
};

const findFirstOutputFile = (
  history: ComfyHistoryEntry,
  nodeIds: string[],
  outputKeys: string[],
) => {
  for (const nodeId of nodeIds) {
    const nodeOutput = history.outputs?.[nodeId];
    if (!nodeOutput) continue;

    for (const outputKey of outputKeys) {
      const files = nodeOutput[outputKey];
      const file = Array.isArray(files) ? files[0] : undefined;
      if (file?.filename) return file;
    }
  }

  return null;
};

const downloadComfyOutput = async (
  client: AxiosInstance,
  file: ComfyOutputFile,
  fallbackMimeType: string,
): Promise<ComfyDownloadedFile> => {
  const response = await client.get<ArrayBuffer>('/view', {
    params: {
      filename: file.filename,
      subfolder: file.subfolder || '',
      type: file.type || 'output',
    },
    responseType: 'arraybuffer',
  });
  const mimeType = String(response.headers['content-type'] || fallbackMimeType).split(';')[0].trim();

  return {
    buffer: Buffer.from(response.data),
    mimeType,
    fileName: file.filename,
    comfyFile: file,
  };
};

export const createComfyVirtualTryOnProvider = (): VirtualTryOnProvider => ({
  async generate(input) {
    const workflowPath = process.env.VIRTUAL_TRY_ON_COMFY_WORKFLOW_PATH;
    const workflowMapPath = process.env.VIRTUAL_TRY_ON_COMFY_WORKFLOW_MAP_PATH;
    if (!workflowPath || !workflowMapPath) {
      throw new VirtualTryOnProviderError(
        'Missing VIRTUAL_TRY_ON_COMFY_WORKFLOW_PATH or VIRTUAL_TRY_ON_COMFY_WORKFLOW_MAP_PATH',
        500,
        'COMFY_CONFIG_MISSING',
      );
    }

    const timeoutMs = Number(process.env.VIRTUAL_TRY_ON_COMFY_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
    const pollIntervalMs = Number(process.env.VIRTUAL_TRY_ON_COMFY_POLL_INTERVAL_MS || DEFAULT_POLL_INTERVAL_MS);
    const client = createComfyClient();
    const [workflowTemplate, workflowMap] = await Promise.all([
      readJsonFile<unknown>(workflowPath),
      readJsonFile<ComfyWorkflowMap>(workflowMapPath),
    ]);
    const workflow = cloneJson(workflowTemplate);
    const mappedInputs = await applyWorkflowInputs(client, workflow, workflowMap, input, timeoutMs);
    const promptId = await submitPrompt(client, workflow);
    const history = await waitForHistory(client, promptId, timeoutMs, pollIntervalMs);

    const imageFile = findFirstOutputFile(history, workflowMap.outputs?.imageNodeIds || [], ['images']);
    if (!imageFile) {
      throw new VirtualTryOnProviderError('ComfyUI workflow finished without an image output', 502, 'COMFY_OUTPUT_MISSING');
    }

    const image = await downloadComfyOutput(client, imageFile, 'image/png');
    const videoFile = input.outputMode === 'image_and_video'
      ? findFirstOutputFile(history, workflowMap.outputs?.videoNodeIds || [], ['videos', 'gifs', 'images'])
      : null;
    const video = videoFile ? await downloadComfyOutput(client, videoFile, 'video/mp4') : null;

    return {
      image,
      video,
      providerJobId: promptId,
      metadata: {
        provider: 'comfy',
        promptId,
        mappedInputs,
        outputImage: image.comfyFile,
        outputVideo: video?.comfyFile ?? null,
      },
    };
  },
});
