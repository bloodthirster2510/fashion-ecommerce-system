import axios from 'axios';
import {
  getImageValidationReasonMessage,
  type ImageValidationBodyVisibility,
  type ImageValidationBodyRegion,
  type ImageValidationCapability,
  type ImageValidationCapabilityBlock,
  type ImageValidationCapabilityMode,
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
const bodyRegions: readonly ImageValidationBodyRegion[] = ['upper', 'hips', 'legs', 'feet'];
const capabilityModes: readonly ImageValidationCapabilityMode[] = [
  'full_set',
  'top_bottom',
  'top',
  'bottom',
  'dress',
  'shoes',
  'outerwear',
  'accessory',
];

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

const normalizeBodyRegions = (value: unknown): ImageValidationBodyRegion[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ImageValidationBodyRegion =>
    typeof item === 'string' && bodyRegions.includes(item as ImageValidationBodyRegion),
  );
};

const normalizeCapabilityMode = (value: unknown): ImageValidationCapabilityMode | null =>
  typeof value === 'string' && capabilityModes.includes(value as ImageValidationCapabilityMode)
    ? value as ImageValidationCapabilityMode
    : null;

const normalizeCapabilityBlock = (value: unknown): ImageValidationCapabilityBlock => {
  const payload = typeof value === 'object' && value !== null
    ? value as Partial<ImageValidationCapabilityBlock>
    : {};

  return {
    reasonCode: typeof payload.reasonCode === 'string' ? payload.reasonCode : null,
    message: typeof payload.message === 'string' ? payload.message : null,
    missingRegions: normalizeBodyRegions(payload.missingRegions),
  };
};

const normalizeCapabilities = (value: unknown): ImageValidationCapability[] => {
  if (!Array.isArray(value)) return [];

  return value.reduce<ImageValidationCapability[]>((items, item) => {
    if (!item || typeof item !== 'object') return items;
    const payload = item as Partial<ImageValidationCapability>;
    const mode = normalizeCapabilityMode(payload.mode);
    if (!mode) return items;

    const reasonCode = typeof payload.reasonCode === 'string' ? payload.reasonCode : null;
    const allowed = payload.allowed === true && !reasonCode;
    items.push({
      mode,
      allowed,
      reasonCode: allowed ? null : reasonCode,
      message: typeof payload.message === 'string'
        ? payload.message
        : allowed
          ? null
          : getImageValidationReasonMessage(reasonCode),
      requiredRegions: normalizeBodyRegions(payload.requiredRegions),
      missingRegions: normalizeBodyRegions(payload.missingRegions),
    });
    return items;
  }, []);
};

const normalizeSupportedModes = (
  value: unknown,
  capabilities: ImageValidationCapability[],
): ImageValidationCapabilityMode[] => {
  const modes = Array.isArray(value)
    ? value.map(normalizeCapabilityMode).filter((mode): mode is ImageValidationCapabilityMode => Boolean(mode))
    : capabilities.filter((capability) => capability.allowed).map((capability) => capability.mode);

  return Array.from(new Set(modes));
};

const normalizeBlockedModes = (
  value: unknown,
  capabilities: ImageValidationCapability[],
): Partial<Record<ImageValidationCapabilityMode, ImageValidationCapabilityBlock>> => {
  const blockedModes: Partial<Record<ImageValidationCapabilityMode, ImageValidationCapabilityBlock>> = {};
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    Object.entries(value).forEach(([key, block]) => {
      const mode = normalizeCapabilityMode(key);
      if (mode) blockedModes[mode] = normalizeCapabilityBlock(block);
    });
  }

  capabilities.forEach((capability) => {
    if (!capability.allowed && !blockedModes[capability.mode]) {
      blockedModes[capability.mode] = {
        reasonCode: capability.reasonCode,
        message: capability.message,
        missingRegions: capability.missingRegions,
      };
    }
  });

  return blockedModes;
};

const toNumber = (value: unknown, fallback: number) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

const normalizeCustomModelResult = (payload: CustomModelResponse): ImageValidationResult => {
  const reasonCode = typeof payload.reasonCode === 'string' ? payload.reasonCode : null;
  const allowed = payload.allowed === true && !reasonCode;
  const capabilities = normalizeCapabilities(payload.capabilities);
  const supportedModes = normalizeSupportedModes(payload.supportedModes, capabilities);
  const recommendedMode = normalizeCapabilityMode(payload.recommendedMode) ?? supportedModes[0] ?? null;

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
    visibleRegions: normalizeBodyRegions(payload.visibleRegions),
    supportedModes,
    blockedModes: normalizeBlockedModes(payload.blockedModes, capabilities),
    recommendedMode,
    capabilities,
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
