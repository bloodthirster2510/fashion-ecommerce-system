import type {
  VirtualTryOnContextPreset,
  VirtualTryOnItemRole,
  VirtualTryOnOutfitMode,
  VirtualTryOnOutputMode,
} from '../../database/models';
import type { PromptPolicyCategory } from './prompt-policy/prompt-policy.types';

export type UploadAssetSource = 'upload' | 'camera';

export type CreateVirtualTryOnItemInput = {
  productId: string;
  variantId: string;
  colorVariantId: string;
  size?: string;
  role: VirtualTryOnItemRole;
};

export type CreateVirtualTryOnJobInput = {
  sourceAssetId: string;
  outfitMode: VirtualTryOnOutfitMode;
  selectedItems: CreateVirtualTryOnItemInput[];
  contextPreset?: VirtualTryOnContextPreset;
  contextPrompt?: string;
  outputMode?: VirtualTryOnOutputMode;
  videoDurationSeconds?: number;
};

export type ValidateVirtualTryOnAssetInput = {
  outfitMode: VirtualTryOnOutfitMode;
  selectedItems: Array<Pick<CreateVirtualTryOnItemInput, 'role'>>;
};

export type VirtualTryOnListQuery = {
  page?: number;
  limit?: number;
  status?: string;
  type?: string;
};

export type VirtualTryOnPromptRuleListQuery = {
  page?: number;
  limit?: number;
  keyword?: string;
  category?: PromptPolicyCategory;
  enabled?: boolean;
};

export type CreatePromptRuleInput = {
  term: string;
  category: PromptPolicyCategory;
  reasonCode?: string;
  enabled?: boolean;
};

export type UpdatePromptRuleInput = {
  term?: string;
  category?: PromptPolicyCategory;
  reasonCode?: string;
  enabled?: boolean;
};

export type VirtualTryOnAccountLockListQuery = {
  page?: number;
  limit?: number;
  keyword?: string;
  locked?: boolean;
};

export type LockAccountInput = {
  userId: string;
  reason?: string;
};

