import axios, { type AxiosInstance } from 'axios';
import { mkdir, readFile, writeFile } from 'fs/promises';
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
  multiGarment?: {
    loadImageNodeId: string;
    resizeNodeId?: string;
    batchNodeId: string;
    batchInputPrefix?: string;
    personBatchInputKey?: string;
  };
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
  extractedItems?: Array<{
    imageBase64?: string;
    mimeType?: string;
    width?: number;
    height?: number;
    role?: string;
    method?: string;
    confidence?: number;
    isUsable?: boolean;
    warnings?: string[];
    issues?: Array<{
      code?: string;
      severity?: string;
      message?: string;
    }>;
  }>;
};

type PreparedGarmentAssets = {
  collage: VirtualTryOnProviderBinaryOutput;
  items: VirtualTryOnProviderBinaryOutput[];
};

const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_POLL_INTERVAL_MS = 3_000;
const DEFAULT_RATE_LIMIT_BACKOFF_MS = 8_000;

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

const getOptionalEnvValue = (name: string) => {
  const value = process.env[name]?.trim();
  return value || null;
};

const getComfyApiKey = () => getOptionalEnvValue('VIRTUAL_TRY_ON_API_KEY');

const getPositiveNumberEnv = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const getHeaderValue = (headers: unknown, name: string) => {
  if (!headers) return null;

  const getter = (headers as { get?: (headerName: string) => unknown }).get;
  const value = typeof getter === 'function'
    ? getter.call(headers, name)
    : (headers as Record<string, unknown>)[name] ?? (headers as Record<string, unknown>)[name.toLowerCase()];

  if (Array.isArray(value)) return String(value[0] || '').trim() || null;
  return typeof value === 'string' ? value.trim() || null : null;
};

const getRetryAfterMs = (headers: unknown, fallbackMs: number) => {
  const retryAfter = getHeaderValue(headers, 'retry-after');
  if (!retryAfter) return fallbackMs;

  const retryAfterSeconds = Number(retryAfter);
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
    return Math.max(fallbackMs, retryAfterSeconds * 1000);
  }

  const retryAt = Date.parse(retryAfter);
  return Number.isFinite(retryAt) ? Math.max(fallbackMs, retryAt - Date.now()) : fallbackMs;
};

const createComfyRequestError = (error: unknown, errorCode = 'COMFY_REQUEST_FAILED'): Error => {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error
      ? error
      : new VirtualTryOnProviderError('ComfyUI provider failed', 502, errorCode);
  }

  const status = error.response?.status;
  const message = status === 429
    ? 'ComfyUI rate limit reached; please wait a moment and try again'
    : `ComfyUI request failed${status ? ` with status ${status}` : ''}`;

  return new VirtualTryOnProviderError(
    message,
    status === 429 ? 429 : 502,
    status === 429 ? 'COMFY_RATE_LIMITED' : errorCode,
  );
};

export const buildComfyTryOnPrompt = (
  prompt: string,
  garments: VirtualTryOnProviderGarment[],
  usesIndividualGarmentImages: boolean,
) => [
  'Create one single 2x2 grid image for virtual fashion try-on.',
  'The full returned image must be a vertical 3:4 portrait canvas, so each cropped grid cell is also a vertical 3:4 portrait.',
  'Each of the four cells must show a full-body photo of the same person wearing the selected outfit, with slight pose or styling variation.',
  'Use reference image 1 as the only source for the person identity, face, hair, expression, pose, body shape, body proportions, height, shoulder width, waist, legs, hands, and skin tone.',
  'Never copy or blend in the face, body, pose, age, gender presentation, skin tone, background, or other garments from catalog garment reference images.',
  'Do not add visible borders, gutters, labels, captions, watermarks, or extra text between grid cells.',
  usesIndividualGarmentImages
    ? [
        'Reference image 1 is the person photo and controls the person appearance.',
        'Every following reference image contains exactly one selected fashion item; use each reference independently and do not interpret them as a collage.',
        ...garments.map((garment, index) => (
          `Reference image ${index + 2}: ${garment.role} — ${garment.name}${garment.color ? `, ${garment.color}` : ''}.`
        )),
      ].join('\n')
    : 'Reference image 1 is the person photo and controls the person appearance; reference image 2 is the prepared outfit reference.',
  prompt,
].join('\n\n');

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

