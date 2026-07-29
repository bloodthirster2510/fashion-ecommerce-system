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

export type MappingStatus = 'mapped' | 'missing' | 'manual';

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
};

export type ResolvedStoredGhnFields = {
  ghnProvinceId: number | null;
  ghnDistrictId: number | null;
  ghnWardCode: string | null;
  ghnMappingStatus: MappingStatus;
  ghnMappingConfidence: ShippingAreaMappingConfidence | null;
  ghnMappingVerifiedAt: Date | null;
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
  const storedVerificationDate = toDateOrNull(input.ghnMappingVerifiedAt);
  const storedConfidence = input.ghnMappingConfidence ?? null;
  const mapping = hasExplicitMapping || hasLegacyMapping
    ? null
    : resolveMapping(input);

  if (hasExplicitMapping) {
    return {
      ghnProvinceId: explicitGhnProvinceId ?? legacyProvinceId,
      ghnDistrictId: explicitGhnDistrictId,
      ghnWardCode: explicitGhnWardCode,
      ghnMappingStatus: 'mapped',
      ghnMappingConfidence: storedConfidence ?? 'manual',
      ghnMappingVerifiedAt: storedVerificationDate ?? new Date(),
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
      ghnMappingConfidence: storedConfidence,
      ghnMappingVerifiedAt: storedVerificationDate,
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
      ghnMappingConfidence: mapping.confidence,
      ghnMappingVerifiedAt: new Date(mapping.verifiedAt),
      source: 'mapping',
      mapping,
    };
  }

  return {
    ghnProvinceId: explicitGhnProvinceId ?? legacyProvinceId,
    ghnDistrictId: null,
    ghnWardCode: null,
    ghnMappingStatus: 'missing',
    ghnMappingConfidence: null,
    ghnMappingVerifiedAt: null,
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
    return null;
  }

  const provinceCode = normalizeCode(input.provinceCode);
  const wardCode = normalizeCode(input.wardCode);
  const provinceKey = normalizeLabel(input.province);
  const wardKey = normalizeLabel(input.ward);
  const lookup = provinceCode && wardCode
    ? { provider: 'GHN', provinceCode, wardCode, status: 'verified' }
    : provinceKey && wardKey
      ? { provider: 'GHN', provinceKey, wardKey, status: 'verified' }
      : null;

  if (!lookup) return null;

  try {
    return await ShippingAreaMapping.findOne(lookup).sort({ updatedAt: -1 }).lean();
  } catch (error) {
    console.error('Failed to resolve managed GHN area mapping:', error);
    return null;
  }
};

const resolveStoredGhnFieldsWithManagedMapping = async (
  input: ShippingAreaMappingLookupInput,
): Promise<ResolvedStoredGhnFields> => {
  const stored = resolveStoredGhnFields(input);
  if (stored.source !== 'missing') return stored;

  const managed = await findManagedMapping(input);
  if (!managed || !managed.verifiedAt) return stored;

  const mapping = toManagedMappingRecord(managed);
  return {
    ghnProvinceId: mapping.ghnProvinceId,
    ghnDistrictId: mapping.ghnDistrictId,
    ghnWardCode: mapping.ghnWardCode,
    ghnMappingStatus: 'mapped',
    ghnMappingConfidence: mapping.confidence,
    ghnMappingVerifiedAt: new Date(mapping.verifiedAt),
    source: 'managed',
    mapping,
  };
};

const normalizeUpsertInput = (
  input: ShippingAreaMappingUpsertInput,
  actorId?: string | null,
) => {
  const provinceCode = normalizeCode(input.provinceCode);
  const wardCode = normalizeCode(input.wardCode);
  const provinceName = trimOptional(input.provinceName);
  const wardName = trimOptional(input.wardName);
  const provinceKey = normalizeLabel(input.provinceName);
  const wardKey = normalizeLabel(input.wardName);
  const ghnProvinceId = toPositiveIntegerOrNull(input.ghnProvinceId);
  const ghnDistrictId = toPositiveIntegerOrNull(input.ghnDistrictId);
  const ghnWardCode = trimOptional(input.ghnWardCode);
  const status = input.status ?? 'verified';
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

const backfillMapping = async (mapping: ReturnType<typeof normalizeUpsertInput>) => {
  const addressUpdate = {
    ghnProvinceId: mapping.ghnProvinceId,
    ghnDistrictId: mapping.ghnDistrictId,
    ghnWardCode: mapping.ghnWardCode,
    ghnMappingStatus: 'mapped',
    ghnMappingConfidence: mapping.confidence,
    ghnMappingVerifiedAt: mapping.verifiedAt,
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
  const results = [];
  let backfilledOrders = 0;
  let backfilledUserDocuments = 0;

  for (const mapping of normalizedMappings) {
    const saved = await ShippingAreaMapping.findOneAndUpdate(
      {
        provider: 'GHN',
        provinceCode: mapping.provinceCode,
        wardCode: mapping.wardCode,
      },
      { $set: mapping },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();
    results.push(saved);

    if (input.backfill && mapping.status === 'verified') {
      const backfillResult = await backfillMapping(mapping);
      backfilledOrders += backfillResult.orders;
      backfilledUserDocuments += backfillResult.userAddresses;
    }
  }

  return {
    items: results,
    importedCount: results.length,
    backfilledOrders,
    backfilledUserDocuments,
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
  const managedMappings = await ShippingAreaMapping.find({
    provider: 'GHN',
    status: 'verified',
  })
    .select('provinceCode wardCode')
    .lean<Array<{ provinceCode: string; wardCode: string }>>();
  const verifiedKeys = new Set(
    [...shippingAreaMappingSeed, ...managedMappings]
      .map((mapping) => buildCodeKey(mapping.provinceCode, mapping.wardCode))
      .filter((key): key is string => Boolean(key)),
  );
  const provinceRows = provinces2025.map((province) => {
    const provinceWards = wards2025.filter((ward) => ward.provinceCode === province.code);
    const verifiedWardCount = provinceWards.filter((ward) =>
      verifiedKeys.has(buildCodeKey(province.code, ward.code) ?? '')).length;

    return {
      provinceCode: province.code,
      provinceName: province.name,
      wardCount: provinceWards.length,
      verifiedWardCount,
      missingWardCount: Math.max(0, provinceWards.length - verifiedWardCount),
      coveragePercent: provinceWards.length
        ? Math.round((verifiedWardCount / provinceWards.length) * 10_000) / 100
        : 100,
    };
  });
  const verifiedWardCount = provinceRows.reduce((total, row) => total + row.verifiedWardCount, 0);

  return {
    locationDataVersion: LOCATION_DATA_VERSION,
    provinceCount: provinceRows.length,
    wardCount: wards2025.length,
    verifiedWardCount,
    missingWardCount: Math.max(0, wards2025.length - verifiedWardCount),
    coveragePercent: wards2025.length
      ? Math.round((verifiedWardCount / wards2025.length) * 10_000) / 100
      : 100,
    readyForProduction: verifiedWardCount === wards2025.length,
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

  const backfillResult = input.backfill && input.status === 'verified'
    ? await backfillMapping(normalizeUpsertInput({
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
      }, input.actorId))
    : { orders: 0, userAddresses: 0 };

  return {
    mapping,
    backfilledOrders: backfillResult.orders,
    backfilledUserDocuments: backfillResult.userAddresses,
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
};
