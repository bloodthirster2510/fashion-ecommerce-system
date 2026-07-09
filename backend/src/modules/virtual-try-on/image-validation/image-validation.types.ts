import type { VirtualTryOnItemRole, VirtualTryOnOutfitMode } from '../../../database/models';

export type ImageValidationProviderName =
  | 'disabled'
  | 'mock'
  | 'cloud_vision'
  | 'local_pretrained'
  | 'custom_model';

export type ImageValidationQualityLevel = 'ok' | 'warn' | 'fail';

export type ImageValidationQuality = {
  blur: ImageValidationQualityLevel;
  brightness: ImageValidationQualityLevel;
  resolution: ImageValidationQualityLevel;
};

export type ImageValidationBodyVisibility = 'good' | 'partial' | 'unknown';

export type ImageValidationBoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ImageValidationSafetyFlag = 'sexual' | 'violence' | 'explicit' | 'child';

export type ImageValidationReasonCode =
  | 'NO_PERSON_DETECTED'
  | 'MULTIPLE_PEOPLE_DETECTED'
  | 'PERSON_TOO_SMALL'
  | 'BODY_NOT_VISIBLE'
  | 'POSE_NOT_SUPPORTED'
  | 'IMAGE_TOO_BLURRY'
  | 'IMAGE_TOO_DARK'
  | 'IMAGE_TOO_SMALL'
  | 'IMAGE_POLICY_BLOCKED'
  | 'VALIDATION_PROVIDER_FAILED';

export type ImageValidationInput = {
  imageBuffer: Buffer;
  mimeType: string;
  width: number;
  height: number;
  bytes: number;
  source: 'upload' | 'camera';
  outfitMode?: VirtualTryOnOutfitMode;
  itemRoles?: VirtualTryOnItemRole[];
};

export type ImageValidationResult = {
  allowed: boolean;
  reasonCode: string | null;
  message: string | null;
  provider: ImageValidationProviderName;
  personCount: number;
  mainPersonScore: number;
  mainPersonBox?: ImageValidationBoundingBox | null;
  bodyVisibility: ImageValidationBodyVisibility;
  poseConfidence?: number;
  quality: ImageValidationQuality;
  safetyFlags: ImageValidationSafetyFlag[];
};

export interface ImageValidationProvider {
  readonly name: ImageValidationProviderName;
  validate(input: ImageValidationInput): Promise<ImageValidationResult>;
}

export const IMAGE_VALIDATION_REASON_CODES: readonly ImageValidationReasonCode[] = [
  'NO_PERSON_DETECTED',
  'MULTIPLE_PEOPLE_DETECTED',
  'PERSON_TOO_SMALL',
  'BODY_NOT_VISIBLE',
  'POSE_NOT_SUPPORTED',
  'IMAGE_TOO_BLURRY',
  'IMAGE_TOO_DARK',
  'IMAGE_TOO_SMALL',
  'IMAGE_POLICY_BLOCKED',
  'VALIDATION_PROVIDER_FAILED',
];

export const IMAGE_VALIDATION_REASON_MESSAGES: Record<ImageValidationReasonCode, string> = {
  NO_PERSON_DETECTED: 'Ảnh cần có một người rõ ràng để thử đồ',
  MULTIPLE_PEOPLE_DETECTED: 'Ảnh chỉ nên có một người chính để thử đồ',
  PERSON_TOO_SMALL: 'Người trong ảnh quá nhỏ, vui lòng chọn ảnh chụp gần hơn',
  BODY_NOT_VISIBLE: 'Ảnh chưa thấy đủ vùng cơ thể cho outfit đã chọn',
  POSE_NOT_SUPPORTED: 'Tư thế trong ảnh khó xử lý, vui lòng chọn ảnh đứng thẳng và rõ hơn',
  IMAGE_TOO_BLURRY: 'Ảnh bị mờ, vui lòng chọn hoặc chụp lại ảnh rõ hơn',
  IMAGE_TOO_DARK: 'Ảnh quá tối, vui lòng chọn ảnh đủ sáng hơn',
  IMAGE_TOO_SMALL: 'Ảnh có độ phân giải quá thấp, vui lòng chọn ảnh chất lượng cao hơn',
  IMAGE_POLICY_BLOCKED: 'Ảnh không phù hợp để tạo phối đồ ảo',
  VALIDATION_PROVIDER_FAILED: 'Không thể kiểm tra ảnh lúc này, vui lòng thử lại sau',
};

export const IMAGE_VALIDATION_REASON_STATUSES: Record<ImageValidationReasonCode, number> = {
  NO_PERSON_DETECTED: 422,
  MULTIPLE_PEOPLE_DETECTED: 422,
  PERSON_TOO_SMALL: 422,
  BODY_NOT_VISIBLE: 422,
  POSE_NOT_SUPPORTED: 422,
  IMAGE_TOO_BLURRY: 422,
  IMAGE_TOO_DARK: 422,
  IMAGE_TOO_SMALL: 422,
  IMAGE_POLICY_BLOCKED: 403,
  VALIDATION_PROVIDER_FAILED: 503,
};

export const isImageValidationReasonCode = (value: unknown): value is ImageValidationReasonCode =>
  typeof value === 'string' &&
  (IMAGE_VALIDATION_REASON_CODES as readonly string[]).includes(value);

export const getImageValidationReasonMessage = (reasonCode: string | null | undefined) =>
  isImageValidationReasonCode(reasonCode)
    ? IMAGE_VALIDATION_REASON_MESSAGES[reasonCode]
    : 'Ảnh chưa đủ điều kiện để thử đồ ảo';

export const getImageValidationReasonStatus = (reasonCode: string | null | undefined) =>
  isImageValidationReasonCode(reasonCode)
    ? IMAGE_VALIDATION_REASON_STATUSES[reasonCode]
    : 422;
