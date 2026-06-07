type LocationRecord = Record<string, unknown>;

type LocationSanitizeOptions = {
  idKey: string;
  nameKey: string;
  stripProvinceCopySuffix?: boolean;
};

type LocationEntry<T> = {
  item: T;
  name: string;
  key: string;
  hasSyntheticName: boolean;
  numericId: number | null;
};

const isRecord = (value: unknown): value is LocationRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeWhitespace = (value: string) => value.trim().replace(/\s+/g, ' ');

const normalizeProvinceCopySuffix = (value: string) => value.replace(/\s+0\d+\s*$/, '');

const isGhnTestLocationName = (value: string) => /(^|[\s-])(test|alert)([\s-]|$)/i.test(value);

const toLocationKey = (value: string) => value.normalize('NFC').toLocaleLowerCase('vi');

const getNumericId = (value: unknown) => {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
};

const normalizeLocationName = (value: string, options: LocationSanitizeOptions) => {
  const trimmedValue = normalizeWhitespace(value);
  const normalized = options.stripProvinceCopySuffix
    ? normalizeWhitespace(normalizeProvinceCopySuffix(trimmedValue))
    : trimmedValue;
  return normalized.replace(/\s+không áp dụng\s*$/i, '').trim();
};

const shouldPreferEntry = <T>(candidate: LocationEntry<T>, current: LocationEntry<T>) => {
  if (candidate.hasSyntheticName !== current.hasSyntheticName) {
    return !candidate.hasSyntheticName;
  }

  if (candidate.numericId !== null && current.numericId !== null) {
    return candidate.numericId < current.numericId;
  }

  return candidate.name.localeCompare(current.name, 'vi') < 0;
};

const compareEntries = <T>(first: LocationEntry<T>, second: LocationEntry<T>) => (
  first.name.localeCompare(second.name, 'vi') ||
  (first.numericId || Number.MAX_SAFE_INTEGER) - (second.numericId || Number.MAX_SAFE_INTEGER)
);

const sanitizeGhnLocations = <T>(items: T[], options: LocationSanitizeOptions): T[] => {
  const entriesByName = new Map<string, LocationEntry<T>>();

  items.forEach((item) => {
    if (!isRecord(item)) {
      return;
    }

    const rawName = item[options.nameKey];
    if (typeof rawName !== 'string') {
      return;
    }

    const originalName = normalizeWhitespace(rawName);
    const normalizedName = normalizeLocationName(originalName, options);

    if (!normalizedName || isGhnTestLocationName(originalName) || isGhnTestLocationName(normalizedName)) {
      return;
    }

    const normalizedItem = normalizedName === originalName
      ? item
      : { ...item, [options.nameKey]: normalizedName };
    const entry: LocationEntry<T> = {
      item: normalizedItem as T,
      name: normalizedName,
      key: toLocationKey(normalizedName),
      hasSyntheticName: normalizedName !== originalName,
      numericId: getNumericId(item[options.idKey]),
    };
    const currentEntry = entriesByName.get(entry.key);

    if (!currentEntry || shouldPreferEntry(entry, currentEntry)) {
      entriesByName.set(entry.key, entry);
    }
  });

  return [...entriesByName.values()]
    .sort(compareEntries)
    .map((entry) => entry.item);
};

const sanitizeGhnLocationResponse = <T>(response: T, options: LocationSanitizeOptions): T => {
  if (!isRecord(response) || !Array.isArray(response.data)) {
    return response;
  }

  return {
    ...response,
    data: sanitizeGhnLocations(response.data, options),
  };
};

export const sanitizeGhnProvincesResponse = <T>(response: T): T =>
  sanitizeGhnLocationResponse(response, {
    idKey: 'ProvinceID',
    nameKey: 'ProvinceName',
    stripProvinceCopySuffix: true,
  });

export const sanitizeGhnDistrictsResponse = <T>(response: T): T =>
  sanitizeGhnLocationResponse(response, {
    idKey: 'DistrictID',
    nameKey: 'DistrictName',
  });

export const sanitizeGhnWardsResponse = <T>(response: T): T =>
  sanitizeGhnLocationResponse(response, {
    idKey: 'WardCode',
    nameKey: 'WardName',
  });
