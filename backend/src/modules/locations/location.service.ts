import {
  LOCATION_DATA_SOURCE,
  LOCATION_DATA_VERSION,
  provinces2025,
  wards2025,
  wardsByProvinceCode,
} from './location-data';

const normalizeCode = (value: string | number) => String(value).trim().padStart(2, '0');
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

const sortLocationItems = <T extends { name: string; code: string }>(items: T[]) =>
  [...items].sort(compareLocationItems);

export const getMeta = async () => {
  const provinces = sortLocationItems(provinces2025.map((province) => ({
    ...province,
    wardCount: wardsByProvinceCode[province.code]?.length ?? 0,
  })));
  const missingWardProvinceCodes = provinces
    .filter((province) => province.wardCount === 0)
    .map((province) => province.code);

  return {
    version: LOCATION_DATA_VERSION,
    source: LOCATION_DATA_SOURCE,
    provinceCount: provinces2025.length,
    wardCount: wards2025.length,
    manualEntryAllowed: missingWardProvinceCodes.length > 0,
    missingWardProvinceCodes,
    provinces,
    externalShippingProviderMapping: {
      provider: 'GHN',
      status: 'admin_managed',
      note: 'Mã hành chính 2025 được giữ độc lập với ProvinceID/DistrictID/WardCode của GHN.',
    },
  };
};

export const getProvinces = async () => sortLocationItems(provinces2025);

export const getWards = async (provinceCode: string | number) => {
  const code = normalizeCode(provinceCode);
  const province = provinces2025.find((item) => item.code === code);

  if (!province) {
    throw { status: 404, message: 'Không tìm thấy tỉnh/thành phố' };
  }

  const wards = sortLocationItems(wardsByProvinceCode[code] ?? []);

  return {
    province,
    wards,
    manualEntryAllowed: wards.length === 0,
  };
};

export const searchLocations = async (query: string) => {
  const normalizedQuery = query.trim().toLocaleLowerCase('vi');

  if (!normalizedQuery) {
    return { provinces: sortLocationItems(provinces2025), wards: [] };
  }

  const provinces = sortLocationItems(provinces2025.filter((item) =>
    `${item.code} ${item.name}`.toLocaleLowerCase('vi').includes(normalizedQuery),
  ));
  const wards = sortLocationItems(Object.entries(wardsByProvinceCode).flatMap(([provinceCode, items]) =>
    items
      .filter((item) => `${item.code} ${item.name}`.toLocaleLowerCase('vi').includes(normalizedQuery))
      .map((item) => ({ ...item, provinceCode })),
  ));

  return { provinces, wards };
};
