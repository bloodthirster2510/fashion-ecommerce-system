import { normalizeVietnamese } from './search.util';

export type InferredGender = 'male' | 'female' | 'unisex';

const GENDER_KEYWORDS: Record<string, InferredGender> = {
  nam: 'male',
  boy: 'male',
  men: 'male',
  male: 'male',
  nu: 'female',
  girl: 'female',
  women: 'female',
  female: 'female',
  unisex: 'unisex',
};

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  ao: ['ao', 'ao thun', 'ao so mi', 'ao polo', 'ao khoac', 'ao blazer', 'ao len'],
  quan: ['quan', 'quan au', 'quan jeans', 'quan short', 'quan kaki', 'quan jogger'],
  vay: ['vay', 'dam', 'vay dam', 'chan vay'],
  giay: ['giay', 'giay the thao', 'giay tay', 'sneaker', 'dep'],
  tui: ['tui xach', 'tui', 'balo'],
  that: ['that lung', 'that'],
  mu: ['mu', 'mu luoi trai', 'mu snapback'],
  kin: ['kinh', 'kinh mat'],
  dong: ['dong ho', 'watch'],
};

export const inferGenderFromTokens = (tokens: string[]): InferredGender | undefined => {
  for (const token of tokens) {
    const gender = GENDER_KEYWORDS[token];
    if (gender) return gender;
  }
  return undefined;
};

export const inferCategoryNamesFromTokens = (tokens: string[]): string[] => {
  const names = new Set<string>();
  for (const token of tokens) {
    const matched = CATEGORY_KEYWORDS[token];
    if (matched) {
      matched.forEach((name) => names.add(name));
    }
  }
  return Array.from(names);
};

const GENDER_LABELS: Record<InferredGender, string> = {
  male: 'nam',
  female: 'nữ',
  unisex: 'unisex',
};

type SearchSuggestionGroup = {
  keys: string[];
  label: string;
  modifiers: string[];
  broadSuggestions?: string[];
  genderSuggestions?: Partial<Record<InferredGender, string[]>>;
};

const SEARCH_SUGGESTION_GROUPS: SearchSuggestionGroup[] = [
  {
    keys: ['ao'],
    label: 'áo',
    modifiers: ['polo', 'kaki', 'thể thao', 'sơ mi', 'thun', 'hoodie', 'khoác', 'len', 'oversize'],
    broadSuggestions: [
      'áo polo nam',
      'áo sơ mi nam',
      'áo thun nam',
      'áo khoác nam',
      'áo thể thao nam',
      'áo polo nữ',
      'áo sơ mi nữ',
      'áo kiểu nữ',
    ],
    genderSuggestions: {
      male: ['áo nam polo', 'áo nam sơ mi', 'áo nam thun', 'áo nam thể thao', 'áo nam hoodie', 'áo nam khoác'],
      female: ['áo nữ kiểu', 'áo nữ sơ mi', 'áo nữ thun', 'áo nữ croptop', 'áo nữ khoác', 'áo nữ len'],
      unisex: ['áo unisex thun', 'áo unisex hoodie', 'áo unisex oversize', 'áo unisex khoác'],
    },
  },
  {
    keys: ['quan'],
    label: 'quần',
    modifiers: ['kaki', 'jeans', 'short', 'thể thao', 'jogger', 'âu', 'ống rộng', 'cargo'],
    broadSuggestions: [
      'quần jean nam',
      'quần short nam',
      'quần jean nữ',
      'quần ống rộng nữ',
      'quần kaki nam',
      'quần thể thao nam',
      'quần đùi',
      'quần ống suông nữ',
      'quần jogger nam',
    ],
    genderSuggestions: {
      male: ['quần jean nam', 'quần short nam', 'quần kaki nam', 'quần thể thao nam', 'quần jogger nam', 'quần cargo nam'],
      female: ['quần jean nữ', 'quần ống rộng nữ', 'quần short nữ', 'quần ống suông nữ', 'quần kaki nữ', 'quần culottes nữ'],
      unisex: ['quần unisex jean', 'quần unisex jogger', 'quần unisex cargo', 'quần unisex thể thao'],
    },
  },
  {
    keys: ['vay', 'dam'],
    label: 'váy',
    modifiers: ['dự tiệc', 'công sở', 'body', 'xòe', 'maxi', 'chữ a', 'hoa nhí'],
  },
  {
    keys: ['giay', 'sneaker', 'dep'],
    label: 'giày',
    modifiers: ['thể thao', 'sneaker', 'đi làm', 'đi chơi', 'da', 'trắng', 'đen'],
  },
  {
    keys: ['tui', 'balo'],
    label: 'túi',
    modifiers: ['xách', 'đeo chéo', 'mini', 'công sở', 'da', 'du lịch'],
  },
  {
    keys: ['do', 'set', 'bo'],
    label: 'đồ',
    modifiers: ['thể thao', 'bộ nam', 'bộ nữ', 'đi chơi', 'ở nhà', 'công sở'],
  },
];

