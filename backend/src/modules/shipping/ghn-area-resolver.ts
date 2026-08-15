import type { ShippingAddressForQuote } from './shipping.types';
import { shippingAreaMappingService } from './shipping-area-mapping.service';

export type ResolvedGhnArea = {
  provider: 'GHN';
  provinceId: number | null;
  districtId: number | null;
  wardCode: string | null;
  status: 'mapped' | 'missing' | 'manual';
  confidence: 'exact' | 'manual' | 'legacy' | null;
  verifiedAt: Date | null;
  verificationSource: 'admin' | 'managed' | 'seed' | null;
  source: 'explicit' | 'legacy' | 'mapping' | 'managed' | 'missing';
};

export const resolveGhnArea = (address?: ShippingAddressForQuote | null): ResolvedGhnArea => {
  if (!address) {
    return {
      provider: 'GHN',
      provinceId: null,
      districtId: null,
      wardCode: null,
      status: 'missing',
      confidence: null,
      verifiedAt: null,
      verificationSource: null,
      source: 'missing',
    };
  }

  const resolvedGhnFields = shippingAreaMappingService.resolveStoredGhnFields(address);

  return {
    provider: 'GHN',
    provinceId: resolvedGhnFields.ghnProvinceId,
    districtId: resolvedGhnFields.ghnDistrictId,
    wardCode: resolvedGhnFields.ghnWardCode,
    status: resolvedGhnFields.ghnMappingStatus,
    confidence: resolvedGhnFields.ghnMappingConfidence,
    verifiedAt: resolvedGhnFields.ghnMappingVerifiedAt,
    verificationSource: resolvedGhnFields.ghnMappingVerificationSource,
    source: resolvedGhnFields.source,
  };
};

export const resolveManagedGhnArea = async (
  address?: ShippingAddressForQuote | null,
): Promise<ResolvedGhnArea> => {
  if (!address) return resolveGhnArea(address);

  const resolvedGhnFields =
    await shippingAreaMappingService.resolveStoredGhnFieldsWithManagedMapping(address);

  return {
    provider: 'GHN',
    provinceId: resolvedGhnFields.ghnProvinceId,
    districtId: resolvedGhnFields.ghnDistrictId,
    wardCode: resolvedGhnFields.ghnWardCode,
    status: resolvedGhnFields.ghnMappingStatus,
    confidence: resolvedGhnFields.ghnMappingConfidence,
    verifiedAt: resolvedGhnFields.ghnMappingVerifiedAt,
    verificationSource: resolvedGhnFields.ghnMappingVerificationSource,
    source: resolvedGhnFields.source,
  };
};
