import { shippingAreaMappingSeed, type ShippingAreaMappingRecord } from './shipping-area-mapping.data';
import {
  Order,
  ShippingAreaMapping,
  User,
  type ShippingAreaMappingConfidence,
  type ShippingAreaMappingStatus,
} from '../../database/models';
import { Types } from 'mongoose';
import {
  LOCATION_DATA_VERSION,
  provinces2025,
  wards2025,
} from '../locations/location-data';
import { GHNService } from './ghn.service';

export type MappingStatus = 'mapped' | 'missing' | 'manual';
export type MappingVerificationSource = 'admin' | 'managed' | 'seed';

export type ShippingAreaMappingLookupInput = {
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
  ghnMappingConfidence?: ShippingAreaMappingConfidence | null;
  ghnMappingVerifiedAt?: Date | string | null;
  ghnMappingVerificationSource?: MappingVerificationSource | null;
};

export type ResolvedStoredGhnFields = {
  ghnProvinceId: number | null;
  ghnDistrictId: number | null;
  ghnWardCode: string | null;
  ghnMappingStatus: MappingStatus;
  ghnMappingConfidence: ShippingAreaMappingConfidence | null;
  ghnMappingVerifiedAt: Date | null;
  ghnMappingVerificationSource: MappingVerificationSource | null;
  source: 'explicit' | 'legacy' | 'mapping' | 'managed' | 'missing';
  mapping: ShippingAreaMappingRecord | null;
};

export type ShippingAreaMappingUpsertInput = {
  provinceCode: string;
  provinceName: string;
  wardCode: string;
  wardName: string;
  ghnProvinceId: number;
  ghnProvinceName?: string | null;
  ghnDistrictId: number;
  ghnDistrictName?: string | null;
  ghnWardCode: string;
  ghnWardName?: string | null;
  confidence?: ShippingAreaMappingConfidence;
  status?: ShippingAreaMappingStatus;
  verifiedAt?: Date | string | null;
  note?: string | null;
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

const toDateOrNull = (value: unknown) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizeCode = (value: unknown) => {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const code = String(value).trim().replace(/\s+/g, '');
  return code || null;
};

const normalizeAdministrativeCode = (value: unknown, width: number) => {
  const code = normalizeCode(value);
  return code && /^\d+$/.test(code) ? code.padStart(width, '0') : code;
};

const normalizeProvinceCode = (value: unknown) => normalizeAdministrativeCode(value, 2);
const normalizeWardCode = (value: unknown) => normalizeAdministrativeCode(value, 5);

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
  const normalizedProvinceCode = normalizeProvinceCode(provinceCode);
  const normalizedWardCode = normalizeWardCode(wardCode);

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
  const storedVerificationDate = toDateOrNull(input.ghnMappingVerifiedAt);
  const storedConfidence = input.ghnMappingConfidence ?? null;
  const storedVerificationSource = input.ghnMappingVerificationSource ?? null;
  const hasTrustedVerificationSource = Boolean(
    storedVerificationSource
    && (['admin', 'managed', 'seed'] as MappingVerificationSource[])
      .includes(storedVerificationSource),
  );
  const hasVerifiedExplicitMapping = Boolean(
    hasExplicitMapping
    && input.ghnMappingStatus === 'mapped'
    && storedConfidence
    && storedVerificationDate
    && hasTrustedVerificationSource,
  );
  const mapping = resolveMapping(input);

  if (hasVerifiedExplicitMapping) {
    return {
      ghnProvinceId: explicitGhnProvinceId ?? legacyProvinceId,
      ghnDistrictId: explicitGhnDistrictId,
      ghnWardCode: explicitGhnWardCode,
      ghnMappingStatus: 'mapped',
      ghnMappingConfidence: storedConfidence,
      ghnMappingVerifiedAt: storedVerificationDate,
      ghnMappingVerificationSource: storedVerificationSource,
      source: 'explicit',
      mapping: null,
    };
  }

  if (mapping) {
    const isTrustedSeedMapping = mapping.confidence === 'exact';
    return {
      ghnProvinceId: mapping.ghnProvinceId,
      ghnDistrictId: mapping.ghnDistrictId,
      ghnWardCode: mapping.ghnWardCode,
      ghnMappingStatus: isTrustedSeedMapping ? 'mapped' : 'manual',
      ghnMappingConfidence: mapping.confidence,
      ghnMappingVerifiedAt: isTrustedSeedMapping ? new Date(mapping.verifiedAt) : null,
      ghnMappingVerificationSource: isTrustedSeedMapping ? 'seed' : null,
      source: 'mapping',
      mapping,
    };
  }

  if (hasLegacyMapping) {
    return {
      ghnProvinceId: explicitGhnProvinceId ?? legacyProvinceId,
      ghnDistrictId: legacyDistrictId,
      ghnWardCode: legacyGhnWardCode,
      ghnMappingStatus: input.ghnMappingStatus === 'mapped' && hasTrustedVerificationSource
        ? 'mapped'
        : 'manual',
      ghnMappingConfidence: storedConfidence,
      ghnMappingVerifiedAt: storedVerificationDate,
      ghnMappingVerificationSource: storedVerificationSource,
      source: 'legacy',
      mapping: null,
    };
  }

  if (hasExplicitMapping) {
    return {
      ghnProvinceId: explicitGhnProvinceId ?? legacyProvinceId,
      ghnDistrictId: explicitGhnDistrictId,
      ghnWardCode: explicitGhnWardCode,
      ghnMappingStatus: input.ghnMappingStatus === 'missing' ? 'missing' : 'manual',
      ghnMappingConfidence: storedConfidence,
      ghnMappingVerifiedAt: null,
      ghnMappingVerificationSource: null,
      source: 'explicit',
      mapping: null,
    };
  }

  return {
    ghnProvinceId: explicitGhnProvinceId ?? legacyProvinceId,
    ghnDistrictId: null,
    ghnWardCode: null,
    ghnMappingStatus: 'missing',
    ghnMappingConfidence: null,
    ghnMappingVerifiedAt: null,
    ghnMappingVerificationSource: null,
    source: 'missing',
    mapping: null,
  };
};

