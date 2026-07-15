import { apiFetch } from '../../config/api';
import type { ApiResponse, ApiValidationError } from '../auth/types';
import type {
  PaginatedResponse,
  TryOnContextPreset,
  TryOnOutfitMode,
  TryOnImageValidationResult,
  TryOnSelectedItem,
  VirtualTryOnAsset,
  VirtualTryOnCapabilities,
  VirtualTryOnJob,
} from './virtualTryOn.types';

export class VirtualTryOnApiError extends Error {
  errors?: ApiValidationError[];
  status?: number;
  errorCode?: string;
  data?: unknown;

  constructor(message: string, errors?: ApiValidationError[], status?: number, errorCode?: string, data?: unknown) {
    super(message);
    this.name = 'VirtualTryOnApiError';
    this.errors = errors;
    this.status = status;
    this.errorCode = errorCode;
    this.data = data;
  }
}

export type ContextPresetPreview = {
  key: TryOnContextPreset;
  label: string;
  viPreview: string;
  enPromptPreview: string;
};

type CreateJobPayload = {
  sourceAssetId: string;
  outfitMode: TryOnOutfitMode;
  selectedItems: Array<Pick<TryOnSelectedItem, 'productId' | 'variantId' | 'colorVariantId' | 'size' | 'role'>>;
  contextPreset: TryOnContextPreset;
  contextPrompt?: string;
  outputMode: 'image' | 'image_and_video';
};

type ValidateAssetPayload = {
  outfitMode: TryOnOutfitMode;
  selectedItems: Array<Pick<TryOnSelectedItem, 'role'>>;
};

const parseApiResponse = <T>(text: string): ApiResponse<T> => {
  if (!text) return {};

  try {
    return JSON.parse(text) as ApiResponse<T>;
  } catch {
    return { message: text };
  }
};

const toQueryString = (params: Record<string, unknown>) => {
  const entries = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);

  return entries.length ? `?${entries.join('&')}` : '';
};

const request = async <T>(
  path: string,
  token: string,
  options: {
    method?: 'GET' | 'POST' | 'DELETE';
    body?: Record<string, unknown>;
    formData?: FormData;
    idempotencyKey?: string;
  } = {},
) => {
  const method = options.method ?? 'GET';
  const response = await apiFetch(path, {
    method,
    timeoutMs: method === 'GET' ? 16000 : 45000,
    retryOnTimeout: method === 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}),
    },
    body: options.formData ?? (options.body ? JSON.stringify(options.body) : undefined),
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : '';
    throw new VirtualTryOnApiError(
      /AbortError|aborted/i.test(message)
        ? 'Tạo ảnh thử đồ mất quá lâu. Bạn có thể kiểm tra lại kết nối rồi thử lại.'
        : 'Không kết nối được tới phòng phối đồ. Bạn kiểm tra lại mạng rồi thử lại.',
    );
  });
  const payload = parseApiResponse<T>(await response.text());

  if (!response.ok) {
    const validationMessage = payload.errors?.map((error) => error.message).join('\n');
    throw new VirtualTryOnApiError(
      validationMessage || payload.message || 'Không thể xử lý yêu cầu phối đồ',
      payload.errors,
      response.status,
      payload.errorCode,
      payload.data,
    );
  }

  return payload.data as T;
};

const getFileName = (uri: string, source: 'upload' | 'camera') => {
  const fileName = uri.split('/').pop();
  return fileName && /\.[a-z0-9]+$/i.test(fileName)
    ? fileName
    : `${source === 'camera' ? 'camera' : 'upload'}-try-on.jpg`;
};

const getMimeType = (uri: string) => {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
};

const uploadAsset = (token: string, uri: string, source: 'upload' | 'camera') => {
  const formData = new FormData();
  formData.append('source', source);
  formData.append('image', {
    uri,
    name: getFileName(uri, source),
    type: getMimeType(uri),
  } as unknown as Blob);

  return request<VirtualTryOnAsset>('/virtual-try-on/assets', token, {
    method: 'POST',
    formData,
  });
};

export const virtualTryOnApi = {
  uploadAsset,
  getCapabilities: (token: string) =>
    request<VirtualTryOnCapabilities>('/virtual-try-on/capabilities', token),
  getAssets: (token: string, params: { page?: number; limit?: number; type?: string } = {}) =>
    request<PaginatedResponse<VirtualTryOnAsset>>(`/virtual-try-on/assets${toQueryString(params)}`, token),
  deleteAsset: (token: string, assetId: string) =>
    request<VirtualTryOnAsset>(`/virtual-try-on/assets/${encodeURIComponent(assetId)}`, token, {
      method: 'DELETE',
    }),
  validateAsset: (token: string, assetId: string, payload: ValidateAssetPayload) =>
    request<TryOnImageValidationResult>(`/virtual-try-on/assets/${encodeURIComponent(assetId)}/validate`, token, {
      method: 'POST',
      body: payload,
    }),
  createJob: (token: string, payload: CreateJobPayload, idempotencyKey: string) =>
    request<VirtualTryOnJob>('/virtual-try-on/jobs', token, {
      method: 'POST',
      body: payload,
      idempotencyKey,
    }),
  getJob: (token: string, jobId: string) =>
    request<VirtualTryOnJob>(`/virtual-try-on/jobs/${encodeURIComponent(jobId)}`, token),
  getLatestJob: (token: string) =>
    request<VirtualTryOnJob | null>('/virtual-try-on/jobs/latest', token),
  getJobs: (token: string, params: { page?: number; limit?: number; status?: string } = {}) =>
    request<PaginatedResponse<VirtualTryOnJob>>(`/virtual-try-on/jobs${toQueryString(params)}`, token),
  retryJob: (token: string, jobId: string) =>
    request<VirtualTryOnJob>(`/virtual-try-on/jobs/${encodeURIComponent(jobId)}/retry`, token, {
      method: 'POST',
    }),
  retryVideo: (token: string, jobId: string) =>
    request<VirtualTryOnJob>(`/virtual-try-on/jobs/${encodeURIComponent(jobId)}/video/retry`, token, {
      method: 'POST',
    }),
  cancelJob: (token: string, jobId: string) =>
    request<VirtualTryOnJob>(`/virtual-try-on/jobs/${encodeURIComponent(jobId)}/cancel`, token, {
      method: 'POST',
    }),
  deleteJob: (token: string, jobId: string) =>
    request<VirtualTryOnJob>(`/virtual-try-on/jobs/${encodeURIComponent(jobId)}`, token, {
      method: 'DELETE',
    }),
  getContextPresets: (token: string) =>
    request<ContextPresetPreview[]>('/virtual-try-on/context-presets', token),
};
