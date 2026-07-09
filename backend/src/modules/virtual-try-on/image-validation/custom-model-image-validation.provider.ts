import axios from 'axios';
import {
  getImageValidationReasonMessage,
  type ImageValidationBodyVisibility,
  type ImageValidationInput,
  type ImageValidationProvider,
  type ImageValidationQuality,
  type ImageValidationQualityLevel,
  type ImageValidationResult,
  type ImageValidationSafetyFlag,
} from './image-validation.types';

type CustomModelResponse = Partial<Omit<ImageValidationResult, 'provider'>> & {
  quality?: Partial<ImageValidationQuality>;
};

const qualityLevels: readonly ImageValidationQualityLevel[] = ['ok', 'warn', 'fail'];
const bodyVisibilityValues: readonly ImageValidationBodyVisibility[] = ['good', 'partial', 'unknown'];
const safetyFlags: readonly ImageValidationSafetyFlag[] = ['sexual', 'violence', 'explicit', 'child'];

const readTimeoutMs = () => {
  const timeoutMs = Number(process.env.IMAGE_VALIDATION_CUSTOM_MODEL_TIMEOUT_MS);
  return Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 15_000;
};

const normalizeQualityLevel = (value: unknown): ImageValidationQualityLevel =>
  typeof value === 'string' && qualityLevels.includes(value as ImageValidationQualityLevel)
    ? value as ImageValidationQualityLevel
    : 'warn';

const normalizeBodyVisibility = (value: unknown): ImageValidationBodyVisibility =>
  typeof value === 'string' && bodyVisibilityValues.includes(value as ImageValidationBodyVisibility)
    ? value as ImageValidationBodyVisibility
    : 'unknown';

const normalizeSafetyFlags = (value: unknown): ImageValidationSafetyFlag[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ImageValidationSafetyFlag =>
    typeof item === 'string' && safetyFlags.includes(item as ImageValidationSafetyFlag),
  );
};

const toNumber = (value: unknown, fallback: number) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

const normalizeCustomModelResult = (payload: CustomModelResponse): ImageValidationResult => {
  const reasonCode = typeof payload.reasonCode === 'string' ? payload.reasonCode : null;
  const allowed = payload.allowed === true && !reasonCode;

  return {
    allowed,
    reasonCode: allowed ? null : reasonCode,
    message: typeof payload.message === 'string'
      ? payload.message
      : allowed
        ? null
        : getImageValidationReasonMessage(reasonCode),
    provider: 'custom_model',
    personCount: Math.max(0, Math.round(toNumber(payload.personCount, allowed ? 1 : 0))),
    mainPersonScore: toNumber(payload.mainPersonScore, allowed ? 0.9 : 0),
    mainPersonBox: payload.mainPersonBox ?? null,
    bodyVisibility: normalizeBodyVisibility(payload.bodyVisibility),
    poseConfidence: payload.poseConfidence === undefined ? undefined : toNumber(payload.poseConfidence, 0),
    quality: {
      blur: normalizeQualityLevel(payload.quality?.blur),
      brightness: normalizeQualityLevel(payload.quality?.brightness),
      resolution: normalizeQualityLevel(payload.quality?.resolution),
    },
    safetyFlags: normalizeSafetyFlags(payload.safetyFlags),
  };
};

export const createCustomModelImageValidationProvider = (): ImageValidationProvider => ({
  name: 'custom_model',
  async validate(input: ImageValidationInput) {
    const endpoint = process.env.IMAGE_VALIDATION_CUSTOM_MODEL_URL?.trim();
    if (!endpoint) {
      throw new Error('Missing IMAGE_VALIDATION_CUSTOM_MODEL_URL');
    }

    const response = await axios.post<CustomModelResponse>(
      endpoint,
      {
        imageBase64: input.imageBuffer.toString('base64'),
        mimeType: input.mimeType,
        width: input.width,
        height: input.height,
        bytes: input.bytes,
        source: input.source,
        outfitMode: input.outfitMode,
        itemRoles: input.itemRoles ?? [],
      },
      {
        timeout: readTimeoutMs(),
        maxBodyLength: Infinity,
      },
    );

    return normalizeCustomModelResult(response.data);
  },
});