const getByPath = (target: unknown, pathSpec?: string) => {
  if (!pathSpec) return undefined;

  let cursor: unknown = target;
  for (const key of pathSpec.split('.').map((part) => part.trim()).filter(Boolean)) {
    if (!cursor || typeof cursor !== 'object') return undefined;
    cursor = (cursor as Record<string, unknown>)[key];
  }

  return cursor;
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

const toBlobPart = (buffer: Buffer) => {
  const bytes = new Uint8Array(buffer.byteLength);
  bytes.set(buffer);
  return bytes;
};

const uploadImageBinaryToComfy = async (
  client: AxiosInstance,
  input: { buffer: Buffer; mimeType: string; fileName: string },
) => {
  const formData = new FormData();
  formData.append(
    'image',
    new Blob([toBlobPart(input.buffer)], { type: input.mimeType }),
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

  const apiKey = getComfyApiKey();
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

const isComfyCloudClient = (client: AxiosInstance) =>
  String(client.defaults.baseURL || '').includes('cloud.comfy.org');

const getComfyHistoryPath = (client: AxiosInstance, promptId: string) => {
  const configuredPath = getOptionalEnvValue('VIRTUAL_TRY_ON_COMFY_HISTORY_PATH');
  const template = configuredPath || (isComfyCloudClient(client) ? '/history_v2/{promptId}' : '/history/{promptId}');
  return template.replace('{promptId}', encodeURIComponent(promptId));
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

const getGarmentProcessingDebugDir = () =>
  getOptionalEnvValue('VIRTUAL_TRY_ON_GARMENT_PROCESSING_DEBUG_DIR');

const sanitizeFileSegment = (value: string) =>
  value.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'item';

const getImageExtension = (mimeType?: string) =>
  imageMimeExtensions[mimeType || ''] || 'png';

const shouldFailOpenGarmentProcessing = () =>
  process.env.VIRTUAL_TRY_ON_GARMENT_PROCESSING_FAIL_OPEN === 'true';

const getCollageLayout = (input: VirtualTryOnProviderInput) => {
  if (input.outfitMode === 'single') return 'single';
  if (input.outfitMode === 'top_bottom') return 'top_bottom';
  return 'full_set';
};

const saveGarmentProcessingDebugImages = async (
  input: VirtualTryOnProviderInput,
  response: GarmentProcessingResponse,
  collageBuffer: Buffer,
) => {
  const debugDir = getGarmentProcessingDebugDir();
  if (!debugDir) return;

  try {
    const jobDir = path.resolve(debugDir, sanitizeFileSegment(input.jobId));
    await mkdir(jobDir, { recursive: true });

    await writeFile(
      path.join(jobDir, `garment-collage.${getImageExtension(response.mimeType)}`),
      collageBuffer,
    );

    await Promise.all((response.extractedItems || []).map(async (item, index) => {
      if (!item.imageBase64) return;
      const role = sanitizeFileSegment(item.role || `item-${index + 1}`);
      const fileName = `extracted-${String(index + 1).padStart(2, '0')}-${role}.${getImageExtension(item.mimeType)}`;
      await writeFile(path.join(jobDir, fileName), Buffer.from(item.imageBase64, 'base64'));
    }));

    const metadata = {
      jobId: input.jobId,
      createdAt: new Date().toISOString(),
      outfitMode: input.outfitMode,
      outputMode: input.outputMode,
      collage: {
        file: `garment-collage.${getImageExtension(response.mimeType)}`,
        width: response.width,
        height: response.height,
        layout: response.layout,
        mimeType: response.mimeType || 'image/png',
      },
      garments: input.garments.map((garment) => ({
        role: garment.role,
        name: garment.name,
        color: garment.color,
        size: garment.size,
      })),
      extractedItems: (response.extractedItems || []).map((item, index) => ({
        file: item.imageBase64
          ? `extracted-${String(index + 1).padStart(2, '0')}-${sanitizeFileSegment(item.role || `item-${index + 1}`)}.${getImageExtension(item.mimeType)}`
          : null,
        role: item.role,
        width: item.width,
        height: item.height,
        method: item.method,
        confidence: item.confidence,
        isUsable: item.isUsable,
        warnings: item.warnings || [],
        issues: item.issues || [],
      })),
    };
    await writeFile(path.join(jobDir, 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
    console.info(`Saved garment processing debug images: ${jobDir}`);
  } catch (error) {
    console.warn('Could not save garment processing debug images:', error);
  }
};

const prepareGarmentAssets = async (
  input: VirtualTryOnProviderInput,
  timeoutMs: number,
): Promise<PreparedGarmentAssets | null> => {
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

    const collageBuffer = Buffer.from(response.data.imageBase64, 'base64');
    await saveGarmentProcessingDebugImages(input, response.data, collageBuffer);

    const unusableItems = (response.data.extractedItems || [])
      .filter((item) => item?.isUsable === false);
    if (unusableItems.length) {
      throw new VirtualTryOnProviderError(
        'Garment processing could not extract one or more selected items',
        422,
        'GARMENT_PROCESSING_ITEM_UNUSABLE',
      );
    }

    const warnings = (response.data.extractedItems || [])
      .flatMap((item) => item?.warnings || []);
    if (warnings.length) {
      console.warn('Garment processing warnings:', [...new Set(warnings)].join(', '));
    }

    const extractedItems = response.data.extractedItems || [];
    return {
      collage: {
        buffer: collageBuffer,
        mimeType: response.data.mimeType || 'image/png',
        fileName: `${input.jobId}-garment-collage`,
      },
      items: extractedItems.map((item, index) => ({
        buffer: Buffer.from(item.imageBase64 || '', 'base64'),
        mimeType: item.mimeType || 'image/png',
        fileName: `${input.jobId}-${input.garments[index]?.role || item.role || `item-${index + 1}`}-isolated`,
      })),
    };
  } catch (error) {
    if (shouldFailOpenGarmentProcessing()) {
      console.warn('Garment processing failed open:', error);
      return null;
    }

    if (error instanceof VirtualTryOnProviderError) throw error;
    throw new VirtualTryOnProviderError(
      'Cannot prepare selected garment images',
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

export const configureMultiGarmentInputs = (
  workflow: unknown,
  workflowMap: ComfyWorkflowMap,
  garmentFileNames: string[],
) => {
  const config = workflowMap.multiGarment;
  if (!config || !garmentFileNames.length) return false;

  const nodes = workflow as Record<string, Record<string, unknown>>;
  const loadTemplate = nodes[config.loadImageNodeId];
  const resizeTemplate = config.resizeNodeId ? nodes[config.resizeNodeId] : null;
  const batchNode = nodes[config.batchNodeId];
  const loadInputs = loadTemplate?.inputs as Record<string, unknown> | undefined;
  const resizeInputs = resizeTemplate?.inputs as Record<string, unknown> | undefined;
  const batchInputs = batchNode?.inputs as Record<string, unknown> | undefined;

  if (!loadInputs || !batchInputs || (config.resizeNodeId && !resizeInputs)) {
    throw new VirtualTryOnProviderError(
      'ComfyUI multi-garment workflow templates are invalid',
      500,
      'COMFY_MAP_INVALID',
    );
  }

  const batchInputPrefix = config.batchInputPrefix || 'images.image';
  const personBatchInputKey = config.personBatchInputKey || `${batchInputPrefix}0`;
  const personConnection = batchInputs[personBatchInputKey];
  if (!personConnection) {
    throw new VirtualTryOnProviderError(
      'ComfyUI multi-garment workflow is missing the person batch input',
      500,
      'COMFY_MAP_INVALID',
    );
  }

  Object.keys(batchInputs)
    .filter((key) => key.startsWith(batchInputPrefix))
    .forEach((key) => delete batchInputs[key]);
  batchInputs[personBatchInputKey] = personConnection;

  let nextNodeId = Math.max(
    0,
    ...Object.keys(nodes)
      .map((key) => Number(key))
      .filter((value) => Number.isInteger(value)),
  ) + 1;

  garmentFileNames.forEach((fileName, index) => {
    const loadNodeId = index === 0 ? config.loadImageNodeId : String(nextNodeId++);
    const loadNode = index === 0 ? loadTemplate : cloneJson(loadTemplate);
    const nextLoadInputs = loadNode.inputs as Record<string, unknown>;
    nextLoadInputs.image = fileName;
    nodes[loadNodeId] = loadNode;

    let outputNodeId = loadNodeId;
    if (resizeTemplate && config.resizeNodeId) {
      const resizeNodeId = index === 0 ? config.resizeNodeId : String(nextNodeId++);
      const resizeNode = index === 0 ? resizeTemplate : cloneJson(resizeTemplate);
      const nextResizeInputs = resizeNode.inputs as Record<string, unknown>;
      nextResizeInputs.image = [loadNodeId, 0];
      nodes[resizeNodeId] = resizeNode;
      outputNodeId = resizeNodeId;
    }

    batchInputs[`${batchInputPrefix}${index + 1}`] = [outputNodeId, 0];
  });

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
  const preparedGarments = workflowMap.multiGarment || workflowMap.inputs?.garmentImage
    ? await prepareGarmentAssets(input, timeoutMs)
    : null;
  const usePreparedItems = Boolean(
    preparedGarments?.items.length === input.garments.length &&
    preparedGarments.items.every((item) => item.buffer.length > 0),
  );
  let multiGarmentMapped = false;

  if (workflowMap.multiGarment) {
    for (const [index, garment] of input.garments.entries()) {
      const preparedItem = usePreparedItems ? preparedGarments?.items[index] : null;
      const fileName = preparedItem
        ? await uploadImageBinaryToComfy(client, preparedItem)
        : await uploadImageToComfy(
            client,
            { url: garment.imageUrl, fileName: `${input.jobId}-${garment.role}-${garment.colorVariantId}` },
            timeoutMs,
          );
      garmentFileNames.push(fileName);
    }

    multiGarmentMapped = configureMultiGarmentInputs(workflow, workflowMap, garmentFileNames);
    if (multiGarmentMapped) mappedGarmentCount += garmentFileNames.length;
  } else if (preparedGarments) {
    const fileName = await uploadImageBinaryToComfy(client, preparedGarments.collage);
    garmentFileNames.push(fileName);
    if (setMappedInput(workflow, workflowMap, 'garmentImage', fileName)) {
      mappedGarmentCount += input.garments.length;
      garmentImageMapped = true;
    }
  }

  for (const garment of (preparedGarments || workflowMap.multiGarment) ? [] : input.garments) {
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

  if (!multiGarmentMapped && !garmentImageMapped && garmentFileNames.length && setMappedInput(workflow, workflowMap, 'garmentImage', garmentFileNames[0])) {
    mappedGarmentCount += 1;
  }
  if (!multiGarmentMapped && garmentFileNames.length && setMappedInput(workflow, workflowMap, 'garmentImages', garmentFileNames)) {
    mappedGarmentCount += garmentFileNames.length;
  }

  if (mappedGarmentCount === 0) {
    throw new VirtualTryOnProviderError(
      'ComfyUI workflow map must define at least one garment image input',
      500,
      'COMFY_MAP_INVALID',
    );
  }

  const comfyPrompt = buildComfyTryOnPrompt(input.prompt, input.garments, multiGarmentMapped);
  if (!setMappedInput(workflow, workflowMap, 'positivePrompt', comfyPrompt)) {
    setMappedInput(workflow, workflowMap, 'prompt', comfyPrompt);
  }
  setMappedInput(workflow, workflowMap, 'negativePrompt', input.negativePrompt);
  if (input.seed !== undefined) setMappedInput(workflow, workflowMap, 'seed', input.seed);

  const configuredModel = getOptionalEnvValue('VIRTUAL_TRY_ON_COMFY_MODEL');
  if (configuredModel) setMappedInput(workflow, workflowMap, 'model', configuredModel);
  const configuredAspectRatio = getOptionalEnvValue('VIRTUAL_TRY_ON_COMFY_ASPECT_RATIO');
  if (configuredAspectRatio) setMappedInput(workflow, workflowMap, 'aspectRatio', configuredAspectRatio);
  const configuredResolution = getOptionalEnvValue('VIRTUAL_TRY_ON_COMFY_RESOLUTION');
  if (configuredResolution) setMappedInput(workflow, workflowMap, 'resolution', configuredResolution);
  const model = getByPath(workflow, workflowMap.inputs?.model);

  return {
    sourceFileName,
    garmentFileNames,
    model: typeof model === 'string' ? model : configuredModel,
  };
};

const submitPrompt = async (client: AxiosInstance, workflow: unknown) => {
  const apiKey = getComfyApiKey();
  const response = await client.post<ComfyPromptResponse>('/prompt', {
    prompt: workflow,
    client_id: `fashion-shop-${Date.now()}`,
    ...(apiKey ? { extra_data: { api_key_comfy_org: apiKey } } : {}),
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
  rateLimitBackoffMs: number,
) => {
  const deadline = Date.now() + timeoutMs;
  let rateLimitAttempts = 0;

  while (Date.now() < deadline) {
    try {
      const response = await client.get<Record<string, ComfyHistoryEntry>>(getComfyHistoryPath(client, promptId));
      const entry = response.data?.[promptId];
      rateLimitAttempts = 0;
      if (entry?.outputs) return entry;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          await sleep(pollIntervalMs);
          continue;
        }

        if (error.response?.status === 429) {
          rateLimitAttempts += 1;
          const fallbackBackoffMs = Math.min(rateLimitBackoffMs * rateLimitAttempts, 30_000);
          const retryAfterMs = getRetryAfterMs(error.response.headers, fallbackBackoffMs);
          const remainingMs = Math.max(0, deadline - Date.now());
          await sleep(Math.min(retryAfterMs, remainingMs));
          continue;
        }
      }
      throw createComfyRequestError(error, 'COMFY_HISTORY_REQUEST_FAILED');
    }
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

const findOutputFiles = (
  history: ComfyHistoryEntry,
  nodeIds: string[],
  outputKeys: string[],
) => {
  const outputFiles: ComfyOutputFile[] = [];
  const seen = new Set<string>();

  for (const nodeId of nodeIds) {
    const nodeOutput = history.outputs?.[nodeId];
    if (!nodeOutput) continue;

    for (const outputKey of outputKeys) {
      const files = nodeOutput[outputKey];
      if (!Array.isArray(files)) continue;

      for (const file of files) {
        if (!file?.filename) continue;
        const key = `${file.type || ''}/${file.subfolder || ''}/${file.filename}`;
        if (seen.has(key)) continue;
        seen.add(key);
        outputFiles.push(file);
      }
    }
  }

  return outputFiles;
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
    try {
      const workflowPath = process.env.VIRTUAL_TRY_ON_COMFY_WORKFLOW_PATH;
      const workflowMapPath = process.env.VIRTUAL_TRY_ON_COMFY_WORKFLOW_MAP_PATH;
      if (!workflowPath || !workflowMapPath) {
        throw new VirtualTryOnProviderError(
          'Missing VIRTUAL_TRY_ON_COMFY_WORKFLOW_PATH or VIRTUAL_TRY_ON_COMFY_WORKFLOW_MAP_PATH',
          500,
          'COMFY_CONFIG_MISSING',
        );
      }

      const timeoutMs = getPositiveNumberEnv('VIRTUAL_TRY_ON_COMFY_TIMEOUT_MS', DEFAULT_TIMEOUT_MS);
      const pollIntervalMs = getPositiveNumberEnv('VIRTUAL_TRY_ON_COMFY_POLL_INTERVAL_MS', DEFAULT_POLL_INTERVAL_MS);
      const rateLimitBackoffMs = getPositiveNumberEnv(
        'VIRTUAL_TRY_ON_COMFY_RATE_LIMIT_BACKOFF_MS',
        DEFAULT_RATE_LIMIT_BACKOFF_MS,
      );
      const client = createComfyClient();
      const [workflowTemplate, workflowMap] = await Promise.all([
        readJsonFile<unknown>(workflowPath),
        readJsonFile<ComfyWorkflowMap>(workflowMapPath),
      ]);
      const workflow = cloneJson(workflowTemplate);
      const mappedInputs = await applyWorkflowInputs(client, workflow, workflowMap, input, timeoutMs);
      const promptId = await submitPrompt(client, workflow);
      const history = await waitForHistory(client, promptId, timeoutMs, pollIntervalMs, rateLimitBackoffMs);

      const imageFiles = findOutputFiles(history, workflowMap.outputs?.imageNodeIds || [], ['images']);
      if (!imageFiles.length) {
        throw new VirtualTryOnProviderError('ComfyUI workflow finished without an image output', 502, 'COMFY_OUTPUT_MISSING');
      }

      const images = await Promise.all(imageFiles.map((imageFile) => downloadComfyOutput(client, imageFile, 'image/png')));
      const image = images[0];
      const videoFile = input.outputMode === 'image_and_video'
        ? findFirstOutputFile(history, workflowMap.outputs?.videoNodeIds || [], ['videos', 'gifs', 'images'])
        : null;
      const video = videoFile ? await downloadComfyOutput(client, videoFile, 'video/mp4') : null;

      return {
        image,
        images,
        video,
        providerJobId: promptId,
        metadata: {
          provider: '/fashionshop-tryon',
          promptId,
          mappedInputs,
          outputImages: images.map((outputImage) => outputImage.comfyFile),
          outputImage: image.comfyFile,
          outputVideo: video?.comfyFile ?? null,
        },
      };
    } catch (error) {
      if (error instanceof VirtualTryOnProviderError) throw error;
      throw createComfyRequestError(error);
    }
  },
});
