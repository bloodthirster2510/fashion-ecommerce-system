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

const VIETNAMESE_CHAR_GROUPS: Record<string, string> = {
  a: 'aàáạảãâầấậẩẫăằắặẳẵAÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴ',
  d: 'dđDĐ',
  e: 'eèéẹẻẽêềếệểễEÈÉẸẺẼÊỀẾỆỂỄ',
  i: 'iìíịỉĩIÌÍỊỈĨ',
  o: 'oòóọỏõôồốộổỗơờớợởỡOÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠ',
  u: 'uùúụủũưừứựửữUÙÚỤỦŨƯỪỨỰỬỮ',
  y: 'yỳýỵỷỹYỲÝỴỶỸ',
};

const toAccentInsensitivePattern = (value: string) =>
  Array.from(value)
    .map((char) => {
      const normalizedChar = normalizeVietnamese(char);
      const group = VIETNAMESE_CHAR_GROUPS[normalizedChar];
      return group ? `[${group}]` : escapeRegex(char);
    })
    .join('');

export const toAccentInsensitiveRegex = (value: string): RegExp =>
  new RegExp(toAccentInsensitivePattern(value), 'i');

export const toExactPhraseRegex = (value: string): RegExp =>
  new RegExp(
    `(?:^|[^0-9A-Za-zÀ-ỹĐđ])${escapeRegex(value)}(?=$|[^0-9A-Za-zÀ-ỹĐđ])`,
    'i',
  );

export const toTokenRegexes = (tokens: string[]): RegExp[] =>
  tokens.map(toAccentInsensitiveRegex);