const toManagedMappingRecord = (mapping: {
  provinceCode: string;
  provinceName: string;
  wardCode: string;
  wardName: string;
  ghnProvinceId: number;
  ghnProvinceName?: string | null;
  ghnDistrictId: number;
  ghnDistrictName?: string | null;
  ghnWardCode: string;
  ghnWardName?: string | null;
  confidence: ShippingAreaMappingConfidence;
  verifiedAt?: Date | null;
  note?: string | null;
}): ShippingAreaMappingRecord => ({
  provider: 'GHN',
  provinceCode: mapping.provinceCode,
  provinceName: mapping.provinceName,
  wardCode: mapping.wardCode,
  wardName: mapping.wardName,
  ghnProvinceId: mapping.ghnProvinceId,
  ghnProvinceName: mapping.ghnProvinceName ?? mapping.provinceName,
  ghnDistrictId: mapping.ghnDistrictId,
  ghnDistrictName: mapping.ghnDistrictName ?? '',
  ghnWardCode: mapping.ghnWardCode,
  ghnWardName: mapping.ghnWardName ?? mapping.wardName,
  confidence: mapping.confidence,
  verifiedAt: (mapping.verifiedAt ?? new Date(0)).toISOString(),
  note: mapping.note ?? undefined,
});

const findManagedMapping = async (input: ShippingAreaMappingLookupInput) => {
  if (!ShippingAreaMapping || typeof ShippingAreaMapping.findOne !== 'function') {
    return { mapping: null, unavailable: false };
  }

  const provinceCode = normalizeProvinceCode(input.provinceCode);
  const wardCode = normalizeWardCode(input.wardCode);
  const provinceKey = normalizeLabel(input.province);
  const wardKey = normalizeLabel(input.ward);
  const lookup = provinceCode && wardCode
    ? { provider: 'GHN', provinceCode, wardCode }
    : provinceKey && wardKey
      ? { provider: 'GHN', provinceKey, wardKey }
      : null;

  if (!lookup) return { mapping: null, unavailable: false };

  try {
    return {
      mapping: await ShippingAreaMapping.findOne(lookup).sort({ updatedAt: -1 }).lean(),
      unavailable: false,
    };
  } catch (error) {
    console.error('Failed to resolve managed GHN area mapping:', error);
    return { mapping: null, unavailable: true };
  }
};

