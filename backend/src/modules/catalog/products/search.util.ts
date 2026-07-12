export const normalizeVietnamese = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();

const STOP_WORDS = new Set([
  'va', 'và', 'cua', 'của', 'cho', 'voi', 'với', 'theo', 'tren', 'duoi',
  'va', 'cua', 'cho', 'voi', 'theo', 'tren', 'duoi',
  'va',
  'is', 'a', 'an', 'the', 'and', 'or', 'of', 'in', 'on', 'at', 'to',
]);

export const tokenize = (keyword: string): string[] => {
  const normalized = normalizeVietnamese(keyword);
  return normalized
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
};

export const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const toTokenRegexes = (tokens: string[]): RegExp[] =>
  tokens.map((token) => new RegExp(escapeRegex(token), 'i'));