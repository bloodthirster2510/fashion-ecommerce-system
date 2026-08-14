import type {
  RecommendationContext,
  RecommendationEventType,
} from '../../database/models/recommendation-event.model';
import type { ProductListItem } from '../catalog/products/product.types';

export const RECOMMENDATION_ALGORITHM_VERSION = 'v7_similar_hybrid_cart_association';

export type RecommendationReasonCode =
  | 'same_category'
  | 'same_brand'
  | 'same_gender'
  | 'same_color'
  | 'similar_price'
  | 'preferred_category'
  | 'preferred_brand'
  | 'preferred_color'
  | 'completes_outfit'
  | 'matches_cart_style'
  | 'frequently_bought_together'
  | 'admin_pinned'
  | 'popular'
  | 'on_sale'
  | 'new_arrival';

export interface RecommendationItem {
  product: ProductListItem;
  score: number;
  rank: number;
  reason: string;
  reasonCodes: RecommendationReasonCode[];
  merchandisingSource?: 'admin_pinned' | 'algorithm';
}

export interface RecommendationResponse {
  requestId: string;
  algorithmVersion: typeof RECOMMENDATION_ALGORITHM_VERSION;
  items: RecommendationItem[];
  fallbackUsed: boolean;
}

export interface PersonalRecommendationInput {
  userId?: string | null;
  sessionId?: string | null;
  limit?: number;
}

export interface SimilarRecommendationInput {
  productId: string;
  limit?: number;
}

export interface CartRecommendationInput {
  userId: string;
  limit?: number;
}

export interface RecommendationEventInput {
  userId?: string | null;
  sessionId?: string | null;
  context: RecommendationContext;
  sourceProductId?: string | null;
  recommendedProductId: string;
  algorithmVersion?: string;
  score?: number;
  rank?: number;
  reasonCodes?: string[];
  eventType: RecommendationEventType;
  requestId: string;
}

export interface RecommendationConversionEventInput {
  userId?: string | null;
  sessionId?: string | null;
  requestId?: string | null;
  recommendedProductId: string;
  eventType: Extract<
    RecommendationEventType,
    'add_to_cart' | 'order_created' | 'payment_completed' | 'order_cancelled' | 'order_returned'
  >;
  orderId?: string | null;
  orderCode?: string | null;
  orderStatus?: string | null;
  orderPaymentStatus?: string | null;
  quantity?: number | null;
  attributedAmount?: number | null;
  reversesPayment?: boolean;
}

export interface RegisterRecommendationRequestInput {
  response: RecommendationResponse;
  context: RecommendationContext;
  userId?: string | null;
  sessionId?: string | null;
  sourceProductId?: string | null;
}