const resolveStoredGhnFieldsWithManagedMapping = async (
  input: ShippingAreaMappingLookupInput,
): Promise<ResolvedStoredGhnFields> => {
  const managedLookup = await findManagedMapping(input);
  if (managedLookup.unavailable) {
    return {
      ghnProvinceId: null,
      ghnDistrictId: null,
      ghnWardCode: null,
      ghnMappingStatus: 'missing',
      ghnMappingConfidence: null,
      ghnMappingVerifiedAt: null,
      ghnMappingVerificationSource: null,
      source: 'managed',
      mapping: null,
    };
  }

  const managed = managedLookup.mapping;
  if (!managed) return resolveStoredGhnFields(input);

  if (managed.status !== 'verified' || !managed.verifiedAt) {
    return {
      ghnProvinceId: null,
      ghnDistrictId: null,
      ghnWardCode: null,
      ghnMappingStatus: managed.status === 'pending' ? 'manual' : 'missing',
      ghnMappingConfidence: managed.confidence ?? null,
      ghnMappingVerifiedAt: null,
      ghnMappingVerificationSource: null,
      source: 'managed',
      mapping: null,
    };
  }

  const mapping = toManagedMappingRecord(managed);
  return {
    ghnProvinceId: mapping.ghnProvinceId,
    ghnDistrictId: mapping.ghnDistrictId,
    ghnWardCode: mapping.ghnWardCode,
    ghnMappingStatus: 'mapped',
    ghnMappingConfidence: mapping.confidence,
    ghnMappingVerifiedAt: new Date(mapping.verifiedAt),
    ghnMappingVerificationSource: 'managed',
    source: 'managed',
    mapping,
  };
};

const normalizeUpsertInput = (
  input: ShippingAreaMappingUpsertInput,
  actorId?: string | null,
) => {
  const provinceCode = normalizeProvinceCode(input.provinceCode);
  const wardCode = normalizeWardCode(input.wardCode);
  const provinceName = trimOptional(input.provinceName);
  const wardName = trimOptional(input.wardName);
  const provinceKey = normalizeLabel(input.provinceName);
  const wardKey = normalizeLabel(input.wardName);
  const ghnProvinceId = toPositiveIntegerOrNull(input.ghnProvinceId);
  const ghnDistrictId = toPositiveIntegerOrNull(input.ghnDistrictId);
  const ghnWardCode = trimOptional(input.ghnWardCode);
  const status = input.status ?? 'pending';
  const confidence = input.confidence ?? 'manual';
  const verifiedAt = status === 'verified'
    ? toDateOrNull(input.verifiedAt) ?? new Date()
    : null;

  if (
    !provinceCode
    || !wardCode
    || !provinceName
    || !wardName
    || !provinceKey
    || !wardKey
    || !ghnProvinceId
    || !ghnDistrictId
    || !ghnWardCode
    || !(['pending', 'verified', 'disabled'] as ShippingAreaMappingStatus[]).includes(status)
    || !(['exact', 'manual', 'legacy'] as ShippingAreaMappingConfidence[]).includes(confidence)
  ) {
    const error = new Error('Thông tin mapping GHN không hợp lệ') as Error & { statusCode?: number };
    error.statusCode = 400;
    throw error;
  }

  return {
    provider: 'GHN' as const,
    provinceCode,
    provinceName,
    wardCode,
    wardName,
    provinceKey,
    wardKey,
    ghnProvinceId,
    ghnProvinceName: trimOptional(input.ghnProvinceName),
    ghnDistrictId,
    ghnDistrictName: trimOptional(input.ghnDistrictName),
    ghnWardCode,
    ghnWardName: trimOptional(input.ghnWardName),
    confidence,
    status,
    verifiedAt,
    verifiedBy: actorId || null,
    note: trimOptional(input.note),
  };
};

