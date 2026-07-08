import { apiFetch } from '../../config/api';
import type { ApiResponse, ApiValidationError } from '../auth/types';
import { getRecommendationSessionId } from './recommendationSession';

export type InteractionActionType =
  | 'view'
  | 'search'
  | 'favorite'
  | 'add_to_cart'
  | 'purchase';

export type InteractionSource =
  | 'home'
  | 'product_list'
  | 'product_detail'
  | 'search'
  | 'cart'
  | 'checkout'
  | 'backend';

export type InteractionPayload = {
  productId?: string;
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
