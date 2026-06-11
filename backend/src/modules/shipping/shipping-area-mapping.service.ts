import { shippingAreaMappingSeed, type ShippingAreaMappingRecord } from './shipping-area-mapping.data';

type MappingStatus = 'mapped' | 'missing' | 'manual';

type ShippingAreaMappingLookupInput = {
  province?: string | null;
  provinceCode?: string | number | null;
  provinceId?: number | null;
  districtId?: number | null;
  ward?: string | null;
  wardCode?: string | number | null;
  ghnProvinceId?: number | null;
  ghnDistrictId?: number | null;
  ghnWardCode?: string | null;
  ghnMappingStatus?: MappingStatus;
};

type ResolvedStoredGhnFields = {
  ghnProvinceId: number | null;
  ghnDistrictId: number | null;
  ghnWardCode: string | null;
  ghnMappingStatus: MappingStatus;
  source: 'explicit' | 'legacy' | 'mapping' | 'missing';
  mapping: ShippingAreaMappingRecord | null;
};

const PREFIX_PATTERN = /^(thanh pho|tinh|phuong|xa|thi tran|dac khu)\s+/i;

const trimOptional = (value: unknown) => (
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
);

const trimRequired = (value: string | number) => String(value).trim();

const toPositiveIntegerOrNull = (value: unknown) => {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
};

const normalizeCode = (value: unknown) => trimOptional(value)?.replace(/\s+/g, '') ?? null;

const normalizeLabel = (value: unknown) => {
  const text = trimOptional(value);
  if (!text) {
    return null;
  }

  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'd')
    .toLowerCase()
    .replace(PREFIX_PATTERN, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
};

const buildCodeKey = (provinceCode: unknown, wardCode: unknown) => {
  const normalizedProvinceCode = normalizeCode(provinceCode);
  const normalizedWardCode = normalizeCode(wardCode);

  if (!normalizedProvinceCode || !normalizedWardCode) {
    return null;
  }

  return `${normalizedProvinceCode}:${normalizedWardCode}`;
};

const buildNameKey = (province: unknown, ward: unknown) => {
  const normalizedProvince = normalizeLabel(province);
  const normalizedWard = normalizeLabel(ward);

  if (!normalizedProvince || !normalizedWard) {
    return null;
  }

  return `${normalizedProvince}:${normalizedWard}`;
};

const mappingsByCode = new Map<string, ShippingAreaMappingRecord>();
const mappingsByName = new Map<string, ShippingAreaMappingRecord | null>();

shippingAreaMappingSeed.forEach((mapping) => {
  const codeKey = buildCodeKey(mapping.provinceCode, mapping.wardCode);
  if (codeKey) {
    mappingsByCode.set(codeKey, mapping);
  }

  const nameKey = buildNameKey(mapping.provinceName, mapping.wardName);
  if (!nameKey) {
    return;
  }

  if (!mappingsByName.has(nameKey)) {
    mappingsByName.set(nameKey, mapping);
    return;
  }

  const currentMapping = mappingsByName.get(nameKey);
  if (currentMapping && currentMapping.wardCode !== mapping.wardCode) {
    mappingsByName.set(nameKey, null);
  }
});

const resolveMapping = (input: ShippingAreaMappingLookupInput) => {
  const codeMatch = buildCodeKey(input.provinceCode, input.wardCode);
  if (codeMatch && mappingsByCode.has(codeMatch)) {
    return mappingsByCode.get(codeMatch) ?? null;
  }

  const nameMatch = buildNameKey(input.province, input.ward);
  if (!nameMatch) {
    return null;
  }

  return mappingsByName.get(nameMatch) ?? null;
};

const resolveStoredGhnFields = (input: ShippingAreaMappingLookupInput): ResolvedStoredGhnFields => {
  const explicitGhnProvinceId = toPositiveIntegerOrNull(input.ghnProvinceId);
  const explicitGhnDistrictId = toPositiveIntegerOrNull(input.ghnDistrictId);
  const explicitGhnWardCode = trimOptional(input.ghnWardCode);
  const legacyProvinceId = toPositiveIntegerOrNull(input.provinceId);
  const legacyDistrictId = toPositiveIntegerOrNull(input.districtId);
  const legacyGhnWardCode = legacyDistrictId && input.wardCode != null ? trimRequired(input.wardCode) : null;
  const hasExplicitMapping = Boolean(explicitGhnDistrictId && explicitGhnWardCode);
  const hasLegacyMapping = Boolean(legacyDistrictId && legacyGhnWardCode);
  const mapping = hasExplicitMapping || hasLegacyMapping
    ? null
    : resolveMapping(input);

  if (hasExplicitMapping) {
    return {
      ghnProvinceId: explicitGhnProvinceId ?? legacyProvinceId,
      ghnDistrictId: explicitGhnDistrictId,
      ghnWardCode: explicitGhnWardCode,
      ghnMappingStatus: input.ghnMappingStatus === 'mapped' ? 'mapped' : 'manual',
      source: 'explicit',
      mapping: null,
    };
  }

  if (hasLegacyMapping) {
    return {
      ghnProvinceId: explicitGhnProvinceId ?? legacyProvinceId,
      ghnDistrictId: legacyDistrictId,
      ghnWardCode: legacyGhnWardCode,
      ghnMappingStatus: input.ghnMappingStatus === 'mapped' ? 'mapped' : 'manual',
      source: 'legacy',
      mapping: null,
    };
  }

  if (mapping) {
    return {
      ghnProvinceId: mapping.ghnProvinceId,
      ghnDistrictId: mapping.ghnDistrictId,
      ghnWardCode: mapping.ghnWardCode,
      ghnMappingStatus: 'mapped',
      source: 'mapping',
      mapping,
    };
  }

  return {
    ghnProvinceId: explicitGhnProvinceId ?? legacyProvinceId,
    ghnDistrictId: null,
    ghnWardCode: null,
    ghnMappingStatus: 'missing',
    source: 'missing',
    mapping: null,
  };
};

export const shippingAreaMappingService = {
  resolveMapping,
  resolveStoredGhnFields,
};