type NormalizedMapping = ReturnType<typeof normalizeUpsertInput>;

type GhnHierarchyValidationCache = {
  provinces: Promise<unknown> | null;
  districts: Map<number, Promise<unknown>>;
  wards: Map<number, Promise<unknown>>;
};

const createGhnHierarchyValidationCache = (): GhnHierarchyValidationCache => ({
  provinces: null,
  districts: new Map(),
  wards: new Map(),
});

const readGhnLocationRows = (response: unknown) => {
  if (typeof response !== 'object' || response === null || Array.isArray(response)) return [];
  const data = (response as Record<string, unknown>).data;
  return Array.isArray(data) ? data : [];
};

const hasGhnLocation = (
  response: unknown,
  field: 'ProvinceID' | 'DistrictID' | 'WardCode',
  expectedValue: number | string,
) => readGhnLocationRows(response).some((row) => (
  typeof row === 'object'
  && row !== null
  && !Array.isArray(row)
  && String((row as Record<string, unknown>)[field]) === String(expectedValue)
));

const invalidGhnHierarchyError = (mapping: NormalizedMapping, detail: string) => {
  const error = new Error(
    `Mapping GHN ${mapping.provinceCode}/${mapping.wardCode} không hợp lệ: ${detail}`,
  ) as Error & { statusCode?: number };
  error.statusCode = 400;
  return error;
};

const validateGhnHierarchy = async (
  mapping: NormalizedMapping,
  cache: GhnHierarchyValidationCache,
) => {
  cache.provinces ??= GHNService.getProvinces();
  if (!hasGhnLocation(await cache.provinces, 'ProvinceID', mapping.ghnProvinceId)) {
    throw invalidGhnHierarchyError(mapping, `không tìm thấy province ${mapping.ghnProvinceId}`);
  }

  if (!cache.districts.has(mapping.ghnProvinceId)) {
    cache.districts.set(
      mapping.ghnProvinceId,
      GHNService.getDistricts(mapping.ghnProvinceId),
    );
  }
  if (!hasGhnLocation(
    await cache.districts.get(mapping.ghnProvinceId),
    'DistrictID',
    mapping.ghnDistrictId,
  )) {
    throw invalidGhnHierarchyError(
      mapping,
      `district ${mapping.ghnDistrictId} không thuộc province ${mapping.ghnProvinceId}`,
    );
  }

  if (!cache.wards.has(mapping.ghnDistrictId)) {
    cache.wards.set(mapping.ghnDistrictId, GHNService.getWards(mapping.ghnDistrictId));
  }
  if (!hasGhnLocation(
    await cache.wards.get(mapping.ghnDistrictId),
    'WardCode',
    mapping.ghnWardCode,
  )) {
    throw invalidGhnHierarchyError(
      mapping,
      `ward ${mapping.ghnWardCode} không thuộc district ${mapping.ghnDistrictId}`,
    );
  }
};

const validateVerifiedMappings = async (mappings: NormalizedMapping[]) => {
  const verifiedMappings = mappings.filter((mapping) => mapping.status === 'verified');
  if (!verifiedMappings.length) return;

  const cache = createGhnHierarchyValidationCache();
  const validationConcurrency = 10;
  for (let index = 0; index < verifiedMappings.length; index += validationConcurrency) {
    await Promise.all(
      verifiedMappings
        .slice(index, index + validationConcurrency)
        .map((mapping) => validateGhnHierarchy(mapping, cache)),
    );
  }
};

const validateMapping = async (input: ShippingAreaMappingUpsertInput) => {
  const mapping = normalizeUpsertInput({
    ...input,
    status: 'verified',
  });
  await validateVerifiedMappings([mapping]);
  return mapping;
};

