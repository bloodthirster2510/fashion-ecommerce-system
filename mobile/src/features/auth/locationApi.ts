import { apiFetch } from '../../config/api';

export type ProvinceApiItem = {
  name: string;
  code: string;
  type?: 'province' | 'municipality';
  wardCount?: number;
};

export type WardApiItem = {
  name: string;
  code: string;
  type?: 'ward' | 'commune' | 'special_zone';
  provinceCode?: string;
};

export type WardListResponse = {
  province?: ProvinceApiItem | null;
  wards: WardApiItem[];
  manualEntryAllowed: boolean;
};

export type LocationMetaResponse = {
  version: string;
  source: {
    name: string;
    issuedAt: string;
    effectiveFrom: string;
    url: string;
  };
  provinceCount: number;
  wardCount: number;
  manualEntryAllowed: boolean;
  missingWardProvinceCodes: string[];
  provinces: ProvinceApiItem[];
  externalShippingProviderMapping?: {
    provider: 'GHN';
    status: string;
    note?: string;
  };
};

type ApiResponse<T> = {
  message?: string;
  data?: T;
};

const requestTimeoutMs = 8000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getDataArray = (value: unknown) => {
  if (Array.isArray(value)) return value;
  if (isRecord(value) && Array.isArray(value.data)) return value.data;
  return [];
};

const getStringValue = (value: unknown) => (
  typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''
);

const administrativePrefixPattern = /^(thành phố|tỉnh|phường|xã|thị trấn|đặc khu)\s+/i;

const getDisplaySortName = (name: string) =>
  name
    .replace(administrativePrefixPattern, '')
    .trim();

const compareLocationItems = (first: { name: string; code: string }, second: { name: string; code: string }) => {
  const byDisplayName = getDisplaySortName(first.name).localeCompare(
    getDisplaySortName(second.name),
    'vi',
    { sensitivity: 'base' },
  );

  if (byDisplayName !== 0) return byDisplayName;

  return first.code.localeCompare(second.code, 'vi', { numeric: true });
};

type NormalizedLocationItem = {
  name: string;
  code: string;
  type?: ProvinceApiItem['type'] | WardApiItem['type'];
  provinceCode?: string;
  wardCount?: number;
};

const normalizeItems = (value: unknown): NormalizedLocationItem[] => getDataArray(value)
  .map((item) => {
    if (!isRecord(item)) return null;

    const code = getStringValue(item.code);
    const name = getStringValue(item.name);
    const type = getStringValue(item.type);
    const provinceCode = getStringValue(item.provinceCode);
    const wardCount = typeof item.wardCount === 'number' && Number.isFinite(item.wardCount)
      ? item.wardCount
      : undefined;

    if (!code || !name) return null;

    return {
      code,
      name,
      ...(type ? { type } : {}),
      ...(provinceCode ? { provinceCode } : {}),
      ...(wardCount !== undefined ? { wardCount } : {}),
    } as NormalizedLocationItem;
  })
  .filter((item): item is NormalizedLocationItem => Boolean(item))
  .sort(compareLocationItems);

const normalizeWardList = (value: unknown): WardListResponse => {
  if (!isRecord(value)) {
    return {
      province: null,
      wards: normalizeItems(value) as WardApiItem[],
      manualEntryAllowed: false,
    };
  }

  const province = isRecord(value.province)
    ? (normalizeItems([value.province])[0] as ProvinceApiItem | undefined) ?? null
    : null;
  const wards = normalizeItems(value.wards) as WardApiItem[];

  return {
    province,
    wards,
    manualEntryAllowed: Boolean(value.manualEntryAllowed),
  };
};

const get = async <T>(path: string): Promise<T> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await apiFetch(path, {
      signal: controller.signal,
    });
    const payload = (await response.json()) as ApiResponse<T>;

    if (!response.ok) {
      throw new Error(payload.message || 'Không thể tải dữ liệu địa chỉ');
    }

    return payload.data as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Tải dữ liệu địa chỉ quá thời gian chờ');
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error('Không thể tải dữ liệu địa chỉ');
  } finally {
    clearTimeout(timeout);
  }
};

export const locationApi = {
  getMeta: async () => get<LocationMetaResponse>('/locations/meta'),
  getProvinces: async () => normalizeItems(await get<unknown>('/locations/provinces')) as ProvinceApiItem[],
  getWardList: async (provinceCode: string | number) =>
    normalizeWardList(await get<unknown>(`/locations/wards?provinceCode=${encodeURIComponent(String(provinceCode))}`)),
  getWards: async (provinceCode: string | number) =>
    (await locationApi.getWardList(provinceCode)).wards,
};
