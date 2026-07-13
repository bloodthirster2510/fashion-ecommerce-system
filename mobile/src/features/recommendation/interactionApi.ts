import { apiFetch } from '../../config/api';
import type { ApiResponse, ApiValidationError } from '../auth/types';
import { getRecommendationSessionId } from './recommendationSession';

export type InteractionActionType =
  | 'view'
  | 'click'
  | 'search'
  | 'favorite'
  | 'add_to_cart'
  | 'purchase'
  | 'search_result_click'
  | 'recommendation_click'
  | 'try_on';

export type InteractionSource =
  | 'home'
  | 'product_list'
  | 'product_detail'
  | 'search'
  | 'image_search'
  | 'cart'
  | 'checkout'
  | 'recommendation'
  | 'virtual_try_on'
  | 'backend';

export type InteractionPayload = {
  productId?: string;
  variantId?: string;
  colorVariantId?: string;
  size?: string;
  actionType: InteractionActionType;
  source: InteractionSource;
  metadata?: Record<string, unknown>;
};

type InteractionResponse = {
  recorded: boolean;
  interactionId?: string;
  skippedReason?: string;
};

export class InteractionApiError extends Error {
  errors?: ApiValidationError[];
  status?: number;

  constructor(message: string, errors?: ApiValidationError[], status?: number) {
    super(message);
    this.name = 'InteractionApiError';
    this.errors = errors;
    this.status = status;
  }
}

const parseApiResponse = <T>(text: string): ApiResponse<T> => {
  if (!text) return {};

  try {
    return JSON.parse(text) as ApiResponse<T>;
  } catch {
    return { message: text };
  }
};

export const interactionApi = {
  async recordInteraction(payload: InteractionPayload, token?: string) {
    const sessionId = await getRecommendationSessionId();
    const response = await apiFetch('/interactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': sessionId,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ ...payload, sessionId }),
    });
    const body = parseApiResponse<InteractionResponse>(await response.text());

    if (!response.ok || body.data === undefined) {
      const validationMessage = body.errors?.map((error) => error.message).join('\n');
      throw new InteractionApiError(
        validationMessage || body.message || 'Khong ghi nhan duoc tuong tac',
        body.errors,
        response.status,
      );
    }

    return body.data;
  },
};