const backfillMapping = async (mapping: NormalizedMapping) => {
  const addressUpdate = {
    ghnProvinceId: mapping.ghnProvinceId,
    ghnDistrictId: mapping.ghnDistrictId,
    ghnWardCode: mapping.ghnWardCode,
    ghnMappingStatus: 'mapped',
    ghnMappingConfidence: mapping.confidence,
    ghnMappingVerifiedAt: mapping.verifiedAt,
    ghnMappingVerificationSource: 'managed',
  };
  const orderUpdate = {
    ...Object.fromEntries(
      Object.entries(addressUpdate).map(([key, value]) => [`shippingAddress.${key}`, value]),
    ),
    'shipping.status': 'mapping_resolved',
  };

  const [orders, users] = await Promise.all([
    Order.updateMany(
      {
        status: { $in: ['confirmed', 'packed'] },
        'shippingAddress.provinceCode': mapping.provinceCode,
        'shippingAddress.wardCode': mapping.wardCode,
        'shipping.trackingCode': null,
      },
      { $set: orderUpdate },
    ),
    User.updateMany(
      {
        address: {
          $elemMatch: {
            provinceCode: mapping.provinceCode,
            wardCode: mapping.wardCode,
          },
        },
      },
      {
        $set: Object.fromEntries(
          Object.entries(addressUpdate).map(([key, value]) => [`address.$[address].${key}`, value]),
        ),
      },
      {
        arrayFilters: [{
          'address.provinceCode': mapping.provinceCode,
          'address.wardCode': mapping.wardCode,
        }],
      },
    ),
  ]);

  return {
    orders: orders.modifiedCount,
    userAddresses: users.modifiedCount,
  };
};

const upsertMappings = async (input: {
  mappings: ShippingAreaMappingUpsertInput[];
  actorId?: string | null;
  backfill?: boolean;
}) => {
  const normalizedMappings = input.mappings.map((mapping) => normalizeUpsertInput(mapping, input.actorId));
  await validateVerifiedMappings(normalizedMappings);

  await ShippingAreaMapping.bulkWrite(
    normalizedMappings.map((mapping) => ({
      updateOne: {
        filter: {
          provider: 'GHN',
          provinceCode: mapping.provinceCode,
          wardCode: mapping.wardCode,
        },
        update: { $set: mapping },
        upsert: true,
      },
    })),
    { ordered: true },
  );

  let backfilledOrders = 0;
  let backfilledUserDocuments = 0;
  const backfillFailures: Array<{
    provinceCode: string;
    wardCode: string;
    message: string;
  }> = [];

  const mappingsToBackfill = input.backfill
    ? normalizedMappings.filter((mapping) => mapping.status === 'verified')
    : [];
  const backfillConcurrency = 10;
  for (let index = 0; index < mappingsToBackfill.length; index += backfillConcurrency) {
    const batch = mappingsToBackfill.slice(index, index + backfillConcurrency);
    const results = await Promise.allSettled(batch.map((mapping) => backfillMapping(mapping)));
    results.forEach((result, resultIndex) => {
      const mapping = batch[resultIndex];
      if (result.status === 'fulfilled') {
        backfilledOrders += result.value.orders;
        backfilledUserDocuments += result.value.userAddresses;
        return;
      }

      backfillFailures.push({
        provinceCode: mapping.provinceCode,
        wardCode: mapping.wardCode,
        message: result.reason instanceof Error
          ? result.reason.message
          : 'Không thể backfill mapping GHN',
      });
    });
  }

  return {
    items: normalizedMappings,
    importedCount: normalizedMappings.length,
    backfilledOrders,
    backfilledUserDocuments,
    backfillFailedCount: backfillFailures.length,
    backfillFailures,
  };
};

