import enRules from './rules/en.json';
import injectionRules from './rules/injection.json';
import viRules from './rules/vi.json';
import type { PromptPolicyRule, VirtualTryOnPromptValidationResult } from './prompt-policy.types';

const configuredPromptMaxLength = Number(process.env.VIRTUAL_TRY_ON_PROMPT_MAX_LENGTH || 200);
export const PROMPT_MAX_LENGTH =
  Number.isFinite(configuredPromptMaxLength) && configuredPromptMaxLength > 0
    ? configuredPromptMaxLength
    : 200;

const controlCharactersPattern = /[\u0000-\u001F\u007F]/g;
const vietnameseTonePattern = /[\u0300-\u036f]/g;
const searchSeparatorPattern = /[\s!"#$%&'()*+,.\/:;<=>?@[\\\]^_`{|}~-]+/g;
const inWordSeparatorPattern = /([\p{L}\p{N}])[\u0021-\u002F\u003A-\u0040\u005B-\u0060\u007B-\u007E]+(?=[\p{L}\p{N}])/gu;

const promptPolicyRules = [
  ...(viRules as PromptPolicyRule[]),
  ...(enRules as PromptPolicyRule[]),
  ...(injectionRules as PromptPolicyRule[]),
];

type PromptPolicyMatch = Pick<PromptPolicyRule, 'key' | 'category' | 'reasonCode'>;

const patternPolicyRules: Array<PromptPolicyMatch & { pattern: RegExp }> = [
  {
    key: 'email_address_pattern',
    category: 'personal_data',
    reasonCode: 'PROMPT_PERSONAL_DATA',
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  },
  {
    key: 'phone_number_pattern',
    category: 'personal_data',
    reasonCode: 'PROMPT_PERSONAL_DATA',
    pattern: /(?:^|[^\d])(?:\+?84|0)(?:[\s.-]?\d){9,10}(?!\d)/,
  },
  {
    key: 'long_card_or_id_number_pattern',
    category: 'personal_data',
    reasonCode: 'PROMPT_PERSONAL_DATA',
    pattern: /(?:^|[^\d])(?:\d[\s-]?){13,19}(?!\d)/,
  },
];

export const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizePrompt = (prompt?: string) =>
  prompt?.replace(controlCharactersPattern, ' ').replace(/\s+/g, ' ').trim() || undefined;

const removeVietnameseTones = (value: string) =>
  value
    .normalize('NFD')
    .replace(vietnameseTonePattern, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');

const normalizeSearchText = (value: string, foldVietnamese: boolean, mergeInWordSeparators = false) => {
  const normalized = normalizePrompt(value);
  if (!normalized) return '';

  const comparable = foldVietnamese ? removeVietnameseTones(normalized) : normalized;
  const deobfuscated = mergeInWordSeparators
    ? comparable.replace(inWordSeparatorPattern, '$1')
    : comparable;
  return deobfuscated.toLowerCase().replace(searchSeparatorPattern, ' ').replace(/\s+/g, ' ').trim();
};

const uniqueValues = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

const buildSearchVariants = (value: string, options: { foldVietnamese?: boolean } = {}) => {
  const foldVietnamese = options.foldVietnamese !== false;
  const candidates = [
    normalizeSearchText(value, false),
    normalizeSearchText(value, false, true),
  ];

  if (foldVietnamese) {
    candidates.push(
      normalizeSearchText(value, true),
      normalizeSearchText(value, true, true),
    );
  }

  const spaced = uniqueValues(candidates);

  return {
    spaced,
    compact: uniqueValues(spaced.map((candidate) => candidate.replace(/\s+/g, ''))),
  };
};

const hasTerm = (candidate: string, term: string) => {
  const normalizedTerm = term.trim().replace(/\s+/g, ' ');
  if (!candidate || !normalizedTerm) return false;

  if (normalizedTerm.includes(' ')) {
    return candidate.includes(normalizedTerm);
  }

  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(normalizedTerm)}(?=$|[^a-z0-9])`, 'i').test(candidate);
};

const findMatchedRule = (prompt: string, extraRules: PromptPolicyRule[] = []) => {
  for (const rule of [...extraRules, ...promptPolicyRules]) {
    const searchOptions = { foldVietnamese: rule.foldVietnamese };
    const searchTexts = buildSearchVariants(prompt, searchOptions);

    for (const term of rule.terms) {
      const termsToCheck = buildSearchVariants(term, searchOptions);
      const matchesSpacedText = searchTexts.spaced.some((candidate) =>
        termsToCheck.spaced.some((searchTerm) => hasTerm(candidate, searchTerm)),
      );

      const canCompactMatch = termsToCheck.spaced.some((searchTerm) => searchTerm.includes(' '));
      const matchesCompactPhrase = canCompactMatch && searchTexts.compact.some((candidate) =>
        termsToCheck.compact.some((searchTerm) => candidate.includes(searchTerm)),
      );

      if (matchesSpacedText || matchesCompactPhrase) {
        return rule;
      }
    }
  }

  return null;
};

const findMatchedPatternRule = (prompt: string) =>
  patternPolicyRules.find((rule) => rule.pattern.test(prompt)) ?? null;

export const validateVirtualTryOnPrompt = (
  prompt?: string,
  extraRules: PromptPolicyRule[] = [],
  maxLength = PROMPT_MAX_LENGTH,
): VirtualTryOnPromptValidationResult => {
  const normalizedPrompt = normalizePrompt(prompt);
  if (!normalizedPrompt) {
    return {
      allowed: true,
      normalizedPrompt: null,
      reasonCode: null,
      message: null,
      maxLength,
    };
  }

  if (normalizedPrompt.length > maxLength) {
    return {
      allowed: false,
      normalizedPrompt: null,
      reasonCode: 'PROMPT_TOO_LONG',
      message: `Mô tả bối cảnh không được vượt quá ${maxLength} ký tự`,
      maxLength,
    };
  }

  const matchedRule = findMatchedRule(normalizedPrompt, extraRules) || findMatchedPatternRule(normalizedPrompt);
  if (matchedRule) {
    return {
      allowed: false,
      normalizedPrompt: null,
      reasonCode: matchedRule.reasonCode,
      message: 'Mô tả bối cảnh không phù hợp cho phối đồ ảo',
      maxLength,
      matchedCategory: matchedRule.category,
      matchedRule: matchedRule.key,
    };
  }

  return {
    allowed: true,
    normalizedPrompt,
    reasonCode: null,
    message: null,
    maxLength,
  };
};