const normalizeSuggestion = (value: string) =>
  normalizeVietnamese(value).replace(/\s+/g, ' ');

const toSuggestionDisplay = (value: string) =>
  value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi-VN');

const findSuggestionGroup = (tokens: string[], normalizedQuery: string) => {
  const lastToken = tokens[tokens.length - 1] ?? normalizedQuery.split(/\s+/).pop() ?? '';

  return SEARCH_SUGGESTION_GROUPS.find((group) => (
    group.keys.some((key) => tokens.includes(key)) ||
    group.keys.some((key) => normalizedQuery.startsWith(key) || (lastToken.length >= 2 && key.startsWith(lastToken)))
  ));
};

const suggestionMatches = (
  suggestion: string,
  normalizedQuery: string,
  tokens: string[],
  requiresPrefix: boolean,
) => {
  const normalizedSuggestion = normalizeSuggestion(suggestion);
  if (requiresPrefix) return normalizedSuggestion.startsWith(normalizedQuery);

  return (
    normalizedSuggestion.startsWith(normalizedQuery) ||
    tokens.every((token) => normalizedSuggestion.includes(token))
  );
};

const addSuggestion = (
  suggestions: Map<string, string>,
  value: string,
  normalizedQuery: string,
  tokens: string[],
  requiresPrefix = false,
) => {
  const display = toSuggestionDisplay(value);
  if (!display) return;

  const key = normalizeSuggestion(display);
  if (!key || key === normalizedQuery || suggestions.has(key)) return;
  if (!suggestionMatches(display, normalizedQuery, tokens, requiresPrefix)) return;

  suggestions.set(key, display);
};

const addSuggestions = (
  suggestions: Map<string, string>,
  values: string[] | undefined,
  normalizedQuery: string,
  tokens: string[],
  requiresPrefix: boolean,
) => {
  values?.forEach((value) => addSuggestion(suggestions, value, normalizedQuery, tokens, requiresPrefix));
};

const addGroupSuggestions = (
  suggestions: Map<string, string>,
  group: SearchSuggestionGroup,
  gender: InferredGender | undefined,
  normalizedQuery: string,
  tokens: string[],
  requiresPrefix: boolean,
) => {
  if (gender) {
    addSuggestions(suggestions, group.genderSuggestions?.[gender], normalizedQuery, tokens, requiresPrefix);
  } else {
    addSuggestions(suggestions, group.broadSuggestions, normalizedQuery, tokens, requiresPrefix);
  }

  const genders = gender ? [gender] : (['male', 'female', 'unisex'] as InferredGender[]);

  for (const itemGender of genders) {
    const base = `${group.label} ${GENDER_LABELS[itemGender]}`;
    addSuggestion(suggestions, base, normalizedQuery, tokens, requiresPrefix);
    group.modifiers.forEach((modifier) => addSuggestion(suggestions, `${base} ${modifier}`, normalizedQuery, tokens, requiresPrefix));
  }

  group.modifiers.forEach((modifier) => addSuggestion(suggestions, `${group.label} ${modifier}`, normalizedQuery, tokens, requiresPrefix));
};