const listMappings = async (input: {
  keyword?: string;
  status?: ShippingAreaMappingStatus;
  page?: number;
  limit?: number;
}) => {
  const page = Math.max(1, input.page ?? 1);
  const limit = Math.min(100, Math.max(1, input.limit ?? 20));
  const filter: Record<string, unknown> = { provider: 'GHN' };

  if (input.status) filter.status = input.status;
  if (input.keyword?.trim()) {
    const escapedKeyword = input.keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { provinceName: { $regex: escapedKeyword, $options: 'i' } },
      { wardName: { $regex: escapedKeyword, $options: 'i' } },
      { wardCode: { $regex: escapedKeyword, $options: 'i' } },
      { ghnWardCode: { $regex: escapedKeyword, $options: 'i' } },
    ];
  }

  const [items, totalItems] = await Promise.all([
    ShippingAreaMapping.find(filter)
      .sort({ status: 1, updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ShippingAreaMapping.countDocuments(filter),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
    },
  };
};

const getCoverage = async () => {
  const managedMappings = await ShippingAreaMapping.find({ provider: 'GHN' })
    .select('provinceCode wardCode status confidence')
    .lean<Array<{
      provinceCode: string;
      wardCode: string;
      status: ShippingAreaMappingStatus;
      confidence: ShippingAreaMappingConfidence;
    }>>();
  const effectiveMappings = new Map<string, {
    status: ShippingAreaMappingStatus;
    confidence: ShippingAreaMappingConfidence;
    source: 'seed' | 'managed';
  }>();

  shippingAreaMappingSeed.forEach((mapping) => {
    const key = buildCodeKey(mapping.provinceCode, mapping.wardCode);
    if (key) {
      effectiveMappings.set(key, {
        status: mapping.confidence === 'exact' ? 'verified' : 'pending',
        confidence: mapping.confidence,
        source: 'seed',
      });
    }
  });
  managedMappings.forEach((mapping) => {
    const key = buildCodeKey(mapping.provinceCode, mapping.wardCode);
    if (key) {
      effectiveMappings.set(key, {
        status: mapping.status,
        confidence: mapping.confidence,
        source: 'managed',
      });
    }
  });

  const getWardCoverageState = (provinceCode: string, wardCode: string) => {
    const mapping = effectiveMappings.get(buildCodeKey(provinceCode, wardCode) ?? '');
    const verified = mapping?.status === 'verified';
    const productionReady = verified && (
      mapping.confidence === 'exact'
      || (mapping.source === 'managed' && mapping.confidence === 'manual')
    );
    return { mapping, verified, productionReady };
  };

  const provinceRows = provinces2025.map((province) => {
    const provinceWards = wards2025.filter((ward) => ward.provinceCode === province.code);
    const states = provinceWards.map((ward) => getWardCoverageState(province.code, ward.code));
    const verifiedWardCount = states.filter((state) => state.verified).length;
    const productionReadyWardCount = states.filter((state) => state.productionReady).length;
    const pendingWardCount = states.filter((state) => state.mapping?.status === 'pending').length;
    const disabledWardCount = states.filter((state) => state.mapping?.status === 'disabled').length;

    return {
      provinceCode: province.code,
      provinceName: province.name,
      wardCount: provinceWards.length,
      verifiedWardCount,
      productionReadyWardCount,
      pendingWardCount,
      disabledWardCount,
      missingWardCount: Math.max(0, provinceWards.length - verifiedWardCount),
      coveragePercent: provinceWards.length
        ? Math.round((verifiedWardCount / provinceWards.length) * 10_000) / 100
        : 100,
      productionReadyCoveragePercent: provinceWards.length
        ? Math.round((productionReadyWardCount / provinceWards.length) * 10_000) / 100
        : 100,
    };
  });
  const verifiedWardCount = provinceRows.reduce((total, row) => total + row.verifiedWardCount, 0);
  const productionReadyWardCount = provinceRows.reduce(
    (total, row) => total + row.productionReadyWardCount,
    0,
  );
  const pendingWardCount = provinceRows.reduce((total, row) => total + row.pendingWardCount, 0);
  const disabledWardCount = provinceRows.reduce((total, row) => total + row.disabledWardCount, 0);
  const confidenceCounts = {
    exact: 0,
    manual: 0,
    legacy: 0,
  };
  wards2025.forEach((ward) => {
    const mapping = effectiveMappings.get(buildCodeKey(ward.provinceCode, ward.code) ?? '');
    if (mapping?.status === 'verified') confidenceCounts[mapping.confidence] += 1;
  });

  return {
    locationDataVersion: LOCATION_DATA_VERSION,
    provinceCount: provinceRows.length,
    wardCount: wards2025.length,
    verifiedWardCount,
    productionReadyWardCount,
    pendingWardCount,
    disabledWardCount,
    confidenceCounts,
    missingWardCount: Math.max(0, wards2025.length - verifiedWardCount),
    coveragePercent: wards2025.length
      ? Math.round((verifiedWardCount / wards2025.length) * 10_000) / 100
      : 100,
    productionReadyCoveragePercent: wards2025.length
      ? Math.round((productionReadyWardCount / wards2025.length) * 10_000) / 100
      : 100,
    readyForProduction: productionReadyWardCount === wards2025.length,
    provinces: provinceRows,
  };
};

const reviewMapping = async (input: {
  id: string;
  status: ShippingAreaMappingStatus;
  actorId?: string | null;
  confidence?: ShippingAreaMappingConfidence;
  note?: string | null;
  backfill?: boolean;
}) => {
  if (!Types.ObjectId.isValid(input.id)) {
    const error = new Error('Mapping GHN không hợp lệ') as Error & { statusCode?: number };
    error.statusCode = 400;
    throw error;
  }

  const verifiedAt = input.status === 'verified' ? new Date() : null;
  if (input.status === 'verified') {
    const currentMapping = await ShippingAreaMapping.findById(input.id).lean();
    if (!currentMapping) {
      const error = new Error('Không tìm thấy mapping GHN') as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }

    const normalizedMapping = normalizeUpsertInput({
      provinceCode: currentMapping.provinceCode,
      provinceName: currentMapping.provinceName,
      wardCode: currentMapping.wardCode,
      wardName: currentMapping.wardName,
      ghnProvinceId: currentMapping.ghnProvinceId,
      ghnProvinceName: currentMapping.ghnProvinceName,
      ghnDistrictId: currentMapping.ghnDistrictId,
      ghnDistrictName: currentMapping.ghnDistrictName,
      ghnWardCode: currentMapping.ghnWardCode,
      ghnWardName: currentMapping.ghnWardName,
      confidence: input.confidence ?? currentMapping.confidence,
      status: 'verified',
      verifiedAt,
      note: input.note ?? currentMapping.note,
    }, input.actorId);
    await validateVerifiedMappings([normalizedMapping]);
  }

  const mapping = await ShippingAreaMapping.findByIdAndUpdate(
    input.id,
    {
      $set: {
        status: input.status,
        verifiedAt,
        verifiedBy: input.actorId || null,
        ...(input.confidence ? { confidence: input.confidence } : {}),
        ...(input.note !== undefined ? { note: trimOptional(input.note) } : {}),
      },
    },
    { new: true, runValidators: true },
  ).lean();

  if (!mapping) {
    const error = new Error('Không tìm thấy mapping GHN') as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }

  let backfillResult = { orders: 0, userAddresses: 0 };
  let backfillFailure: string | null = null;
  if (input.backfill && input.status === 'verified') {
    try {
      backfillResult = await backfillMapping(normalizeUpsertInput({
        provinceCode: mapping.provinceCode,
        provinceName: mapping.provinceName,
        wardCode: mapping.wardCode,
        wardName: mapping.wardName,
        ghnProvinceId: mapping.ghnProvinceId,
        ghnProvinceName: mapping.ghnProvinceName,
        ghnDistrictId: mapping.ghnDistrictId,
        ghnDistrictName: mapping.ghnDistrictName,
        ghnWardCode: mapping.ghnWardCode,
        ghnWardName: mapping.ghnWardName,
        confidence: mapping.confidence,
        status: mapping.status,
        verifiedAt: mapping.verifiedAt,
        note: mapping.note,
      }, input.actorId));
    } catch (error) {
      backfillFailure = error instanceof Error
        ? error.message
        : 'Không thể backfill mapping GHN';
    }
  }

  return {
    mapping,
    backfilledOrders: backfillResult.orders,
    backfilledUserDocuments: backfillResult.userAddresses,
    backfillFailed: Boolean(backfillFailure),
    backfillFailure,
  };
};

export const shippingAreaMappingService = {
  getCoverage,
  listMappings,
  reviewMapping,
  resolveMapping,
  resolveStoredGhnFields,
  resolveStoredGhnFieldsWithManagedMapping,
  upsertMappings,
  validateMapping,
};
