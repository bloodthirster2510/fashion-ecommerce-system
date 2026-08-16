export const ALL_CATEGORY_FILTER_LABEL = 'Tất cả';

const normalizeCategoryPhrase = (value: string) => value
  .trim()
  .toLocaleLowerCase('vi-VN')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

export const getCategoryFilterOptionLabel = (groupLabel: string, optionLabel: string) => {
  const normalizedGroupLabel = normalizeCategoryPhrase(groupLabel);
  const normalizedOptionLabel = normalizeCategoryPhrase(optionLabel);

  return normalizedGroupLabel && normalizedOptionLabel === `${normalizedGroupLabel} khac`
    ? 'Khác'
    : optionLabel;
};
