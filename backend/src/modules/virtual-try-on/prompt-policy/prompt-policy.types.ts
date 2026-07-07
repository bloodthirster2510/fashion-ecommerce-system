export type PromptPolicyCategory =
  | 'sexual_content'
  | 'violence'
  | 'prompt_injection'
  | 'personal_data'
  | 'hate_or_harassment'
  | 'unsafe_request';

export type PromptPolicyRule = {
  key: string;
  category: PromptPolicyCategory;
  reasonCode: string;
  terms: string[];
  foldVietnamese?: boolean;
};

export type VirtualTryOnPromptValidationResult = {
  allowed: boolean;
  normalizedPrompt: string | null;
  reasonCode: string | null;
  message: string | null;
  maxLength: number;
  matchedCategory?: PromptPolicyCategory;
  matchedRule?: string;
};
