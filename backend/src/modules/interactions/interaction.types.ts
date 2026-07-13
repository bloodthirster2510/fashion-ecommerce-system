import type {
  InteractionActionType,
  InteractionSource,
} from '../../database/models/user-product-interaction.model';

export type InteractionMetadata = Record<string, unknown>;

export interface RecordInteractionInput {
  userId?: string | null;
  sessionId?: string | null;
  productId?: string | null;
  variantId?: string | null;
  colorVariantId?: string | null;
  size?: string | null;
  actionType: InteractionActionType;
  source?: InteractionSource;
  metadata?: InteractionMetadata;
}

export interface RecordInteractionResult {
  recorded: boolean;
  interactionId?: string;
  skippedReason?: 'recent_duplicate_view' | 'tracking_disabled';
}

export interface RecordCartInteractionInput {
  productId: string;
  variantId?: string;
  colorVariantId?: string;
  size?: string;
  quantity?: number;
}

export interface RecordPurchaseInteractionItem {
  sourceId?: string;
  productId: string;
  variantId?: string;
  colorVariantId?: string;
  size?: string;
  quantity?: number;
}