const addNameBasedSuggestions = (
  suggestions: Map<string, string>,
  names: string[],
  normalizedQuery: string,
  tokens: string[],
  requiresPrefix: boolean,
) => {
  for (const name of names) {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (!words.length) continue;

    addSuggestion(suggestions, words.slice(0, 4).join(' '), normalizedQuery, tokens, requiresPrefix);
    addSuggestion(suggestions, words.slice(0, 5).join(' '), normalizedQuery, tokens, requiresPrefix);
  }
};

export const buildSearchKeywordSuggestions = ({
  query,
  productNames = [],
  categoryNames = [],
  limit = 8,
}: {
  query: string;
  productNames?: string[];
  categoryNames?: string[];
  limit?: number;
}): string[] => {
  const normalizedQuery = normalizeSuggestion(query);
  const queryParts = normalizedQuery.split(/\s+/).filter(Boolean);
  const tokens = queryParts.filter((token) => token.length >= 2);
  if (!normalizedQuery || !tokens.length) return [];

  const suggestions = new Map<string, string>();
  const gender = inferGenderFromTokens(tokens);
  const primaryGroup = findSuggestionGroup(tokens, normalizedQuery);
  const lastQueryPart = queryParts[queryParts.length - 1];
  const requiresPrefix = Boolean(lastQueryPart && lastQueryPart.length < 2);

  if (primaryGroup) {
    addGroupSuggestions(suggestions, primaryGroup, gender, normalizedQuery, tokens, requiresPrefix);
  }

  for (const group of SEARCH_SUGGESTION_GROUPS) {
    if (group === primaryGroup) continue;
    addGroupSuggestions(suggestions, group, gender, normalizedQuery, tokens, requiresPrefix);
  }

  addNameBasedSuggestions(suggestions, categoryNames, normalizedQuery, tokens, requiresPrefix);
  addNameBasedSuggestions(suggestions, productNames, normalizedQuery, tokens, requiresPrefix);

  return Array.from(suggestions.values()).slice(0, limit);
};

const MATERIAL_SYNONYMS: Record<string, string[]> = {
  cotton: ['cotton', 'co ton', 'bong'],
  polyester: ['polyester', 'plyester'],
  linen: ['linen', 'lanh'],
  silk: ['silk', 'lua', 'lua tuyen'],
  wool: ['wool', 'len', 'to lon'],
  jeans: ['jeans', 'jins', 'denim', 'okford'],
  leather: ['leather', 'da', 'da that'],
  knit: ['knit', 'dan len', 'thun dan'],
  thunlanh: ['thun lanh', 'thun lenh', 'cooling'],
  thuncotton: ['thun cotton', 'cotton spandex', 'ao thun'],
  kaki: ['kaki', 'khaki'],
  nỉ: ['ni', 'fleece', 'hoodie'],
  vải: ['vai', 'fabric', 'material'],
};

const buildMaterialSynonymIndex = (): Map<string, string[]> => {
  const index = new Map<string, string[]>();
  for (const [, synonyms] of Object.entries(MATERIAL_SYNONYMS)) {
    const normalizedSynonyms = synonyms.map((s) => normalizeVietnamese(s));
    for (const syn of normalizedSynonyms) {
      index.set(syn, normalizedSynonyms);
    }
  }
  return index;
};

const materialSynonymIndex = buildMaterialSynonymIndex();

export const expandMaterialTokenGroups = (tokens: string[]): string[][] =>
  tokens.map((token) => {
    const synonyms = materialSynonymIndex.get(token);
    return Array.from(new Set([token, ...(synonyms ?? [])]));
  });

export const expandMaterialTokens = (tokens: string[]): string[] => {
  const expanded = new Set<string>();
  expandMaterialTokenGroups(tokens).flat().forEach((token) => expanded.add(token));
  return Array.from(expanded);
};

export const isMaterialToken = (token: string): boolean =>
  materialSynonymIndex.has(token);
