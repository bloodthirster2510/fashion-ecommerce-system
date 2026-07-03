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

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

const findMatchedRule = (prompt: string) => {
  for (const rule of promptPolicyRules) {
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

export const validateVirtualTryOnPrompt = (prompt?: string): VirtualTryOnPromptValidationResult => {
  const normalizedPrompt = normalizePrompt(prompt);
  if (!normalizedPrompt) {
    return {
      allowed: true,
      normalizedPrompt: null,
      reasonCode: null,
      message: null,
      maxLength: PROMPT_MAX_LENGTH,
    };
  }

  if (normalizedPrompt.length > PROMPT_MAX_LENGTH) {
    return {
      allowed: false,
      normalizedPrompt: null,
      reasonCode: 'PROMPT_TOO_LONG',
      message: `Mô tả bối cảnh không được vượt quá ${PROMPT_MAX_LENGTH} ký tự`,
      maxLength: PROMPT_MAX_LENGTH,
    };
  }

  const matchedRule = findMatchedRule(normalizedPrompt);
  if (matchedRule) {
    return {
      allowed: false,
      normalizedPrompt: null,
      reasonCode: matchedRule.reasonCode,
      message: 'Mô tả bối cảnh không phù hợp cho phối đồ ảo',
      maxLength: PROMPT_MAX_LENGTH,
      matchedCategory: matchedRule.category,
      matchedRule: matchedRule.key,
    };
  }

  return {
    allowed: true,
    normalizedPrompt,
    reasonCode: null,
    message: null,
    maxLength: PROMPT_MAX_LENGTH,
  };
};
